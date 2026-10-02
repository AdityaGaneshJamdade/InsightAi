import { dataStore } from './dataStore.js';
import { generateAnalysisWithGemini } from './gemini.js';
import {
  QueryAnalysisResult,
  EvidenceItem,
  KeyMetric,
  ChartConfig,
  RecommendationDecision,
} from './types.js';

const STOP_WORDS = new Set([
  'about', 'across', 'after', 'all', 'and', 'are', 'based', 'were', 'been', 'being', 'data', 'does', 'file', 'files',
  'find', 'for', 'from', 'give', 'have', 'help', 'how', 'into', 'key', 'make', 'me', 'more',
  'most', 'of', 'our', 'please', 'provide', 'show', 'summary', 'that', 'the', 'their', 'this',
  'through', 'uploaded', 'using', 'what', 'when', 'where', 'which', 'who', 'with', 'your',
  'were', 'why', 'did', 'does', 'any', 'some', 'there', 'here', 'them', 'then', 'than',
]);

function getQueryWords(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().split(/\W+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word))));
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[,$%\s]/g, '');
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

const MEASURE_HINTS = /revenue|sales|profit|amount|cost|price|units|quantity|score|total|budget|spend|headcount|margin|arr|mrr/;
const DIMENSION_HINTS = /category|region|department|segment|product|status|quarter|month|type|channel|region_|city|state|team/;

