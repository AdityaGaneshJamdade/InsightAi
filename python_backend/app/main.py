from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.database import get_session, init_database
from app.models import Recommendation, Source
from app.schemas import AskRequest, AskResponse, RecommendationOut, RecommendationReview, SourceProfile, UploadResponse
from app.services.analysis import answer_query
from app.services.ingestion import ingest_uploads
from app.services.recommendations import list_audit_events, list_recommendations, review_recommendation


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="InsightAI Backend",
    version="1.0.0",
    description="Workspace-scoped file ingestion, grounded business analysis, chart specifications, and auditable review workflows.",
    lifespan=lifespan,
)

SessionDependency = Annotated[Session, Depends(get_session)]


def _validate_workspace(workspace_id: str) -> str:
    value = workspace_id.strip()
    if not value or len(value) > 128 or any(ord(character) < 32 for character in value):
        raise HTTPException(status_code=400, detail="Workspace ID must be 1-128 printable characters")
    return value


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "gemini_configured": bool(GEMINI_API_KEY), "model": GEMINI_MODEL}


@app.post("/workspaces/{workspace_id}/sources/upload", response_model=UploadResponse, status_code=201)
async def upload_sources(
    workspace_id: str,
    session: SessionDependency,
    files: Annotated[list[UploadFile], File(description="One or more CSV, Excel, PDF, or text files")],
) -> UploadResponse:
    workspace_id = _validate_workspace(workspace_id)
    sources = await ingest_uploads(workspace_id, files, session)
    return UploadResponse(
        workspace_id=workspace_id,
        sources=[
            SourceProfile(
                source_id=source.id,
                file_name=source.filename,
                source_type=source.source_type,
                rows=source.profile.get("row_count"),
                pages=source.profile.get("page_count"),
                profile=source.profile,
            )
            for source in sources
        ],
    )


@app.get("/workspaces/{workspace_id}/sources", response_model=list[SourceProfile])
def get_sources(workspace_id: str, session: SessionDependency) -> list[SourceProfile]:
    workspace_id = _validate_workspace(workspace_id)
    sources = session.scalars(
        select(Source).where(Source.workspace_id == workspace_id).order_by(Source.created_at.asc())
    ).all()
    return [
        SourceProfile(
            source_id=source.id,
            file_name=source.filename,
            source_type=source.source_type,
            rows=source.profile.get("row_count"),
            pages=source.profile.get("page_count"),
            profile=source.profile,
        )
        for source in sources
    ]


@app.post("/workspaces/{workspace_id}/ask", response_model=AskResponse)
def ask(workspace_id: str, request: AskRequest, session: SessionDependency) -> AskResponse:
    workspace_id = _validate_workspace(workspace_id)
    return answer_query(session, workspace_id, request.query.strip())


@app.get("/workspaces/{workspace_id}/recommendations", response_model=list[RecommendationOut])
def get_recommendations(workspace_id: str, session: SessionDependency) -> list[RecommendationOut]:
    workspace_id = _validate_workspace(workspace_id)
    return [RecommendationOut.model_validate(item) for item in list_recommendations(session, workspace_id)]


@app.patch("/workspaces/{workspace_id}/recommendations/{recommendation_id}", response_model=RecommendationOut)
def update_recommendation(
    workspace_id: str,
    recommendation_id: str,
    request: RecommendationReview,
    session: SessionDependency,
) -> RecommendationOut:
    workspace_id = _validate_workspace(workspace_id)
    try:
        recommendation = review_recommendation(
            session=session,
            workspace_id=workspace_id,
            recommendation_id=recommendation_id,
            action=request.action,
            reviewer=request.reviewer,
            reviewer_notes=request.reviewer_notes,
            edits={
                "title": request.title,
                "rationale": request.rationale,
                "expected_impact": request.expected_impact,
                "risk": request.risk,
                "effort": request.effort,
            },
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if recommendation is None:
        raise HTTPException(status_code=404, detail="Recommendation not found in this workspace")
    return RecommendationOut.model_validate(recommendation)


@app.get("/workspaces/{workspace_id}/audit")
def get_audit_events(
    workspace_id: str,
    session: SessionDependency,
    recommendation_id: str | None = None,
) -> list[dict[str, object]]:
    workspace_id = _validate_workspace(workspace_id)
    return [
        {
            "id": event.id,
            "recommendation_id": event.recommendation_id,
            "actor": event.actor,
            "action": event.action,
            "previous_status": event.previous_status,
            "new_status": event.new_status,
            "details": event.details,
            "created_at": event.created_at,
        }
        for event in list_audit_events(session, workspace_id, recommendation_id)
    ]
