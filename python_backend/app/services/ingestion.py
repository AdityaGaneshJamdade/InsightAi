from __future__ import annotations

import hashlib
import csv
import re
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import CHUNK_OVERLAP_WORDS, CHUNK_WORDS, MAX_UPLOAD_BYTES, UPLOAD_DIR
from app.models import DocumentChunk, Source
from app.services.embeddings import embed_texts_with_provider

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf", ".txt"}
CURRENCY_SYMBOLS = re.compile(r"[$€£¥,\s]")


def _safe_component(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def _detect_header(rows: pd.DataFrame) -> int:
    for index in range(min(len(rows), 15)):
        values = [str(value).strip() for value in rows.iloc[index].tolist() if pd.notna(value) and str(value).strip()]
        if len(values) < 2:
            continue
        unique_ratio = len({value.lower() for value in values}) / len(values)
        following = rows.iloc[index + 1 : min(index + 6, len(rows))]
        has_data = not following.dropna(how="all").empty
        if unique_ratio >= 0.8 and has_data and not all(re.fullmatch(r"[-+]?\d+(\.\d+)?", value) for value in values):
            return index
    return 0


def _detect_csv_delimiter(path: Path) -> str:
    sample = path.read_text(encoding="utf-8-sig", errors="replace")[:65536]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except csv.Error:
        lines = [line for line in sample.splitlines()[:30] if line.strip()]
        candidates = [",", ";", "\t", "|"]
        return max(candidates, key=lambda delimiter: sum(line.count(delimiter) for line in lines))


def _read_csv(path: Path, header: int | None = None, nrows: int | None = None) -> pd.DataFrame:
    delimiter = _detect_csv_delimiter(path)
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as csv_file:
        rows = list(csv.reader(csv_file, delimiter=delimiter))
    if not rows:
        return pd.DataFrame()
    width = max(len(row) for row in rows)
    padded_rows = [row + [None] * (width - len(row)) for row in rows]
    if header is None:
        preview_rows = padded_rows[:nrows] if nrows else padded_rows
        return pd.DataFrame(preview_rows)
    if header >= len(padded_rows):
        return pd.DataFrame()

    names = [str(value).strip() if value is not None and str(value).strip() else f"column_{index + 1}" for index, value in enumerate(padded_rows[header])]
    occurrences: dict[str, int] = {}
    unique_names = []
    for name in names:
        count = occurrences.get(name, 0)
        occurrences[name] = count + 1
        unique_names.append(name if count == 0 else f"{name}.{count}")
    records = padded_rows[header + 1 :]
    if nrows is not None:
        records = records[:nrows]
    return pd.DataFrame(records, columns=unique_names)


def _normalize_column(series: pd.Series, column_name: str) -> tuple[pd.Series, str, str]:
    clean_name = str(column_name).strip()
    semantic_name = re.sub(r"[^a-z0-9]+", "_", clean_name.lower()).strip("_")
    non_null = series.dropna()
    if non_null.empty:
        return series, "unknown", "unknown"

    if pd.api.types.is_bool_dtype(series):
        return series, "boolean", "boolean"

    if pd.api.types.is_numeric_dtype(series):
        normalized = pd.to_numeric(series, errors="coerce")
        inferred_type = "integer" if (normalized.dropna() % 1 == 0).all() else "number"
    else:
        values = series.astype("string").str.strip()
        numeric_candidate = values.str.replace(r"^\((.*)\)$", r"-\1", regex=True).str.replace(CURRENCY_SYMBOLS, "", regex=True)
        normalized = pd.to_numeric(numeric_candidate, errors="coerce")
        numeric_ratio = normalized.notna().mean()
        currency_named = bool(re.search(r"currency|revenue|sales|price|amount|cost|profit|arr|mrr", semantic_name))
        if numeric_ratio >= 0.8 and (currency_named or normalized.notna().sum() > 1):
            series = normalized
            inferred_type = "number"
        else:
            date_named = bool(re.search(r"date|time|timestamp|_at$", semantic_name))
            dates = pd.to_datetime(values, errors="coerce", format="mixed", utc=True)
            if date_named and dates.notna().mean() >= 0.6:
                series = dates
                inferred_type = "datetime"
            elif values.str.lower().isin(["true", "false", "yes", "no"]).mean() >= 0.8:
                series = values.str.lower().isin(["true", "yes"])
                inferred_type = "boolean"
            else:
                series = values
                inferred_type = "string"

    if re.search(r"email|e_mail", semantic_name):
        semantic = "email"
    elif re.search(r"country|region|city|state|address", semantic_name):
        semantic = "geography"
    elif re.search(r"date|time|quarter|month|year", semantic_name):
        semantic = "time"
    elif re.search(r"revenue|sales|price|amount|cost|profit|arr|mrr|currency", semantic_name):
        semantic = "currency"
    elif re.search(r"id|uuid|code|key", semantic_name):
        semantic = "identifier"
    elif inferred_type in {"number", "integer"}:
        semantic = "measure"
    elif inferred_type == "boolean":
        semantic = "boolean"
    else:
        semantic = "category"
    return series, inferred_type, semantic


def _profile_dataframe(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    frame = frame.copy()
    columns: list[dict[str, Any]] = []
    for column in list(frame.columns):
        normalized, data_type, semantic = _normalize_column(frame[column], str(column))
        frame[column] = normalized
        total = len(frame)
        null_count = int(frame[column].isna().sum())
        columns.append({
            "name": str(column),
            "data_type": data_type,
            "semantic_type": semantic,
            "null_count": null_count,
            "null_percent": round((null_count / total) * 100, 2) if total else 0.0,
            "distinct_count": int(frame[column].nunique(dropna=True)),
        })
    profile = {"row_count": int(len(frame)), "column_count": int(len(frame.columns)), "columns": columns}
    return frame, columns, profile


def read_structured_file(path: str | Path, extension: str, sheet_name: str | None = None) -> pd.DataFrame:
    file_path = Path(path)
    if extension == ".csv":
        preview = _read_csv(file_path, header=None, nrows=20)
        header = _detect_header(preview)
        frame = _read_csv(file_path, header=header)
    else:
        preview = pd.read_excel(file_path, sheet_name=sheet_name or 0, header=None, nrows=20)
        header = _detect_header(preview)
        frame = pd.read_excel(file_path, sheet_name=sheet_name or 0, header=header)
    frame = frame.dropna(how="all").reset_index(drop=True)
    frame.columns = [str(column).strip() or f"column_{index + 1}" for index, column in enumerate(frame.columns)]
    frame, _, _ = _profile_dataframe(frame)
    return frame


def _chunk_text(text: str, page_number: int | None) -> list[tuple[str, int | None]]:
    words = text.split()
    if not words:
        return []
    stride = CHUNK_WORDS - CHUNK_OVERLAP_WORDS
    chunks = []
    for start in range(0, len(words), stride):
        chunk_words = words[start : start + CHUNK_WORDS]
        if not chunk_words:
            break
        chunks.append((" ".join(chunk_words), page_number))
        if start + CHUNK_WORDS >= len(words):
            break
    return chunks


def _clean_native(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value


async def ingest_uploads(workspace_id: str, files: list[UploadFile], session: Session) -> list[Source]:
    if not files:
        raise HTTPException(status_code=400, detail="Select at least one file to upload")

    workspace_dir = UPLOAD_DIR / _safe_component(workspace_id)
    workspace_dir.mkdir(parents=True, exist_ok=True)
    created_sources: list[Source] = []
    written_paths: list[Path] = []

    def rollback_batch() -> None:
        session.rollback()
        for path in written_paths:
            path.unlink(missing_ok=True)

    for upload in files:
        original_name = Path(upload.filename or "upload").name
        extension = Path(original_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            rollback_batch()
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {extension or 'unknown'}")

        content = await upload.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            rollback_batch()
            raise HTTPException(status_code=413, detail=f"{original_name} exceeds the upload size limit")
        stored_path = workspace_dir / f"{uuid.uuid4().hex}{extension}"
        stored_path.write_bytes(content)
        written_paths.append(stored_path)

        try:
            if extension in {".csv", ".xlsx", ".xls"}:
                if extension == ".csv":
                    preview = _read_csv(stored_path, header=None, nrows=20)
                    header = _detect_header(preview)
                    frames = {None: _read_csv(stored_path, header=header)}
                else:
                    preview_sheets = pd.read_excel(stored_path, sheet_name=None, header=None, nrows=20)
                    frames = {}
                    for sheet, preview in preview_sheets.items():
                        header = _detect_header(preview)
                        frames[sheet] = pd.read_excel(stored_path, sheet_name=sheet, header=header)

                for sheet, frame in frames.items():
                    frame = frame.dropna(how="all").reset_index(drop=True)
                    frame.columns = [str(column).strip() or f"column_{index + 1}" for index, column in enumerate(frame.columns)]
                    frame, schema_info, profile = _profile_dataframe(frame)
                    source = Source(
                        workspace_id=workspace_id,
                        filename=original_name,
                        source_type="table",
                        stored_path=str(stored_path),
                        sheet_name=sheet,
                        schema_info=schema_info,
                        profile=profile,
                    )
                    session.add(source)
                    created_sources.append(source)
            else:
                pages: list[tuple[int | None, str]] = []
                if extension == ".pdf":
                    with pdfplumber.open(stored_path) as pdf:
                        for page_index, page in enumerate(pdf.pages, start=1):
                            page_text = page.extract_text() or ""
                            tables = page.extract_tables() or []
                            table_text = [" | ".join(str(cell or "") for cell in row) for table in tables for row in table]
                            combined = "\n".join(part for part in (page_text, "\n".join(table_text)) if part.strip())
                            pages.append((page_index, combined))
                else:
                    text = content.decode("utf-8-sig", errors="replace")
                    pages.append((1, text))

                extracted_text = "\n\n".join(text for _, text in pages).strip()
                chunks = [chunk for page_number, page_text in pages for chunk in _chunk_text(page_text, page_number)]
                vectors, embedding_provider = embed_texts_with_provider([chunk_text for chunk_text, _ in chunks])
                source = Source(
                    workspace_id=workspace_id,
                    filename=original_name,
                    source_type="pdf" if extension == ".pdf" else "text",
                    stored_path=str(stored_path),
                    extracted_text=extracted_text,
                    profile={
                        "page_count": len(pages) if extension == ".pdf" else None,
                        "word_count": len(extracted_text.split()),
                        "chunk_count": len(chunks),
                        "character_count": len(extracted_text),
                        "tables_extracted": extension == ".pdf",
                    },
                )
                session.add(source)
                session.flush()
                session.add_all([
                    DocumentChunk(
                        workspace_id=workspace_id,
                        source_id=source.id,
                        chunk_index=index,
                        page_number=page_number,
                        content=chunk_text,
                        embedding=vectors[index - 1],
                        embedding_provider=embedding_provider,
                    )
                    for index, (chunk_text, page_number) in enumerate(chunks, start=1)
                ])
                created_sources.append(source)
        except HTTPException:
            rollback_batch()
            raise
        except Exception as error:
            rollback_batch()
            raise HTTPException(status_code=422, detail=f"Could not process {original_name}: {error}") from error

    try:
        session.commit()
        for source in created_sources:
            session.refresh(source)
    except Exception:
        rollback_batch()
        raise
    return created_sources
