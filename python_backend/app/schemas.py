from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SourceProfile(BaseModel):
    source_id: str
    file_name: str
    source_type: str
    rows: int | None = None
    pages: int | None = None
    profile: dict[str, Any]


class UploadResponse(BaseModel):
    workspace_id: str
    sources: list[SourceProfile]


class AskRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)


class KeyMetric(BaseModel):
    label: str
    value: str
    change: str | None = None


class ChartSpec(BaseModel):
    type: Literal["line", "bar", "pie", "scatter", "heatmap", "kpi"]
    title: str
    x_axis: str | None = None
    y_axis: str | None = None
    data: list[dict[str, Any]] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    source_type: str
    file_name: str
    rows_matched: int | None = None
    page: int | None = None
    snippet: str | None = None
    similarity: float | None = None


class RecommendationPayload(BaseModel):
    id: str
    title: str
    rationale: str
    expected_impact: str
    risk: str
    effort: str
    confidence: float
    status: str


class AskResponse(BaseModel):
    query_id: str
    summary: str
    key_metrics: list[KeyMetric]
    chart_spec: ChartSpec | None
    evidence: list[EvidenceItem]
    confidence: float
    recommendations: list[RecommendationPayload]


class RecommendationReview(BaseModel):
    action: Literal["APPROVED", "EDITED_APPROVED", "REJECTED"]
    reviewer: str = Field(min_length=1, max_length=255)
    reviewer_notes: str | None = None
    title: str | None = Field(default=None, max_length=300)
    rationale: str | None = None
    expected_impact: str | None = None
    risk: str | None = None
    effort: str | None = None


class RecommendationOut(RecommendationPayload):
    model_config = ConfigDict(from_attributes=True)
    workspace_id: str
    query_id: str
    reviewer: str | None = None
    reviewer_notes: str | None = None
