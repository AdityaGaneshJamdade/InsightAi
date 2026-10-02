from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, Recommendation, utc_now
from app.schemas import EvidenceItem, KeyMetric


def create_query_recommendations(
    session: Session,
    workspace_id: str,
    query_id: str,
    query: str,
    summary: str,
    key_metrics: list[KeyMetric],
    evidence: list[EvidenceItem],
    confidence: float,
) -> list[Recommendation]:
    if not evidence:
        return []
    anchor = key_metrics[0] if key_metrics else None
    source_names = ", ".join(dict.fromkeys(item.file_name for item in evidence))
    source_context = source_names or "uploaded sources"
    title = f"Validate {anchor.label.lower()} finding" if anchor else "Validate evidence before acting"
    rationale = f"The query ‘{query}’ produced this grounded finding: {summary[:800]}"
    primary = Recommendation(
        workspace_id=workspace_id,
        query_id=query_id,
        title=title[:300],
        rationale=rationale,
        expected_impact=f"Enable a source-verified decision based on {source_context}.",
        risk="Acting before confirming the source values or document context may lead to an incorrect decision.",
        effort="Medium",
        confidence=confidence,
        status="PENDING_REVIEW",
    )
    recommendations = [primary]
    if key_metrics and evidence:
        recommendations.append(Recommendation(
            workspace_id=workspace_id,
            query_id=query_id,
            title=f"Review source evidence for {key_metrics[-1].label.lower()}"[:300],
            rationale=f"Cross-check {key_metrics[-1].label}: {key_metrics[-1].value} against {source_context} before approval.",
            expected_impact="Improve data quality and maintain an auditable decision trail.",
            risk="A stale or incomplete source can change the measured result.",
            effort="Low",
            confidence=max(0.1, confidence - 0.05),
            status="PENDING_REVIEW",
        ))

    session.add_all(recommendations)
    session.flush()
    session.add_all([
        AuditEvent(
            workspace_id=workspace_id,
            recommendation_id=item.id,
            actor="InsightAI",
            action="CREATED",
            previous_status="DRAFT",
            new_status="PENDING_REVIEW",
            details={"query_id": query_id, "query": query},
            created_at=utc_now(),
        )
        for item in recommendations
    ])
    session.commit()
    return recommendations


def list_recommendations(session: Session, workspace_id: str) -> list[Recommendation]:
    return session.scalars(
        select(Recommendation)
        .where(Recommendation.workspace_id == workspace_id)
        .order_by(Recommendation.created_at.desc())
    ).all()


def review_recommendation(
    session: Session,
    workspace_id: str,
    recommendation_id: str,
    action: str,
    reviewer: str,
    reviewer_notes: str | None,
    edits: dict[str, str | None],
) -> Recommendation | None:
    recommendation = session.scalar(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.workspace_id == workspace_id,
        )
    )
    if recommendation is None:
        return None
    if recommendation.status != "PENDING_REVIEW":
        raise ValueError(f"Cannot review a recommendation in {recommendation.status} status")

    previous_status = recommendation.status
    if action == "EDITED_APPROVED":
        for field in ("title", "rationale", "expected_impact", "risk", "effort"):
            value = edits.get(field)
            if value is not None and value.strip():
                setattr(recommendation, field, value.strip())
    recommendation.status = action
    recommendation.reviewer = reviewer.strip()
    recommendation.reviewer_notes = reviewer_notes
    recommendation.updated_at = utc_now()
    session.add(AuditEvent(
        workspace_id=workspace_id,
        recommendation_id=recommendation.id,
        actor=reviewer.strip(),
        action=action,
        previous_status=previous_status,
        new_status=action,
        details={"reviewer_notes": reviewer_notes, "edits": {key: value for key, value in edits.items() if value}},
        created_at=utc_now(),
    ))
    session.commit()
    session.refresh(recommendation)
    return recommendation


def list_audit_events(session: Session, workspace_id: str, recommendation_id: str | None = None) -> list[AuditEvent]:
    query = select(AuditEvent).where(AuditEvent.workspace_id == workspace_id)
    if recommendation_id:
        query = query.where(AuditEvent.recommendation_id == recommendation_id)
    return session.scalars(query.order_by(AuditEvent.created_at.asc())).all()
