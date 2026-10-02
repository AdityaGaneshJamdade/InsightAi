# InsightAI Python Backend

This service runs alongside the existing Node/React application. It does not replace or modify the current Express API.

## Requirements

- Python 3.11 or newer
- PostgreSQL with the `vector` extension for multi-user production deployments; SQLite is the zero-configuration local default.
- Gemini API key is optional. The service uses deterministic local embeddings and grounded summaries when it is absent or unavailable.

## Run Locally

From this directory:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set `GEMINI_API_KEY` in `.env` to enable Gemini 2.5 Flash summaries and `text-embedding-005` embeddings. Never commit the populated `.env` file.

For PostgreSQL, set `DATABASE_URL` to a SQLAlchemy URL such as `postgresql+psycopg://user:password@localhost:5432/insightai`. The service enables pgvector at startup and stores 768-dimensional embeddings in the vector column. SQLite stores the same vectors as JSON for local development.

## API

- `POST /workspaces/{id}/sources/upload` - multipart `files` upload; supports CSV, XLSX, XLS, PDF, and TXT.
- `GET /workspaces/{id}/sources` - inspect uploaded source profiles.
- `POST /workspaces/{id}/ask` - body `{"query":"..."}`; returns summary, metrics, chart spec, evidence, confidence, and recommendations.
- `GET /workspaces/{id}/recommendations` - list review items.
- `PATCH /workspaces/{id}/recommendations/{recommendation_id}` - review with `APPROVED`, `EDITED_APPROVED`, or `REJECTED`.
- `GET /workspaces/{id}/audit` - read the append-only recommendation audit history.
- `GET /health` - service and Gemini configuration status.

Open `/docs` on port 8000 for the interactive API documentation.

## Test

```powershell
python -m pytest
```
