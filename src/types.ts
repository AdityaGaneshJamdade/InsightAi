export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  sampleValues: any[];
}

export interface StructuredDataset {
  id: string;
  name: string;
  type: 'csv' | 'excel';
  sheetName?: string;
  columns: ColumnInfo[];
  rows: Record<string, any>[];
  rowCount: number;
  uploadedAt: string;
  summaryStats?: {
    numericSummaries: Record<string, { min: number; max: number; mean: number; sum: number }>;
  };
}

export interface UnstructuredDocChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  pageNumber?: number;
  startLine: number;
  endLine: number;
}

export interface UnstructuredDataset {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'markdown';
  text: string;
  pageCount?: number;
  lineCount: number;
  wordCount: number;
  chunks: UnstructuredDocChunk[];
  uploadedAt: string;
}

export interface EvidenceItem {
  id: string;
  sourceFile: string;
  sourceType: 'structured' | 'unstructured';
  location: string;
  snippet: string;
  relevanceRationale: string;
  confidenceScore: number;
  highlightMatch?: string;
  rowOrLineNumber?: number;
  sheetOrSection?: string;
}

export interface ChartMetricSeries {
  name: string;
  data: number[];
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'donut' | 'area';
  title: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  categories: string[];
  series: ChartMetricSeries[];
}

export interface KeyMetric {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  subtext?: string;
}

export interface RecommendationDecision {
  id: string;
  queryId?: string;
  title: string;
  description: string;
  impactLevel: 'High' | 'Medium' | 'Low';
  urgency: 'Immediate' | 'Short-Term' | 'Strategic';
  estimatedBenefit: string;
  confidenceScore: number;
  status: 'pending' | 'approved' | 'edited' | 'rejected';
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  suggestedActionItems: string[];
  evidenceIds: string[];
  createdAt: string;
}

export interface QueryAnalysisResult {
  id: string;
  query: string;
  timestamp: string;
  executiveHeadline: string;
  directAnswer: string;
  keyMetrics: KeyMetric[];
  chart?: ChartConfig;
  evidenceTrail: EvidenceItem[];
  recommendations: RecommendationDecision[];
  processingDurationMs: number;
  usedSources: string[];
  reasoningSteps: string[];
}

export type QueryReviewStatus = 'pending' | 'approved' | 'rejected';

export interface QueryReviewItem {
  id: string;
  queryId: string;
  query: string;
  status: QueryReviewStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerNotes?: string;
  analysis: QueryAnalysisResult;
}
