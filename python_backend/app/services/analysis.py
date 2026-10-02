from __future__ import annotations

import json
import logging
import math
import re
import statistics
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import duckdb
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models import DocumentChunk, Source
from app.schemas import AskResponse, ChartSpec, EvidenceItem, KeyMetric, RecommendationPayload
from app.services.chart_builder import build_chart_spec
from app.services.embeddings import cosine_similarity, embed_texts_with_provider
from app.services.ingestion import read_structured_file
from app.services.recommendations import create_query_recommendations

STOP_WORDS = {
    "a", "about", "across", "after", "all", "an", "and", "are", "as", "at", "be", "based", "by", "data",
    "did", "do", "does", "for", "from", "how", "in", "into", "is", "it", "me", "of", "on", "or", "our",
    "show", "summarize", "the", "this", "to", "what", "when", "where", "which", "who", "why", "with", "you",
}
logger = logging.getLogger(__name__)


def classify_intent(query: str, has_tables: bool, has_documents: bool) -> str:
    text = query.lower()
    if any(word in text for word in ("forecast", "predict", "projection", "next quarter", "future")):
        return "forecasting"
    if any(word in text for word in ("anomal", "outlier", "unusual", "abnormal", "spike")):
        return "anomaly_detection"
    if any(word in text for word in ("distribution", "proportion", "share", "breakdown", "percentage")):
        return "distribution"
    if has_tables and has_documents:
        return "hybrid"
    if has_tables:
        return "structured_query"
    if has_documents:
        return "document_rag"
    return "overview"


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if len(token) > 2 and token not in STOP_WORDS}


def _choose_column(columns: list[str], query: str, preferred: tuple[str, ...] = ()) -> str | None:
    tokens = _tokens(query)
    ranked = sorted(
        columns,
        key=lambda column: (
            4 * (column.lower() in query.lower()),
            sum(token in re.findall(r"[a-z0-9]+", column.lower()) for token in tokens),
            any(name in column.lower() for name in preferred),
        ),
        reverse=True,
    )
    if not ranked:
        return None
    return ranked[0]


