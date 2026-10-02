import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { dataStore } from './src/server/dataStore.js';
import { approvalStore } from './src/server/approvalStore.js';
import { queryReviewStore } from './src/server/queryReviewStore.js';
import { getGeminiStatus } from './src/server/gemini.js';
import { processNaturalLanguageQuery } from './src/server/ragEngine.js';
import { StructuredDataset, UnstructuredDataset, UnstructuredDocChunk, ColumnInfo, QueryAnalysisResult } from './src/server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || '';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

let pythonBackendStatus: { reachable: boolean; detail: string } = {
  reachable: false,
  detail: PYTHON_BACKEND_URL ? 'not checked yet' : 'not configured (optional)',
};

async function probePythonBackend(): Promise<void> {
  if (!PYTHON_BACKEND_URL) {
    pythonBackendStatus = { reachable: false, detail: 'not configured (optional)' };
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${PYTHON_BACKEND_URL.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    pythonBackendStatus = {
      reachable: response.ok,
      detail: response.ok ? 'reachable' : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    pythonBackendStatus = { reachable: false, detail: error?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  }
}

probePythonBackend();
setInterval(probePythonBackend, 60_000).unref();

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  const gemini = getGeminiStatus();
  const degraded = Boolean(gemini.configured && gemini.lastFailure);

  res.json({
    status: degraded ? 'degraded' : 'ok',
    hasGeminiKey: gemini.configured,
    geminiActiveModel: gemini.activeModel,
    geminiModelPool: gemini.models,
    geminiLastFailure: gemini.lastFailure,
    aiMode: gemini.activeModel ? 'live-model' : gemini.configured ? 'deterministic-fallback' : 'deterministic-fallback',
    pythonBackend: { url: PYTHON_BACKEND_URL || null, ...pythonBackendStatus },
    model: gemini.activeModel || gemini.models[0],
    structuredDatasetsCount: dataStore.getStructuredDatasets().length,
    unstructuredDatasetsCount: dataStore.getUnstructuredDatasets().length,
    approvalQueueCount: approvalStore.getAll().length,
  });
});

// 2. Datasets endpoint
app.get('/api/datasets', (req: Request, res: Response) => {
  res.json({
    structured: dataStore.getStructuredDatasets(),
    unstructured: dataStore.getUnstructuredDatasets(),
  });
});

// 3. Reset / Clear all datasets and approvals
app.post('/api/reset-sample', (req: Request, res: Response) => {
  dataStore.clearAll();
  approvalStore.clearAll();
  queryReviewStore.clearAll();
  res.json({
    success: true,
    message: 'All datasets and governance recommendations cleared.',
    structuredCount: 0,
    unstructuredCount: 0,
  });
});

app.post('/api/clear-all', (req: Request, res: Response) => {
  dataStore.clearAll();
  approvalStore.clearAll();
  queryReviewStore.clearAll();
  res.json({
    success: true,
    message: 'All datasets and approvals cleared.',
    structuredCount: 0,
    unstructuredCount: 0,
  });
});

// 4. Delete dataset
app.delete('/api/datasets/:id', (req: Request, res: Response) => {
  const success = dataStore.removeDataset(req.params.id);
  res.json({ success });
});

// 5. Multi-Source File Upload
app.post('/api/upload', upload.array('files'), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const processed = [];

  for (const file of files) {
    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const baseId = `ds-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
        // Parse with XLSX
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetsToProcess = workbook.SheetNames;

        for (let sIdx = 0; sIdx < sheetsToProcess.length; sIdx++) {
          const sheetName = sheetsToProcess[sIdx];
          const worksheet = workbook.Sheets[sheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (rawJson.length > 0) {
            const sampleRow = rawJson[0];
            const columns: ColumnInfo[] = Object.keys(sampleRow).map((key) => {
              const val = sampleRow[key];
              const type = typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'string';
              const sampleValues = rawJson.slice(0, 3).map((r) => r[key]);
              return { name: key, type, sampleValues };
            });

            // Calculate summary statistics
            const numericSummaries: Record<string, { min: number; max: number; mean: number; sum: number }> = {};
            columns.filter((c) => c.type === 'number').forEach((col) => {
              const nums = rawJson.map((r) => Number(r[col.name])).filter((n) => !isNaN(n));
              if (nums.length > 0) {
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                const sum = nums.reduce((a, b) => a + b, 0);
                const mean = sum / nums.length;
                numericSummaries[col.name] = { min, max, mean: Math.round(mean * 100) / 100, sum: Math.round(sum * 100) / 100 };
              }
            });

            const datasetId = sheetsToProcess.length > 1 ? `${baseId}-s${sIdx + 1}` : baseId;
            const displayName = sheetsToProcess.length > 1 ? `${originalName} (${sheetName})` : originalName;

            const dataset: StructuredDataset = {
              id: datasetId,
              name: displayName,
              type: ext === '.csv' ? 'csv' : 'excel',
              sheetName: sheetsToProcess.length > 1 ? sheetName : undefined,
              columns,
              rows: rawJson,
              rowCount: rawJson.length,
              uploadedAt: new Date().toISOString(),
              summaryStats: { numericSummaries },
            };

            dataStore.addStructuredDataset(dataset);
            processed.push({ name: displayName, type: dataset.type, rowCount: rawJson.length });
          }
        }
      } else if (ext === '.pdf') {
        // Robust PDF Parsing with pdf-parse v2 + fallback
        let pdfText = '';
        const chunks: UnstructuredDocChunk[] = [];

        try {
          const pdfModule = await import('pdf-parse');
          const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse || (pdfModule as any).default;

          if (typeof PDFParseClass === 'function') {
            const parser = new PDFParseClass({ data: file.buffer });
            const result = await parser.getText();

            if (result && Array.isArray(result.pages) && result.pages.length > 0) {
              pdfText = result.pages.map((p: any) => p.text || '').join('\n\n');
              result.pages.forEach((p: any, pIdx: number) => {
                const pageLines = (p.text || '').split(/\r?\n/).filter((l: string) => l.trim().length > 0);
                const chunkSize = 15;
                for (let i = 0; i < pageLines.length; i += chunkSize) {
                  const chunkLines = pageLines.slice(i, i + chunkSize);
                  chunks.push({
                    id: `chunk-${baseId}-p${p.num || pIdx + 1}-${Math.floor(i / chunkSize) + 1}`,
                    docId: baseId,
                    docName: originalName,
                    chunkIndex: chunks.length + 1,
                    text: chunkLines.join('\n'),
                    pageNumber: p.num || pIdx + 1,
                    startLine: i + 1,
                    endLine: Math.min(i + chunkSize, pageLines.length),
                  });
                }
              });
            } else if (result && typeof result.text === 'string') {
              pdfText = result.text;
            }
          }
        } catch (pdfErr) {
          console.warn('PDF parser note for', originalName, pdfErr);
          pdfText = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        }

        if (chunks.length === 0) {
          const lines = pdfText.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const chunkSize = 15;
          for (let i = 0; i < lines.length; i += chunkSize) {
            const chunkLines = lines.slice(i, i + chunkSize);
            chunks.push({
              id: `chunk-${baseId}-${Math.floor(i / chunkSize) + 1}`,
              docId: baseId,
              docName: originalName,
              chunkIndex: Math.floor(i / chunkSize) + 1,
              text: chunkLines.join('\n'),
              pageNumber: Math.floor(i / 30) + 1,
              startLine: i + 1,
              endLine: Math.min(i + chunkSize, lines.length),
            });
          }
        }

        const lines = pdfText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const dataset: UnstructuredDataset = {
          id: baseId,
          name: originalName,
          type: 'pdf',
          lineCount: lines.length,
          wordCount: pdfText.split(/\s+/).filter(Boolean).length,
          text: pdfText,
          chunks,
          uploadedAt: new Date().toISOString(),
        };

        dataStore.addUnstructuredDataset(dataset);
        processed.push({ name: originalName, type: 'pdf', wordCount: dataset.wordCount, lineCount: lines.length });
      } else {
        // Text / Markdown / JSON
        const textContent = file.buffer.toString('utf-8');
        const lines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const chunks: UnstructuredDocChunk[] = [];
        const chunkSize = 15;

        for (let i = 0; i < lines.length; i += chunkSize) {
          const chunkLines = lines.slice(i, i + chunkSize);
          chunks.push({
            id: `chunk-${baseId}-${Math.floor(i / chunkSize) + 1}`,
            docId: baseId,
            docName: originalName,
            chunkIndex: Math.floor(i / chunkSize) + 1,
            text: chunkLines.join('\n'),
            pageNumber: 1,
            startLine: i + 1,
            endLine: Math.min(i + chunkSize, lines.length),
          });
        }

        const dataset: UnstructuredDataset = {
          id: baseId,
          name: originalName,
          type: ext === '.md' ? 'markdown' : 'text',
          lineCount: lines.length,
          wordCount: textContent.split(/\s+/).filter(Boolean).length,
          text: textContent,
          chunks,
          uploadedAt: new Date().toISOString(),
        };

        dataStore.addUnstructuredDataset(dataset);
        processed.push({ name: originalName, type: dataset.type, wordCount: dataset.wordCount, lineCount: lines.length });
      }
    } catch (err: any) {
      console.error('Error processing file:', originalName, err);
      return res.status(500).json({ error: `Failed to process ${originalName}: ${err.message}` });
    }
  }

  res.json({
    success: true,
    processed,
    totalStructured: dataStore.getStructuredDatasets().length,
    totalUnstructured: dataStore.getUnstructuredDatasets().length,
  });
});

// 6. Natural Language Query
app.post('/api/query', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Valid query parameter is required' });
  }

  try {
    const analysis = await processNaturalLanguageQuery(query.trim());

    // Automatically push actionable recommendations into the Human-in-the-Loop review queue!
    // Skipped when this queryId already produced cards, so re-running a query does not duplicate them.
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      approvalStore.addManyForQuery(analysis.id, analysis.recommendations);
    }

    res.json({
      ...analysis,
      aiMode: getGeminiStatus().activeModel ? 'live-model' : 'deterministic-fallback',
      geminiActiveModel: getGeminiStatus().activeModel,
      geminiLastFailure: getGeminiStatus().lastFailure,
    });
  } catch (err: any) {
    console.error('Query execution error:', err);
    res.status(500).json({ error: `Failed to process query: ${err.message}` });
  }
});

// 7. Human-in-the-loop Approvals Queue
app.get('/api/approvals', (req: Request, res: Response) => {
  res.json(approvalStore.getAll());
});

app.post('/api/approvals/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, title, description, reviewerNotes, reviewedBy, impactLevel, urgency } = req.body;

  if (!status || !['approved', 'edited', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (approved, edited, rejected) is required' });
  }

  const updated = approvalStore.updateStatus(id, status, {
    title,
    description,
    reviewerNotes,
    reviewedBy,
    impactLevel,
    urgency,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Recommendation not found' });
  }

  res.json({ success: true, recommendation: updated });
});

// 7c. Delete a single recommendation card (recommendations only; datasets and query reviews untouched)
app.delete('/api/approvals/:id', (req: Request, res: Response) => {
  const removed = approvalStore.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Recommendation not found' });
  }
  res.json({ success: true, id: req.params.id });
});

// 7d. Clear recommendation cards only. Uploaded datasets and query-review items are preserved.
app.post('/api/approvals/clear', (req: Request, res: Response) => {
  const cleared = approvalStore.getAll().length;
  approvalStore.clearAll();
  res.json({
    success: true,
    cleared,
    message: 'Recommendation cards cleared. Uploaded datasets and query reviews are unchanged.',
    structuredCount: dataStore.getStructuredDatasets().length,
    unstructuredCount: dataStore.getUnstructuredDatasets().length,
    queryReviewsCount: queryReviewStore.getAll().length,
  });
});

// 7b. Query Review Queue - reviewable AI query responses
// Idempotent per queryId: resubmitting an already-reviewed query returns the existing item.
app.get('/api/query-reviews', (req: Request, res: Response) => {
  res.json(queryReviewStore.getAll());
});

app.post('/api/query-reviews', (req: Request, res: Response) => {
  const { analysis } = req.body || {};

  if (!analysis || typeof analysis !== 'object' || typeof analysis.id !== 'string' || !analysis.id) {
    return res.status(400).json({ error: 'A valid analysis payload with an id is required' });
  }

  const { item, created } = queryReviewStore.addFromAnalysis(analysis as QueryAnalysisResult);
  res.status(created ? 201 : 200).json({ success: true, created, item });
});

app.post('/api/query-reviews/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reviewedBy, reviewerNotes } = req.body || {};

  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (pending, approved, rejected) is required' });
  }

  const updated = queryReviewStore.updateStatus(id, status, { reviewedBy, reviewerNotes });
  if (!updated) {
    return res.status(404).json({ error: 'Query review item not found' });
  }

  res.json({ success: true, item: updated });
});

app.delete('/api/query-reviews/:id', (req: Request, res: Response) => {
  const removed = queryReviewStore.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Query review item not found' });
  }
  res.json({ success: true, id: req.params.id });
});

// 8. Export Approved Decisions Report
app.post('/api/export', (req: Request, res: Response) => {
  const { format = 'markdown' } = req.body;
  const allRecs = approvalStore.getAll();
  const approved = allRecs.filter((r) => r.status === 'approved' || r.status === 'edited');

  if (format === 'json') {
    return res.json({
      exportDate: new Date().toISOString(),
      system: 'InsightAI Enterprise Decision Engine',
      totalDecisions: approved.length,
      decisions: approved,
    });
  }

  if (format === 'csv') {
    const headers = ['ID', 'Title', 'Status', 'Impact', 'Urgency', 'Estimated Benefit', 'Reviewed By', 'Reviewed At', 'Notes'];
    const rows = approved.map((r) => [
      `"${r.id}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.impactLevel}"`,
      `"${r.urgency}"`,
      `"${r.estimatedBenefit.replace(/"/g, '""')}"`,
      `"${r.reviewedBy || ''}"`,
      `"${r.reviewedAt || ''}"`,
      `"${(r.reviewerNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="InsightAI_Approved_Decisions.csv"');
    return res.send(csvContent);
  }

  // Default: Executive Markdown Brief
  const mdContent = `# InsightAI – Executive Business Decision Brief
**Generated:** ${new Date().toLocaleString()}  
**Review Status:** Human-in-the-Loop Signoff Completed  
**Total Approved Strategic Actions:** ${approved.length}

---

## 1. Executive Summary
This document consolidates AI-synthesized business decisions grounded in multi-source operational data (structured quarterly performance metrics and executive incident filings). Each decision below has undergone explicit stakeholder review and approval.

${approved.map((r, index) => `
### Decision #${index + 1}: ${r.title}
- **Impact Level:** ${r.impactLevel} | **Urgency:** ${r.urgency} | **Confidence:** ${r.confidenceScore}%
- **Estimated ROI / Benefit:** ${r.estimatedBenefit}
- **Status:** **${r.status.toUpperCase()}** (Reviewed by: ${r.reviewedBy || 'Enterprise Owner'} on ${r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : 'N/A'})
- **Executive Rationale:** ${r.description}
${r.reviewerNotes ? `- **Reviewer Signoff Notes:** _"${r.reviewerNotes}"_` : ''}

**Mandated Implementation Steps:**
${r.suggestedActionItems.map((step) => `  1. ${step}`).join('\n')}
`).join('\n---\n')}

---
*Report generated securely by InsightAI Decision Intelligence Engine.*
`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename="InsightAI_Executive_Decision_Brief.md"');
  res.send(mdContent);
});

// Mount Vite or serve static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Keep HMR on a port derived from the app port so restarts do not collide
        // with a stale process still holding the default 24678.
        hmr: { port: port + 24678 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`InsightAI server running at http://localhost:${port}`);
  });

  // Without this handler a port collision is an unhandled 'error' event that kills
  // the process, leaving the site unreachable with no actionable message.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${port} is already in use - a previous InsightAI server is probably still running.\n` +
          `  Fix: stop it, then start again.  PowerShell:  Get-NetTCPConnection -LocalPort ${port} -State Listen | ` +
          `ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n` +
          `  Or run on a different port:  $env:PORT=${port + 1}; npm run dev\n`
      );
    } else {
      console.error('InsightAI server failed to start:', error);
    }
    process.exit(1);
  });
}

startServer();