function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function tokenizeColumn(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Scores how strongly a column matches free-text query intent. Exact word hits
 * dominate, with prefix and substring matches contributing less.
 */
function scoreColumnAgainstQuery(columnName: string, lowerQuery: string, queryWords: string[]): number {
  const normalized = columnName.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const columnWords = tokenizeColumn(columnName);
  let score = 0;

  if (normalized && lowerQuery.includes(normalized)) score += 40;

  for (const token of columnWords) {
    if (token.length < 3) continue;
    if (lowerQuery.includes(token)) {
      score += 12;
      continue;
    }
    for (const queryWord of queryWords) {
      const stem = singularize(queryWord);
      if (token === stem || token === queryWord) score += 8;
      else if (token.startsWith(stem) && stem.length >= 4) score += 5;
      else if (stem.startsWith(token) && token.length >= 4) score += 4;
      else if (token.includes(stem) && stem.length >= 4) score += 2;
    }
  }

  return score;
}

function pickMeasureColumn(
  numericCols: any[],
  primaryDataset: any,
  lowerQuery: string,
  queryWords: string[]
): any | undefined {
  if (numericCols.length === 0) return undefined;

  const scored = numericCols
    .map((column) => ({
      column,
      score: scoreColumnAgainstQuery(column.name, lowerQuery, queryWords),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score > 0) return scored[0].column;

  // Only fall back to heuristic naming when the query gave us no usable signal.
  const byHint = numericCols.find((column: any) => MEASURE_HINTS.test(column.name.toLowerCase()));
  return byHint || numericCols[0];
}

function pickDimensionColumn(
  categoricalColumns: any[],
  lowerQuery: string,
  queryWords: string[],
  measureName: string
): any | undefined {
  if (categoricalColumns.length === 0) return undefined;

  const scored = categoricalColumns
    .map((column) => ({
      column,
      score: scoreColumnAgainstQuery(column.name, lowerQuery, queryWords),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score > 0) return scored[0].column;

  const byHint = categoricalColumns.find((column: any) => DIMENSION_HINTS.test(column.name.toLowerCase()));
  if (byHint && byHint.name !== measureName) return byHint;
  return categoricalColumns.find((column: any) => column.name !== measureName);
}

function shortenAnswer(answer: string, fallback: string): string {
  const clean = (answer || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 3) return clean;
  return sentences.slice(0, 3).join(' ');
}

export async function processNaturalLanguageQuery(query: string): Promise<QueryAnalysisResult> {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase();

  const structuredDatasets = dataStore.getStructuredDatasets();
  const unstructuredDatasets = dataStore.getUnstructuredDatasets();

  // If no datasets exist in store, guide user to upload their data
  if (structuredDatasets.length === 0 && unstructuredDatasets.length === 0) {
    return {
      id: `q-${Date.now()}`,
      query,
      timestamp: new Date().toISOString(),
      executiveHeadline: 'No Datasets Ingested Yet — Ready to Analyze Your Files',
      directAnswer: 'There are currently no active datasets in the system. To begin:\n\n1. Navigate to the Data Portal tab.\n2. Upload your spreadsheets (CSV, Excel) or corporate reports (PDF, TXT, MD).\n3. Return here to ask questions, compare metrics, and generate human-in-the-loop governance decisions.',
      keyMetrics: [
        { label: 'Active Datasets', value: '0', change: 'Awaiting upload', isPositive: false, subtext: 'Upload CSV, Excel, or PDF' },
        { label: 'Decision Engine', value: 'Ready', change: 'Active', isPositive: true, subtext: 'Multi-source RAG index' },
        { label: 'Evidence Audit', value: 'Active', change: 'Verifiable', isPositive: true, subtext: 'Human-in-the-loop' },
      ],
      chart: undefined,
      evidenceTrail: [],
      recommendations: [],
      processingDurationMs: Date.now() - startTime,
      usedSources: [],
      reasoningSteps: [
        'Scanned repository data stores for tabular and unstructured sources.',
        'Found 0 active datasets.',
        'Ready to index user files upon upload.',
      ],
    };
  }

  // 1. Unstructured RAG Retrieval across user documents
  const docSnippets: { chunkId: string; docName: string; lineRange: string; text: string; score: number }[] = [];
  const queryWords = getQueryWords(query);

  for (const doc of unstructuredDatasets) {
    for (const chunk of doc.chunks) {
      let score = 0;
      const lowerChunk = chunk.text.toLowerCase();

      for (const word of queryWords) {
        if (lowerChunk.includes(word)) {
          score += 2;
        }
      }

      const matches = queryWords.filter((w) => lowerChunk.includes(w)).length;
      if (matches >= 2) score += matches * 3;

      if (score > 0) {
        docSnippets.push({
          chunkId: chunk.id,
          docName: chunk.docName,
          lineRange: `Page ${chunk.pageNumber || 1}, Lines ${chunk.startLine}-${chunk.endLine}`,
          text: chunk.text,
          score,
        });
      }
    }
  }

  docSnippets.sort((a, b) => b.score - a.score);
  const topDocSnippets = docSnippets.slice(0, 5);

  if (topDocSnippets.length === 0 && unstructuredDatasets.length > 0) {
    unstructuredDatasets.forEach((doc) => {
      doc.chunks.slice(0, 2).forEach((chunk) => {
        if (topDocSnippets.length < 5) {
          topDocSnippets.push({
            chunkId: chunk.id,
            docName: chunk.docName,
            lineRange: `Page ${chunk.pageNumber || 1}, Lines ${chunk.startLine}-${chunk.endLine}`,
            text: chunk.text,
            score: 1,
          });
        }
      });
    });
  }

  // 2. Tabular Structured Data Search
  const matchingRows: { datasetName: string; rowIndex: number; row: Record<string, any>; score: number }[] = [];

  for (const ds of structuredDatasets) {
    ds.rows.forEach((row, idx) => {
      let rowScore = 0;
      const rowStr = Object.values(row).join(' ').toLowerCase();

      for (const word of queryWords) {
        if (rowStr.includes(word)) {
          rowScore += 2;
        }
      }

      ds.columns.forEach((col) => {
        if (lowerQuery.includes(col.name.toLowerCase())) {
          rowScore += 1;
        }
      });

      if (rowScore > 0) {
        matchingRows.push({
          datasetName: ds.name,
          rowIndex: idx + 1,
          row,
          score: rowScore,
        });
      }
    });
  }

  matchingRows.sort((a, b) => b.score - a.score);
  let topMatchingRows = matchingRows.slice(0, 8);

  if (topMatchingRows.length === 0 && structuredDatasets.length > 0) {
    structuredDatasets.forEach((ds) => {
      ds.rows.slice(0, 4).forEach((row, idx) => {
        topMatchingRows.push({
          datasetName: ds.name,
          rowIndex: idx + 1,
          row,
          score: 1,
        });
      });
    });
    topMatchingRows = topMatchingRows.slice(0, 8);
  }

  // Build Context for Gemini
  const sourceSummary = [
    ...structuredDatasets.map(
      (s) => `[Structured Dataset: "${s.name}" (${s.rowCount} rows, columns: ${s.columns.map((c) => `${c.name} (${c.type})`).join(', ')})]`
    ),
    ...unstructuredDatasets.map(
      (u) => `[Unstructured Document: "${u.name}" (${u.wordCount} words, ${u.lineCount} lines, ${u.chunks.length} chunks)]`
    ),
  ].join('\n');

  const structuredContext = topMatchingRows
    .map((r) => `[Dataset: "${r.datasetName}" | Row #${r.rowIndex}]: ${JSON.stringify(r.row)}`)
    .join('\n');

  const unstructuredContext = topDocSnippets
    .map((s) => `[Document: "${s.docName}" | ${s.lineRange}]:\n"${s.text}"`)
    .join('\n\n');

  // Attempt Gemini Analysis
  let geminiOutput: any = null;
  try {
    geminiOutput = await generateAnalysisWithGemini(
      query,
      structuredContext,
      unstructuredContext,
      sourceSummary
    );
  } catch (err) {
    console.warn('Gemini query processing note:', err);
  }

  const queryId = `q-${Date.now()}`;
  const usedSources = Array.from(
    new Set([...topMatchingRows.map((r) => r.datasetName), ...topDocSnippets.map((s) => s.docName)])
  );

  if (geminiOutput && geminiOutput.executiveHeadline) {
    const evidenceTrail: EvidenceItem[] = (geminiOutput.evidenceTrail || []).map(
      (e: any, index: number) => ({
        id: `ev-${queryId}-${index + 1}`,
        sourceFile: e.sourceFile || usedSources[0] || 'Uploaded Business Data',
        sourceType: (e.sourceType === 'unstructured' ? 'unstructured' : 'structured') as 'structured' | 'unstructured',
        location: e.location || `Citation #${index + 1}`,
        snippet: e.snippet || '',
        relevanceRationale: e.relevanceRationale || 'Direct factual citation corroborating answer.',
        confidenceScore: Math.min(99, Math.max(75, Number(e.confidenceScore) || 94)),
      })
    );

    const recommendations: RecommendationDecision[] = (geminiOutput.recommendations || [])
      // Drop cards that cite no source or carry no substance; they are not reviewable.
      .filter((r: any) => r && typeof r.title === 'string' && r.title.trim().length > 0 && r.description && String(r.description).trim().length > 20)
      .slice(0, 5)
      .map(
      (r: any, index: number) => ({
        id: `rec-${queryId}-${index + 1}`,
        queryId,
        title: r.title || `Operational Recommendation #${index + 1}`,
        description: r.description || '',
        impactLevel: (r.impactLevel === 'Low' || r.impactLevel === 'Medium' ? r.impactLevel : 'High') as 'High' | 'Medium' | 'Low',
        urgency: (r.urgency === 'Short-Term' || r.urgency === 'Strategic' ? r.urgency : 'Immediate') as 'Immediate' | 'Short-Term' | 'Strategic',
        estimatedBenefit: r.estimatedBenefit || 'Measurable positive business impact',
        confidenceScore: 94 - index * 3,
        status: 'pending' as const,
        suggestedActionItems: Array.isArray(r.suggestedActionItems) ? r.suggestedActionItems : [],
        evidenceIds: evidenceTrail.map((e) => e.id),
        createdAt: new Date().toISOString(),
      })
    );

    return {
      id: queryId,
      query,
      timestamp: new Date().toISOString(),
      executiveHeadline: geminiOutput.executiveHeadline,
      directAnswer: shortenAnswer(
        geminiOutput.directAnswer,
        'The uploaded data shows a clear operational signal and actionable follow-up items.'
      ),
      keyMetrics: Array.isArray(geminiOutput.keyMetrics) ? geminiOutput.keyMetrics : [],
      chart: geminiOutput.chart,
      evidenceTrail,
      recommendations,
      processingDurationMs: Date.now() - startTime,
      usedSources,
      reasoningSteps: geminiOutput.reasoningSteps || [
        'Ingested structured records and unstructured document clauses from active data sources.',
        'Extracted correlated metrics and corroborated findings across datasets.',
        'Synthesized executive findings and formulated human-in-the-loop governance actions.',
      ],
    };
  }

  // Dynamic Domain RAG Engine (Grounds dynamically on user actual uploaded datasets)
  return buildDynamicAnalysis(
    query,
    queryId,
    structuredDatasets,
    unstructuredDatasets,
    topMatchingRows,
    topDocSnippets,
    startTime
  );
}

/**
 * Builds dataset-specific recommendations from computed findings only. Every card cites a
 * concrete number from the uploaded files; if nothing was computed, no cards are produced.
 */
function buildFindingsRecommendations(
  queryId: string,
  findings: Record<string, any>,
  evidence: EvidenceItem[],
  usedSources: string[]
): RecommendationDecision[] {
  if (evidence.length === 0) return [];

  const recs: Omit<RecommendationDecision, 'id' | 'queryId' | 'status' | 'createdAt'>[] = [];
  const evidenceIds = evidence.map((item) => item.id);
  const { metricName, dimensionName, categoryTotals, datasetName, documentName } = findings;

  // 1. Largest category concentration
  if (Array.isArray(categoryTotals) && categoryTotals.length >= 2 && metricName) {
    const [[topName, topValue], ...rest] = categoryTotals as [string, number][];
    const totalSum = categoryTotals.reduce((acc, [, value]) => acc + Math.abs(value), 0);
    const sharePct = totalSum > 0 ? (Math.abs(topValue) / totalSum) * 100 : 0;

    recs.push({
      title: `Address ${topName} concentration in ${metricName}`,
      description: `${topName} carries ${formatNumber(Math.abs(topValue))} of ${formatNumber(totalSum)} total ${metricName} across ${categoryTotals.length} ${dimensionName} values (${sharePct.toFixed(1)}% of the measured total). This concentration is the single largest driver visible in ${datasetName}.`,
      impactLevel: sharePct >= 50 ? 'High' : 'Medium',
      urgency: 'Short-Term',
      estimatedBenefit: `Rebalancing toward weaker ${dimensionName} values could recover a portion of the ${formatNumber(Math.abs(topValue) - (rest.reduce((acc, [, v]) => acc + Math.abs(v), 0) / rest.length))} gap between ${topName} and the ${dimensionName} average.`,
      confidenceScore: 93,
      suggestedActionItems: [
        `Open ${datasetName} and verify the ${dimensionName} totals cited in the evidence trail`,
        `Break down the ${topName} figure into its constituent rows`,
        `Set a target for the lowest ${dimensionName} values and assign an owner`,
      ],
      evidenceIds,
    });
  }

  // 2. Weakest category vs the mean
  if (Array.isArray(categoryTotals) && categoryTotals.length >= 3 && metricName && dimensionName) {
    const sorted = [...(categoryTotals as [string, number][])].sort((a, b) => a[1] - b[1]);
    const [lowName, lowValue] = sorted[0];
    const mean = sorted.reduce((acc, [, value]) => acc + value, 0) / sorted.length;
    const gap = mean - lowValue;

    if (gap > 0) {
      recs.push({
        title: `Recovery plan for ${lowName} (${dimensionName})`,
        description: `${lowName} records ${formatNumber(lowValue)} in ${metricName}, which is ${formatNumber(gap)} below the ${dimensionName} average of ${formatNumber(mean)} across ${sorted.length} values computed from ${datasetName}.`,
        impactLevel: Math.abs(gap) > Math.abs(mean) * 0.25 ? 'High' : 'Medium',
        urgency: 'Immediate',
        estimatedBenefit: `Closing the ${formatNumber(gap)} gap to the ${dimensionName} average would add roughly ${formatNumber(gap)} in ${metricName} at the current run rate.`,
        confidenceScore: 91,
        suggestedActionItems: [
          `Review the source rows behind the ${lowName} figure in the dataset preview`,
          `Identify whether the gap is a data-quality issue or a genuine performance gap`,
          `Assign an owner and a recovery target for ${lowName}`,
        ],
        evidenceIds,
      });
    }
  }

  // 3. Period-over-period movement when the dimension is a time dimension
  if (findings.isTimeDimension && Array.isArray(categoryTotals) && (categoryTotals as [string, number][]).length >= 3 && metricName) {
    const series = categoryTotals as [string, number][];
    const deltas = series.slice(1).map(([label, value], idx) => ({
      label,
      from: series[idx][0],
      delta: value - series[idx][1],
      pct: series[idx][1] !== 0 ? ((value - series[idx][1]) / Math.abs(series[idx][1])) * 100 : 0,
    }));
    const worst = deltas.reduce((acc, d) => (d.delta < acc.delta ? d : acc), deltas[0]);
    const best = deltas.reduce((acc, d) => (d.delta > acc.delta ? d : acc), deltas[0]);

    if (worst.delta < 0) {
      recs.push({
        title: `Investigate the ${worst.from} to ${worst.label} drop in ${metricName}`,
        description: `${metricName} moved by ${formatNumber(worst.delta)} (${worst.pct.toFixed(1)}%) between ${worst.from} and ${worst.label} in ${datasetName}${best.delta > 0 ? `, while ${best.from} to ${best.label} gained ${formatNumber(best.delta)}` : ''}. This is the steepest decline in the measured series.`,
        impactLevel: Math.abs(worst.pct) >= 25 ? 'High' : 'Medium',
        urgency: 'Immediate',
        estimatedBenefit: `Restoring the ${worst.from} to ${worst.label} level would recover ${formatNumber(Math.abs(worst.delta))} in ${metricName}.`,
        confidenceScore: 90,
        suggestedActionItems: [
          `Confirm the ${worst.from} and ${worst.label} values in ${datasetName}`,
          `Cross-reference the drop against any uploaded incident or review document`,
          `Document the root cause and the corrective action in the Review Queue`,
        ],
        evidenceIds,
      });
    }
  }

  // 4. Outlier spread
  if (typeof findings.maximum === 'number' && typeof findings.minimum === 'number' && typeof findings.average === 'number' && metricName) {
    const spread = findings.maximum - findings.minimum;
    const meanAbs = Math.abs(findings.average) || 1;
    if (spread > meanAbs * 2) {
      recs.push({
        title: `Review ${metricName} outliers in ${datasetName}`,
        description: `${metricName} ranges from ${formatNumber(findings.minimum)} to ${formatNumber(findings.maximum)} across ${findings.valueCount} values, a spread of ${formatNumber(spread)} against an average of ${formatNumber(findings.average)}.`,
        impactLevel: 'Medium',
        urgency: 'Short-Term',
        estimatedBenefit: 'Separating genuine outliers from data-entry errors prevents incorrect aggregate decisions.',
        confidenceScore: 88,
        suggestedActionItems: [
          `List the rows where ${metricName} sits outside the ${formatNumber(findings.average)} average`,
          `Confirm whether each extreme value is a real observation or a data-quality defect`,
          'Correct or annotate confirmed data errors before the next reporting cycle',
        ],
        evidenceIds,
      });
    }
  }

  // 5. Document-derived action
  if (documentName && evidence.some((item) => item.sourceType === 'unstructured')) {
    recs.push({
      title: `Act on findings in ${documentName}`,
      description: `${evidence.filter((item) => item.sourceType === 'unstructured').length} passage(s) from ${documentName} were retrieved as supporting evidence for this query. The cited passages state the operational facts behind the computed ${metricName || 'business'} findings.`,
      impactLevel: 'Medium',
      urgency: 'Short-Term',
      estimatedBenefit: 'Confirms the computed figures against the narrative source before committing budget or headcount.',
      confidenceScore: 87,
      suggestedActionItems: [
        `Open the cited passages in ${documentName} via Inspect Source`,
        'Reconcile each stated figure against the computed totals',
        'Record sign-off or required corrections in the Review Queue',
      ],
      evidenceIds,
    });
  }

  if (recs.length === 0) return [];

  return recs.slice(0, 5).map((rec, index) => ({
    ...rec,
    id: `rec-${queryId}-${index + 1}`,
    queryId,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  }));
}

function buildDynamicAnalysis(
  query: string,
  queryId: string,
  structuredDatasets: any[],
  unstructuredDatasets: any[],
  topRows: { datasetName: string; rowIndex: number; row: Record<string, any>; score: number }[],
  topDocs: { chunkId: string; docName: string; lineRange: string; text: string; score: number }[],
  startTime: number
): QueryAnalysisResult {
  const lowerQuery = query.toLowerCase();
  const queryWords = getQueryWords(query);
  const evidence: EvidenceItem[] = [];
  const usedSources: string[] = [];

  // 1. Collect real citations from structured data
  if (topRows.length > 0) {
    topRows.slice(0, 3).forEach((r, idx) => {
      const rowPairs = Object.entries(r.row)
        .slice(0, 6)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      evidence.push({
        id: `ev-${queryId}-s${idx + 1}`,
        sourceFile: r.datasetName,
        sourceType: 'structured',
        location: `Row #${r.rowIndex}`,
        snippet: rowPairs,
        relevanceRationale: `Row #${r.rowIndex} from ${r.datasetName} matches query concepts.`,
        confidenceScore: 95 - idx * 2,
      });

      if (!usedSources.includes(r.datasetName)) usedSources.push(r.datasetName);
    });
  }

  // 2. Collect real citations from unstructured documents
  if (topDocs.length > 0) {
    topDocs.slice(0, 2).forEach((d, idx) => {
      const snippetPreview = d.text.slice(0, 280) + (d.text.length > 280 ? '...' : '');
      evidence.push({
        id: `ev-${queryId}-u${idx + 1}`,
        sourceFile: d.docName,
        sourceType: 'unstructured',
        location: d.lineRange,
        snippet: snippetPreview,
        relevanceRationale: `Document excerpt from ${d.docName} directly references operational context.`,
        confidenceScore: 93 - idx * 2,
      });

      if (!usedSources.includes(d.docName)) usedSources.push(d.docName);
    });
  }

  // Compute metrics and charts from uploaded values rather than sampled rows.
  const keyMetrics: KeyMetric[] = [];
  const primaryDataset = structuredDatasets.find((dataset) => topRows.some((row) => row.datasetName === dataset.name))
    || structuredDatasets[0];
  let chart: ChartConfig | undefined = undefined;
  let numericMetricName = '';
  let numericTotal: number | undefined;
  let numericAverage: number | undefined;
  let categoryName = '';
  let highestCategory: [string, number] | undefined;
  const computedFindings: Record<string, any> = {};

  if (primaryDataset) {
    const totalRows = primaryDataset.rowCount;
    keyMetrics.push({
      label: `${primaryDataset.name.split('.')[0]} Records`,
      value: totalRows.toLocaleString(),
      change: `${primaryDataset.columns.length} columns`,
      isPositive: true,
      subtext: `Ingested ${primaryDataset.type.toUpperCase()}`,
    });

    const numericCols = primaryDataset.columns.filter((column: any) => {
      const name = column.name.toLowerCase();
      if (/(^id$|_id$|\bid\b|code|phone|zip|postal)/.test(name)) return false;
      return primaryDataset.rows.filter((row: any) => parseNumericValue(row[column.name]) !== null).length >= Math.max(1, Math.ceil(primaryDataset.rowCount * 0.5));
    });
    if (numericCols.length > 0) {
      const numericCol = pickMeasureColumn(numericCols, primaryDataset, lowerQuery, queryWords);
      const values = primaryDataset.rows
        .map((row: any) => parseNumericValue(row[numericCol.name]))
        .filter((value: number | null): value is number => value !== null);
      const sum = values.reduce((total: number, value: number) => total + value, 0);
      const mean = sum / values.length;
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      const metricName = numericCol.name.replace(/[_-]/g, ' ');
      numericMetricName = metricName;
      numericTotal = sum;
      numericAverage = mean;

      Object.assign(computedFindings, {
        datasetName: primaryDataset.name,
        measureColumn: numericCol.name,
        metricName,
        total: sum,
        average: mean,
        minimum,
        maximum,
        valueCount: values.length,
        rowCount: primaryDataset.rowCount,
        columnCount: primaryDataset.columns.length,
      });

      keyMetrics.push(
        { label: `${metricName} total`, value: formatNumber(sum), change: `${values.length} values`, isPositive: true, subtext: `Calculated from ${primaryDataset.name}` },
        { label: `${metricName} average`, value: formatNumber(mean), change: `Min ${formatNumber(minimum)}`, isPositive: true, subtext: `Maximum ${formatNumber(maximum)}` }
      );

      const categoricalColumns = primaryDataset.columns.filter((column: any) => {
        const name = column.name.toLowerCase();
        if (/(^id$|_id$|\bid\b|code|phone|zip|postal)/.test(name) || column.name === numericCol.name) return false;
        const valuesForColumn = primaryDataset.rows.map((row: any) => String(row[column.name] ?? '').trim()).filter(Boolean);
        const uniqueCount = new Set(valuesForColumn).size;
        return uniqueCount >= 2 && uniqueCount <= Math.min(20, Math.ceil(primaryDataset.rowCount * 0.8));
      });
      const categoryColumn = pickDimensionColumn(categoricalColumns, lowerQuery, queryWords, numericCol.name);

      if (categoryColumn) {
        // Aggregate by category, merging repeated labels (e.g. duplicate Q4 rows)
        // so each x-axis position appears exactly once.
        const totals = new Map<string, { total: number; count: number; order: number }>();
        let categoryOrder = 0;
        primaryDataset.rows.forEach((row: any) => {
          const raw = String(row[categoryColumn.name] ?? '').trim();
          const value = parseNumericValue(row[numericCol.name]);
          if (value === null) return;
          const category = raw || 'Unspecified';
          const existing = totals.get(category);
          if (existing) {
            existing.total += value;
            existing.count += 1;
          } else {
            totals.set(category, { total: value, count: 1, order: categoryOrder++ });
          }
        });

        const allCategoryTotals = Array.from(totals.entries())
          .map(([category, agg]) => [category, agg.total, agg.order] as [string, number, number])
          .sort((a, b) => b[1] - a[1]);

        // Preserve first-appearance order so time-like dimensions read chronologically.
        const isTimeDimension = /date|time|quarter|month|year|period|week|day/i.test(categoryColumn.name);
        const orderedTotals = isTimeDimension
          ? [...allCategoryTotals].sort((a, b) => a[2] - b[2])
          : allCategoryTotals;
        const sortedTotals = orderedTotals.slice(0, 12);
        chart = {
          type: isTimeDimension ? 'line' : 'bar',
          title: `${metricName} by ${categoryColumn.name.replace(/[_-]/g, ' ')}`,
          subtitle: `Aggregated from ${primaryDataset.name}`,
          xAxisLabel: categoryColumn.name.replace(/[_-]/g, ' '),
          yAxisLabel: metricName,
          categories: sortedTotals.map(([category]) => category),
          series: [{ name: metricName, data: sortedTotals.map(([, total]) => Math.round(total * 100) / 100) }],
        };

        highestCategory = [allCategoryTotals[0][0], allCategoryTotals[0][1]];
        categoryName = categoryColumn.name.replace(/[_-]/g, ' ');
        Object.assign(computedFindings, {
          dimensionColumn: categoryColumn.name,
          dimensionName: categoryName,
          categoryTotals: allCategoryTotals.map(([category, total]) => [category, total] as [string, number]),
          isTimeDimension,
        });
        const lowestEntry = allCategoryTotals.length > 1 ? allCategoryTotals[allCategoryTotals.length - 1] : undefined;
        const lowestCategory = lowestEntry ? ([lowestEntry[0], lowestEntry[1]] as [string, number]) : undefined;
        if (highestCategory) {
          keyMetrics.push({
            label: `Top ${categoryColumn.name.replace(/[_-]/g, ' ')}`,
            value: highestCategory[0],
            change: formatNumber(highestCategory[1]),
            isPositive: true,
            subtext: `Highest ${metricName} total`,
          });
        }
        if (lowestCategory && allCategoryTotals.length > 2) {
          keyMetrics.push({
            label: `Lowest ${categoryColumn.name.replace(/[_-]/g, ' ')}`,
            value: lowestCategory[0],
            change: formatNumber(lowestCategory[1]),
            isPositive: false,
            subtext: `Lowest ${metricName} total`,
          });
        }
      } else {
        const sample = values.slice(0, 8);
        chart = {
          type: 'bar',
          title: `${metricName} by record`,
          subtitle: `First ${sample.length} values from ${primaryDataset.name}`,
          xAxisLabel: 'Record',
          yAxisLabel: metricName,
          categories: sample.map((_: number, index: number) => `Row ${index + 1}`),
          series: [{ name: metricName, data: sample }],
        };
      }
    }
  }

  if (!chart && topDocs.length > 0) {
    const document = unstructuredDatasets.find((doc: any) => doc.name === topDocs[0].docName);
    const fullText = document?.text || topDocs.map((item) => item.text).join(' ');
    const docName = document?.name || topDocs[0].docName;

    // Prefer concrete figures cited in the document over raw word counts.
    const figurePattern = /([A-Z][^\n.!?]{2,70}?)\s+((?:[$€£¥]\s?)?\d[\d,.]*\s?(?:%|percent|million|billion|days?|weeks?|months?|units?|x)?)\b/gi;
    const figures: { label: string; value: number }[] = [];
    const seenFigures = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = figurePattern.exec(fullText)) !== null && figures.length < 12) {
      const rawNumber = parseNumericValue(match[2]);
      if (rawNumber === null) continue;
      const label = match[1].trim().replace(/\s+/g, ' ').slice(-48);
      if (!label || seenFigures.has(label)) continue;
      seenFigures.add(label);
      figures.push({ label, value: rawNumber });
    }

    if (figures.length >= 2) {
      chart = {
        type: 'bar',
        title: `Figures cited in ${docName}`,
        subtitle: 'Numeric values extracted verbatim from the document text.',
        xAxisLabel: 'Context',
        yAxisLabel: 'Value',
        categories: figures.map((figure) => figure.label),
        series: [{ name: 'Value', data: figures.map((figure) => figure.value) }],
      };
    } else {
      const frequencies = new Map<string, number>();
      const documentWords = fullText.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
      documentWords.forEach((word: string) => {
        if (!STOP_WORDS.has(word)) frequencies.set(word, (frequencies.get(word) || 0) + 1);
      });
      const frequentTerms = Array.from(frequencies.entries())
        .filter(([term]) => term.length >= 4)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (frequentTerms.length > 0) {
        chart = {
          type: 'bar',
          title: `Frequent terms in ${docName}`,
          subtitle: 'Text frequency from extracted document content; not a business outcome metric.',
          xAxisLabel: 'Term',
          yAxisLabel: 'Occurrences',
          categories: frequentTerms.map(([term]) => term),
          series: [{ name: 'Occurrences', data: frequentTerms.map(([, count]) => count) }],
        };
      }
    }
  }

  if (unstructuredDatasets.length > 0) {
    const matchedDocumentCount = new Set(topDocs.map((doc) => doc.docName)).size;
    keyMetrics.push({
      label: 'Relevant documents',
      value: `${matchedDocumentCount}`,
      change: `${unstructuredDatasets.length} uploaded`,
      isPositive: true,
      subtext: 'Retrieved for this query',
    });
    const citedDocument = unstructuredDatasets.find((doc: any) => topDocs.some((d) => d.docName === doc.name));
    Object.assign(computedFindings, {
      documentName: citedDocument?.name || topDocs[0]?.docName,
      documentWordCount: citedDocument?.wordCount,
      matchedDocumentCount,
    });
  }

  const recommendations: RecommendationDecision[] = buildFindingsRecommendations(
    queryId,
    computedFindings,
    evidence,
    usedSources
  );

  const noGrounding = recommendations.length === 0;
  const numericSummary = primaryDataset && numericTotal !== undefined && numericAverage !== undefined
    ? `${numericMetricName} totals ${formatNumber(numericTotal)} and averages ${formatNumber(numericAverage)} across ${primaryDataset.rowCount} rows in ${primaryDataset.name}.`
    : '';
  const categorySummary = highestCategory
    ? `${highestCategory[0]} has the highest ${numericMetricName} total by ${categoryName} (${formatNumber(highestCategory[1])}).`
    : '';
  const documentSummary = topDocs.length > 0
    ? `Relevant passage from ${topDocs[0].docName} (${topDocs[0].lineRange}): “${topDocs[0].text.replace(/\s+/g, ' ').trim().slice(0, 220)}${topDocs[0].text.trim().length > 220 ? '…' : ''}”`
    : '';
  const headline = highestCategory
    ? `${highestCategory[0]} leads ${categoryName} in ${numericMetricName}`
    : primaryDataset && numericTotal !== undefined
      ? `${primaryDataset.name}: ${numericMetricName} totals ${formatNumber(numericTotal)}`
      : topDocs.length > 0
        ? `Document findings for ${query}`
        : `No matching evidence found for ${query}`;
  const directAnswer = [numericSummary, categorySummary, documentSummary]
    .filter(Boolean)
    .join(' ')
    || (noGrounding
      ? `No table values or document passages in the uploaded files matched "${query}", so no grounded findings exist to act on. Upload data containing the subject of your question, or rephrase using a column name or phrase that appears in the files.`
      : 'No relevant table values or document passages were found for this query. Try a dataset column name or a phrase from the uploaded document.');

  return {
    id: queryId,
    query,
    timestamp: new Date().toISOString(),
    executiveHeadline: headline,
    directAnswer,
    keyMetrics,
    chart,
    evidenceTrail: evidence,
    recommendations,
    processingDurationMs: Date.now() - startTime,
    usedSources,
    reasoningSteps: [
      `Queried multi-source RAG index with search terms: ${queryWords.slice(0, 4).join(', ')}`,
      `Extracted matching data rows and document clauses from: ${usedSources.join(', ') || 'repository sources'}`,
      'Calculated key performance indicators and built evidence trail for executive audit.',
    ],
  };
}