def _q(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _native(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value


def _money(value: float) -> str:
    return f"{value:,.2f}".rstrip("0").rstrip(".")


def _safe_group_aggregate(frame: pd.DataFrame, metric: str, dimension: str, use_count: bool) -> list[tuple[Any, float, int]]:
    relation = f"source_{uuid4().hex[:10]}"
    connection = duckdb.connect(database=":memory:")
    connection.register(relation, frame)
    measure_sql = "COUNT(*)" if use_count else f"SUM(TRY_CAST({_q(metric)} AS DOUBLE))"
    sql = (
        f"SELECT CAST({_q(dimension)} AS VARCHAR) AS category, {measure_sql} AS value, COUNT(*) AS row_count "
        f"FROM {relation} WHERE {_q(metric)} IS NOT NULL GROUP BY 1 ORDER BY value DESC LIMIT 30"
    )
    try:
        try:
            return connection.execute(sql).fetchall()
        except duckdb.Error:
            logger.warning("DuckDB query failed; repairing with the equivalent Pandas aggregation")
        grouped = frame.dropna(subset=[metric]).groupby(dimension, dropna=False)[metric]
        if use_count:
            repaired = grouped.size().sort_values(ascending=False).head(30)
            return [(category, float(count), int(count)) for category, count in repaired.items()]
        repaired = grouped.agg(["sum", "count"]).sort_values("sum", ascending=False).head(30)
        return [(category, float(row["sum"]), int(row["count"])) for category, row in repaired.iterrows()]
    finally:
        connection.close()


def _table_analysis(source: Source, frame: pd.DataFrame, query: str, intent: str) -> dict[str, Any]:
    if frame.empty:
        return {"metrics": [], "data": [], "summary": f"{source.filename} contains no data rows.", "rows": 0, "chart": None}

    numeric_columns = [
        column for column in frame.columns
        if pd.to_numeric(frame[column], errors="coerce").notna().sum() >= max(1, math.ceil(len(frame) * 0.5))
        and not re.search(r"(^id$|_id$|\bid\b|code|phone|zip|postal)", column.lower())
    ]
    category_columns = [
        column for column in frame.columns
        if column not in numeric_columns
        and not re.search(r"(^id$|_id$|\bid\b|code|phone|zip|postal)", column.lower())
        and 1 < frame[column].nunique(dropna=True) <= min(50, max(2, len(frame)))
    ]
    if not numeric_columns:
        return {
            "metrics": [KeyMetric(label="Rows", value=f"{len(frame):,}")],
            "data": [{"category": "Records", "count": int(len(frame))}],
            "summary": f"{source.filename} contains {len(frame):,} rows and {len(frame.columns)} fields; no numeric measures were found for aggregation.",
            "rows": len(frame),
            "chart": ChartSpec(type="kpi", title=f"Records in {source.filename}", y_axis="count", data=[{"category": "Records", "count": int(len(frame))}]),
        }

    metric = _choose_column(numeric_columns, query, ("revenue", "sales", "profit", "amount", "cost", "price", "units", "quantity", "score", "total"))
    if metric is None:
        return {"metrics": [], "data": [], "summary": f"No usable numeric field was found in {source.filename}.", "rows": 0, "chart": None}
    dimension = _choose_column(category_columns, query, ("region", "category", "segment", "product", "quarter", "month", "date", "department", "status"))

    working = frame.copy()
    parsed_metric = pd.to_numeric(working[metric], errors="coerce")
    working[metric] = parsed_metric
    if dimension and re.search(r"date|time|quarter|month|year", dimension.lower()):
        parsed_dates = pd.to_datetime(working[dimension], errors="coerce", format="mixed", utc=True)
        if parsed_dates.notna().mean() > 0.5:
            if "quarter" in query.lower():
                working["__period"] = parsed_dates.dt.to_period("Q").astype(str)
            elif "year" in query.lower():
                working["__period"] = parsed_dates.dt.year.astype("Int64").astype("string")
            else:
                working["__period"] = parsed_dates.dt.to_period("M").astype(str)
            dimension = "__period"

    if intent == "anomaly_detection":
        values = parsed_metric.dropna()
        if values.empty:
            outliers = working.iloc[0:0]
        else:
            q1, q3 = values.quantile(0.25), values.quantile(0.75)
            spread = q3 - q1
            low, high = q1 - 1.5 * spread, q3 + 1.5 * spread
            outliers = working[(working[metric] < low) | (working[metric] > high)].copy()
        rows = [{"record": int(index) + 1, "value": float(row[metric]), **({dimension: _native(row[dimension])} if dimension and dimension != "__period" else {})} for index, row in outliers.head(20).iterrows()]
        summary = f"Detected {len(outliers)} potential outlier(s) in {metric} using the 1.5×IQR rule across {len(values):,} valid values."
        metric_values = [KeyMetric(label="Potential outliers", value=str(len(outliers)), change=f"of {len(values):,} values"), KeyMetric(label=f"{metric} median", value=_money(float(values.median())))] if len(values) else []
        chart = build_chart_spec(rows, f"Potential outliers in {metric}", "record", "value", intent)
        return {"metrics": metric_values, "data": rows, "summary": summary, "rows": len(outliers), "chart": chart, "metric": metric}

    if dimension:
        use_count = any(word in query.lower() for word in ("count", "how many", "frequency", "number of records"))
        measure_label = "record_count" if use_count else metric
        raw_rows = _safe_group_aggregate(working, metric, dimension, use_count)
        rows = [
            {"category": str(category), measure_label: float(value or 0), "row_count": int(row_count)}
            for category, value, row_count in raw_rows
        ]
        if intent == "forecasting":
            rows.sort(key=lambda row: row["category"])
        total = sum(row.get(measure_label, 0) for row in rows)
        top = rows[0] if rows else None
        metrics = [
            KeyMetric(label=f"Total {metric}", value=_money(total), change=f"{len(frame):,} rows"),
            KeyMetric(label=f"Average {metric}", value=_money(float(parsed_metric.mean())), change=f"{parsed_metric.count():,} values"),
        ]
        if top:
            metrics.append(KeyMetric(label=f"Top {dimension}", value=top["category"], change=_money(top[measure_label])))
        summary = f"Across {len(frame):,} rows in {source.filename}, {metric} totals {_money(total)} and averages {_money(float(parsed_metric.mean()))}."
        if top:
            summary += f" {top['category']} has the highest {measure_label.replace('_', ' ')} at {_money(top[measure_label])}."
        chart_data = [{"category": row["category"], measure_label: row[measure_label]} for row in rows]
        if intent == "forecasting" and len(chart_data) >= 2 and not use_count:
            values = [float(row[measure_label]) for row in chart_data]
            ordered_values = values
            x_values = list(range(len(ordered_values)))
            mean_x = statistics.mean(x_values)
            mean_y = statistics.mean(ordered_values)
            denominator = sum((x - mean_x) ** 2 for x in x_values)
            slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_values, ordered_values)) / denominator if denominator else 0.0
            projection = ordered_values[-1] + slope
            chart_data.append({"category": "Forecast", measure_label: projection})
            metrics.append(KeyMetric(label=f"Next-period {metric} estimate", value=_money(projection), change="Linear extrapolation"))
            summary += f" A simple linear extrapolation estimates the next period at {_money(projection)}; this is directional, not a causal forecast."
        chart = build_chart_spec(chart_data, f"{metric} by {dimension.replace('__period', 'period')}", "category", measure_label, intent)
        return {"metrics": metrics, "data": rows, "summary": summary, "rows": int(sum(row["row_count"] for row in rows)), "chart": chart, "metric": metric}

    values = parsed_metric.dropna()
    total = float(values.sum()) if not values.empty else 0.0
    metric_data = [{"metric": metric, "total": total, "average": float(values.mean()) if not values.empty else 0.0}]
    metrics = [KeyMetric(label=f"Total {metric}", value=_money(total), change=f"{len(frame):,} rows")]
    if not values.empty:
        metrics.append(KeyMetric(label=f"Average {metric}", value=_money(float(values.mean())), change=f"{len(values):,} values"))
    chart = build_chart_spec(metric_data, f"{metric} summary", "metric", "total", intent)
    return {"metrics": metrics, "data": metric_data, "summary": f"Across {len(frame):,} rows in {source.filename}, {metric} totals {_money(total)} and averages {_money(float(values.mean())) if not values.empty else '0'}.", "rows": len(frame), "chart": chart, "metric": metric}


