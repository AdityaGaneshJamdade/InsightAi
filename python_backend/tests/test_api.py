from __future__ import annotations

import os
import tempfile
from io import BytesIO
from pathlib import Path

_test_data = Path(tempfile.mkdtemp(prefix="insightai-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_test_data / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_test_data / "uploads")
os.environ["GEMINI_API_KEY"] = ""

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.main import app


def test_multi_source_upload_ask_and_review_lifecycle() -> None:
    with TestClient(app) as client:
        csv_content = (
            "Quarterly sales report\n"
            "Category,Revenue,Quarter\n"
            "Hardware,12000,Q1\n"
            "Software,35000,Q1\n"
            "Services,8500,Q2\n"
        )
        pdf_buffer = BytesIO()
        pdf = canvas.Canvas(pdf_buffer)
        pdf.drawString(72, 720, "Revenue increased in Q1 as customer retention improved.")
        pdf.showPage()
        pdf.save()
        response = client.post(
            "/workspaces/acme/sources/upload",
            files=[
                ("files", ("sales.csv", csv_content, "text/csv")),
                ("files", ("notes.txt", "Revenue rose in Q1. Service costs were reviewed.", "text/plain")),
                ("files", ("review.pdf", pdf_buffer.getvalue(), "application/pdf")),
            ],
        )
        assert response.status_code == 201
        assert len(response.json()["sources"]) == 3
        table_profile = next(source["profile"] for source in response.json()["sources"] if source["file_name"] == "sales.csv")
        assert table_profile["row_count"] == 3
        assert table_profile["columns"][1]["semantic_type"] == "currency"

        result = client.post("/workspaces/acme/ask", json={"query": "summarize revenue by category"})
        assert result.status_code == 200
        payload = result.json()
        assert "55,500" in payload["summary"]
        assert payload["chart_spec"]["type"] == "bar"
        assert payload["chart_spec"]["data"][0]["category"] == "Software"
        assert payload["evidence"]
        assert any(item["source_type"] == "pdf" and item["page"] == 1 for item in payload["evidence"])
        assert payload["recommendations"]

        forecast = client.post("/workspaces/acme/ask", json={"query": "forecast revenue by quarter"}).json()
        assert forecast["chart_spec"]["type"] == "line"
        assert forecast["chart_spec"]["data"][-1]["category"] == "Forecast"
        assert any(metric["label"] == "Next-period Revenue estimate" for metric in forecast["key_metrics"])

        recommendation_id = payload["recommendations"][0]["id"]
        reviewed = client.patch(
            f"/workspaces/acme/recommendations/{recommendation_id}",
            json={
                "action": "EDITED_APPROVED",
                "reviewer": "reviewer@example.com",
                "title": "Verified revenue result",
                "reviewer_notes": "Checked against the uploaded source.",
            },
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "EDITED_APPROVED"

        audit = client.get("/workspaces/acme/audit", params={"recommendation_id": recommendation_id})
        assert audit.status_code == 200
        assert [event["action"] for event in audit.json()] == ["CREATED", "EDITED_APPROVED"]


def test_workspace_isolation() -> None:
    with TestClient(app) as client:
        response = client.get("/workspaces/other/sources")
        assert response.status_code == 200
        assert response.json() == []
