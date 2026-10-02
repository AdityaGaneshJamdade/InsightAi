# InsightAI – AI Decision Engine for Business Data

An enterprise-grade decision intelligence web application prototype that ingests multi-source business data (structured CSV/Excel spreadsheets and unstructured PDF/Text operational documents), answers natural language questions with verified row/line evidence trails, renders dynamic interactive visualizations, and enforces a **Human-in-the-Loop Approval Workflow** before final executive export.

Inspired by **ThoughtSpot** and **Tableau Pulse** interfaces.

---

## 🚀 Key Functional Architecture

1. **Multi-Source Upload Portal**:
   - Ingestion of structured spreadsheets (`.csv`, `.xlsx`, `.xls`) with automatic schema extraction, row counting, and numeric column distribution statistics (min, max, mean, sum).
   - Ingestion of unstructured documents (`.pdf`, `.txt`, `.md`) with semantic paragraph chunking, line counting, and page anchors.
   - 1-Click "Load Enterprise Datasets" pre-populates three real-world business scenarios:
     - `Regional_Sales_Operations_2024.csv` (100+ data points tracking quarterly regional performance across EMEA, NA, APAC, LATAM).
     - `Customer_Churn_&_Support_Logs.xlsx` (Multi-sheet workbook tracking Tier-1 ARR loss, CSAT, and critical SLA breaches).
     - `Executive_Q3_Business_Review.pdf` (Confidential executive filing detailing Rotterdam port strikes, German customs tariff impoundments, and cloud hosting cost surges).

2. **Natural Language Query Interface**:
   - Conversational search bar allowing users to ask complex business questions (e.g., *"Why did regional sales drop in Q3?"*, *"Which tier-1 enterprise clients churned and why?"*).
   - Suggested prompts for fast testing across finance, logistics, customer success, and cloud gross margins.
   - Step-by-step reasoning transparency displaying data ingestion, cross-source corroboration, and synthesis stages.

3. **Explainable Evidence & Insights Panel**:
   - Executive takeaway headline & synthesized multi-source narrative.
   - Grounded KPI metric cards with directional deltas (e.g., `-€7.7M EMEA Delta`, `26.4 Days Avg Shipping Delay`, `7.4% / 11.5% Return Rate Surge`).
   - Dynamic charts (grouped multi-series bars, trend lines, donut breakdowns) with view toggle to raw data tables.
   - **Verifiable Evidence Trail**: Explicit citations quoting exact table row numbers (`Row #10`) or PDF clauses (`Page 1, Lines 14-22`), with confidence score gauges, relevance rationales, and an interactive "Inspect Source" modal.

4. **Human-in-the-Loop Approval Workflow**:
   - Every AI-formulated recommendation enters a review queue with status: `Pending Review`.
   - Business owners can explicitly **Approve**, **Edit** (adjust title, strategic directives, impact, urgency, and reviewer notes), or **Reject** with a recorded rationale.
   - Approved decisions can be exported into an **Executive Decision Brief (Markdown)**, **Audit CSV**, or **System JSON**.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons, Plus Jakarta Sans typography.
- **Backend**: Node.js & Express server with TypeScript (`tsx`), Vite middlewares mounted in dev mode.
- **File Parsing**: `xlsx` (SheetJS) for CSV & Excel workbooks; `pdf-parse` for PDF document text extraction; `multer` for in-memory streaming uploads.
- **AI / Processing**: `@google/genai` TypeScript SDK utilizing `gemini-3.8-flash` with telemetry headers; hybrid RAG retrieval pipeline with tabular indexing and token-overlap scoring.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```bash
# GEMINI_API_KEY: Attached automatically in AI Studio or provide your Google Gemini API key
GEMINI_API_KEY="your-gemini-api-key"

# APP_URL: Optional host URL
APP_URL="http://localhost:3000"
```

> **Note**: InsightAI includes a deterministic local reasoning engine so the entire prototype remains fully operational even if an API key is not supplied or during network offline scenarios.

---

## 📦 Execution & Setup Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000`.

3. **Build for Production**:
   ```bash
   npm run build
   npm run start
   ```

## Optional Python API Backend

The standalone FastAPI backend is in [`python_backend/`](python_backend/README.md). It adds persistent workspace-scoped CSV/Excel/PDF/TXT ingestion, DuckDB-backed analysis, chart specifications, and auditable recommendation reviews without replacing the existing Node API.

Run it from `python_backend/` with `uvicorn app.main:app --reload --port 8000`. Its OpenAPI UI is available at `http://localhost:8000/docs`.

---

## 📝 Verification Workflow

1. Navigate to the **Pulse & Query** tab. Click on *"Why did regional sales drop in Q3?"* to see real-time synthesis across the sales CSV and the executive review PDF.
2. Expand the **Explainable Evidence Trail** and click **Inspect** on any citation to verify the verbatim source row or document clause.
3. Switch to the **Review Queue** tab. Approve or Edit a recommendation, assign an executive owner, and click **Export Approved Decisions** to download the signed-off executive briefing.