def _retrieve_chunks(session: Session, workspace_id: str, query: str, limit: int = 5) -> list[tuple[DocumentChunk, float]]:
    chunks = session.scalars(select(DocumentChunk).where(DocumentChunk.workspace_id == workspace_id)).all()
    if not chunks:
        return []
    query_vector, provider = embed_texts_with_provider([query])
    query_tokens = _tokens(query)
    scored = []
    for chunk in chunks:
        chunk_tokens = _tokens(chunk.content)
        lexical = len(query_tokens & chunk_tokens) / max(len(query_tokens), 1)
        semantic = cosine_similarity(query_vector[0], chunk.embedding) if chunk.embedding_provider == provider else 0.0
        score = 0.65 * lexical + 0.35 * max(semantic, 0.0)
        if score > 0:
            scored.append((chunk, min(1.0, score)))
    scored.sort(key=lambda item: item[1], reverse=True)
    if scored:
        return scored[:limit]
    return [(chunk, 0.0) for chunk in chunks[: min(limit, len(chunks))]]


def _document_frequency_chart(retrieved: list[tuple[DocumentChunk, float]]) -> ChartSpec | None:
    frequencies: dict[str, int] = {}
    for chunk, _ in retrieved:
        for token in _tokens(chunk.content):
            frequencies[token] = frequencies.get(token, 0) + 1
    top = sorted(frequencies.items(), key=lambda item: (-item[1], item[0]))[:10]
    if not top:
        return None
    return ChartSpec(
        type="bar",
        title="Frequent terms in retrieved passages",
        x_axis="Term",
        y_axis="Chunk occurrences",
        data=[{"term": term, "occurrences": count} for term, count in top],
    )


def _gemini_summary(query: str, facts: str, grounded_text: str, deterministic: str) -> str:
    if not GEMINI_API_KEY:
        return deterministic
    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = (
            "Summarize the answer to the user's question in at most 4 concise sentences. "
            "Use only the verified computed facts and quoted evidence below. Do not introduce numbers, names, or causes absent from them. "
            "Return JSON only: {\"summary\": string}.\n"
            f"Question: {query}\nVerified facts: {facts}\nEvidence: {grounded_text}"
        )
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json", "temperature": 0.1},
        )
        parsed = json.loads(response.text or "{}")
        candidate = str(parsed.get("summary", "")).strip()
        context = f"{facts} {grounded_text}".lower()
        candidate_numbers = re.findall(r"\b\d[\d,.]*(?:%|m|k)?\b", candidate.lower())
        if not candidate or any(number not in context for number in candidate_numbers):
            return deterministic
        return candidate
    except Exception:
        return deterministic


def _recommendation_payload(recommendation) -> RecommendationPayload:
    return RecommendationPayload(
        id=recommendation.id,
        title=recommendation.title,
        rationale=recommendation.rationale,
        expected_impact=recommendation.expected_impact,
        risk=recommendation.risk,
        effort=recommendation.effort,
        confidence=recommendation.confidence,
        status=recommendation.status,
    )


def answer_query(session: Session, workspace_id: str, query: str) -> AskResponse:
    sources = session.scalars(select(Source).where(Source.workspace_id == workspace_id).order_by(Source.created_at)).all()
    tables = [source for source in sources if source.source_type == "table"]
    documents = [source for source in sources if source.source_type in {"pdf", "text"}]
    intent = classify_intent(query, bool(tables), bool(documents))
    query_tokens = _tokens(query)

    scored_sources = []
    for source in tables:
        schema_names = [column.get("name", "") for column in (source.schema_info or [])]
        searchable = f"{source.filename} {' '.join(schema_names)}".lower()
        score = sum(token in searchable for token in query_tokens)
        scored_sources.append((source, score))
    relevant_sources = [source for source, _ in sorted(scored_sources, key=lambda item: item[1], reverse=True)[:3]]

    table_results = []
    evidence: list[EvidenceItem] = []
    for source in relevant_sources:
        try:
            frame = read_structured_file(source.stored_path, ".xlsx" if source.stored_path.lower().endswith((".xlsx", ".xls")) else ".csv", source.sheet_name)
        except Exception:
            continue
        result = _table_analysis(source, frame, query, intent)
        if result.get("rows"):
            table_results.append((source, result))
            evidence.append(EvidenceItem(
                source_type="csv" if source.stored_path.lower().endswith(".csv") else "excel",
                file_name=source.filename,
                rows_matched=int(result["rows"]),
                snippet=f"{result['summary']} ({source.profile.get('row_count', 0)} source rows).",
            ))

    retrieved = _retrieve_chunks(session, workspace_id, query)
    for chunk, similarity in retrieved:
        source = session.get(Source, chunk.source_id)
        if not source:
            continue
        evidence.append(EvidenceItem(
            source_type=source.source_type,
            file_name=source.filename,
            page=chunk.page_number,
            snippet=chunk.content[:600],
            similarity=round(similarity, 4),
        ))

    query_id = str(uuid4())
    best_table = table_results[0][1] if table_results else None
    key_metrics = best_table["metrics"] if best_table else []
    chart_spec = best_table["chart"] if best_table else _document_frequency_chart(retrieved)
    deterministic_summaries = [result["summary"] for _, result in table_results]
    document_fact = " ".join(
        f"{item.file_name} page {item.page}: {item.snippet}" for item in evidence if item.page is not None
    )
    if document_fact:
        deterministic_summaries.append(f"Retrieved document evidence: {document_fact[:900]}")
    deterministic = " ".join(deterministic_summaries) or "No uploaded sources are available in this workspace. Upload a CSV, Excel, PDF, or text file to begin."
    facts = " ".join(result["summary"] for _, result in table_results)
    summary = _gemini_summary(query, facts or deterministic, document_fact, deterministic)

    total_sources = max(1, len(sources))
    covered_sources = len({item.file_name for item in evidence})
    coverage = covered_sources / total_sources
    retrieval_scores = [item.similarity or 0.0 for item in evidence if item.page is not None]
    retrieval_quality = statistics.mean(retrieval_scores) if retrieval_scores else (1.0 if table_results else 0.0)
    confidence = round(min(0.99, max(0.1, 0.2 + 0.45 * coverage + 0.35 * retrieval_quality)), 2)

    recommendations = create_query_recommendations(
        session=session,
        workspace_id=workspace_id,
        query_id=query_id,
        query=query,
        summary=summary,
        key_metrics=key_metrics,
        evidence=evidence,
        confidence=confidence,
    )
    return AskResponse(
        query_id=query_id,
        summary=summary,
        key_metrics=key_metrics,
        chart_spec=chart_spec,
        evidence=evidence,
        confidence=confidence,
        recommendations=[_recommendation_payload(item) for item in recommendations],
    )
