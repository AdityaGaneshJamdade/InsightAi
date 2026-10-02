/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { QueryHero } from './components/QueryHero';
import { MetricsCards } from './components/MetricsCards';
import { DynamicChart } from './components/DynamicChart';
import { EvidenceTrail } from './components/EvidenceTrail';
import { EvidenceSourceModal } from './components/EvidenceSourceModal';
import { ApprovalQueue } from './components/ApprovalQueue';
import { EditRecommendationModal } from './components/EditRecommendationModal';
import { DataUploadPortal } from './components/DataUploadPortal';
import { DatasetViewerModal } from './components/DatasetViewerModal';
import { ExportModal } from './components/ExportModal';
import {
  StructuredDataset,
  UnstructuredDataset,
  RecommendationDecision,
  QueryAnalysisResult,
  QueryReviewItem,
  EvidenceItem,
} from './types';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  ChevronRight,
  Database,
  UploadCloud,
} from 'lucide-react';

function renderAnswerText(text: string): React.ReactNode[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks: { type: 'paragraph' | 'list'; lines: string[] }[] = [];

  lines.forEach((line) => {
    const isListItem = /^(?:[-*•]|\d+[.)])\s+/.test(line);
    const type = isListItem ? 'list' : 'paragraph';
    const content = isListItem ? line.replace(/^(?:[-*•]|\d+[.)])\s+/, '') : line;
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock?.type === type) lastBlock.lines.push(content);
    else blocks.push({ type, lines: [content] });
  });

  const renderInline = (line: string, keyPrefix: string) =>
    line.replace(/^#{1,6}\s+/, '').split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${keyPrefix}-${index}`} className="font-bold text-white">{part.slice(2, -2)}</strong>
        : <React.Fragment key={`${keyPrefix}-${index}`}>{part.replace(/\*([^*]+)\*/g, '$1')}</React.Fragment>
    );

  return blocks.map((block, blockIndex) =>
    block.type === 'list' ? (
      <ul key={blockIndex} className="list-disc space-y-1.5 pl-5 marker:text-cyan-400">
        {block.lines.map((line, lineIndex) => <li key={lineIndex}>{renderInline(line, `${blockIndex}-${lineIndex}`)}</li>)}
      </ul>
    ) : (
      <p key={blockIndex}>{renderInline(block.lines[0], `${blockIndex}-0`)}</p>
    )
  );
}

function AppInner() {
  const { isDark, theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'insights' | 'data' | 'approvals'>('insights');
  const [structuredDatasets, setStructuredDatasets] = useState<StructuredDataset[]>([]);
  const [unstructuredDatasets, setUnstructuredDatasets] = useState<UnstructuredDataset[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationDecision[]>([]);
  const [queryReviews, setQueryReviews] = useState<QueryReviewItem[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<QueryAnalysisResult | null>(null);

  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  // Modals
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [editingRecommendation, setEditingRecommendation] = useState<RecommendationDecision | null>(null);
  const [viewingStructured, setViewingStructured] = useState<StructuredDataset | null>(null);
  const [viewingUnstructured, setViewingUnstructured] = useState<UnstructuredDataset | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial Data Fetch
  const fetchHealthAndData = async () => {
    try {
      const [healthRes, datasetsRes, approvalsRes, queryReviewsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/datasets'),
        fetch('/api/approvals'),
        fetch('/api/query-reviews'),
      ]);

      const health = await healthRes.json();
      setHasGeminiKey(health.hasGeminiKey);
      setHealthInfo(health);

      const datasets = await datasetsRes.json();
      setStructuredDatasets(datasets.structured || []);
      setUnstructuredDatasets(datasets.unstructured || []);

      const approvals = await approvalsRes.json();
      setRecommendations(approvals || []);

      const queryReviewData = await queryReviewsRes.json();
      setQueryReviews(queryReviewData || []);
    } catch (err) {
      console.error('Initial data fetch failed:', err);
    }
  };

  useEffect(() => {
    fetchHealthAndData();
  }, []);

  const handleSearch = async (queryText: string) => {
    setIsLoadingQuery(true);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (!res.ok) {
        throw new Error('Query request failed');
      }

      const result: QueryAnalysisResult = await res.json();
      setCurrentAnalysis(result);

      // Refresh health so the banner reflects the model actually used for this answer.
      fetch('/api/health')
        .then((r) => r.json())
        .then(setHealthInfo)
        .catch(() => undefined);

      // Refresh approvals queue to include newly formulated decisions
      const approvalsRes = await fetch('/api/approvals');
      const approvalsData = await approvalsRes.json();
      setRecommendations(approvalsData);
    } catch (err: any) {
      console.error('Failed to process query:', err);
      showToast('Error processing query. Please check your data.');
    } finally {
      setIsLoadingQuery(false);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Are you sure you want to clear all uploaded datasets and decision records?')) {
      return;
    }

    setIsClearing(true);
    try {
      const res = await fetch('/api/clear-all', { method: 'POST' });
      if (res.ok) {
        setStructuredDatasets([]);
        setUnstructuredDatasets([]);
        setRecommendations([]);
        setCurrentAnalysis(null);
        showToast('All datasets and governance recommendations cleared.');
      }
    } catch (err) {
      console.error('Failed to clear data:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleUploadFiles = async (files: FileList) => {
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      showToast(`Successfully added ${data.processed.length} file(s). Add more or continue to Query Portal.`);
      await fetchHealthAndData();
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStructuredDatasets((prev) => prev.filter((d) => d.id !== id));
        setUnstructuredDatasets((prev) => prev.filter((d) => d.id !== id));
        showToast('Dataset deleted.');
      }
    } catch (err) {
      console.error('Delete dataset error:', err);
    }
  };

  const handleApproveRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (res.ok) {
        const { recommendation } = await res.json();
        setRecommendations((prev) => prev.map((r) => (r.id === id ? recommendation : r)));
        showToast('Decision approved and recorded in governance audit log.');
      }
    } catch (err) {
      console.error('Failed to approve recommendation:', err);
    }
  };

  const handleRejectRecommendation = async (id: string, reason?: string) => {
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          reviewerNotes: reason || 'Declined during executive review',
        }),
      });

      if (res.ok) {
        const { recommendation } = await res.json();
        setRecommendations((prev) => prev.map((r) => (r.id === id ? recommendation : r)));
        showToast('Decision rejected with recorded rationale.');
      }
    } catch (err) {
      console.error('Failed to reject recommendation:', err);
    }
  };

  const handleSaveEditedRecommendation = async (
    id: string,
    updates: {
      title: string;
      description: string;
      impactLevel: 'High' | 'Medium' | 'Low';
      urgency: 'Immediate' | 'Short-Term' | 'Strategic';
      reviewerNotes: string;
      reviewedBy: string;
    }
  ) => {
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'edited',
          ...updates,
        }),
      });

      if (res.ok) {
        const { recommendation } = await res.json();
        setRecommendations((prev) => prev.map((r) => (r.id === id ? recommendation : r)));
        showToast('Updated decision saved and signed off.');
      }
    } catch (err) {
      console.error('Failed to save edited recommendation:', err);
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    if (!window.confirm('Delete this recommendation card? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/approvals/${id}`, { method: 'DELETE' });

      if (res.ok) {
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
        showToast('Recommendation card deleted.');
      }
    } catch (err) {
      console.error('Failed to delete recommendation:', err);
      showToast('Failed to delete the recommendation card.');
    }
  };

  const handleClearRecommendations = async () => {
    if (!window.confirm('Clear all recommendation cards? Uploaded datasets and query reviews will be kept.')) {
      return;
    }

    try {
      const res = await fetch('/api/approvals/clear', { method: 'POST' });

      if (res.ok) {
        const data = await res.json();
        setRecommendations([]);
        showToast(`${data.cleared} recommendation card(s) cleared.`);
      }
    } catch (err) {
      console.error('Failed to clear recommendations:', err);
      showToast('Failed to clear recommendation cards.');
    }
  };

  // Submit the current AI query response to the Review Queue (idempotent per queryId).
  const handleSubmitQueryForReview = async () => {
    if (!currentAnalysis) return;

    try {
      const res = await fetch('/api/query-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: currentAnalysis }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit query for review');
      }

      const { item, created } = await res.json();
      setQueryReviews((prev) =>
        prev.some((review) => review.id === item.id) ? prev : [item, ...prev]
      );
      showToast(created ? 'Query response sent to the Review Queue.' : 'This query is already in the Review Queue.');
      setActiveTab('approvals');
    } catch (err: any) {
      console.error('Failed to submit query for review:', err);
      showToast(err.message || 'Failed to submit query for review.');
    }
  };

  const handleUpdateQueryReviewStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/query-reviews/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const { item } = await res.json();
        setQueryReviews((prev) => prev.map((review) => (review.id === id ? item : review)));
        showToast(status === 'approved' ? 'Query response approved.' : 'Query response rejected.');
      }
    } catch (err) {
      console.error('Failed to update query review status:', err);
      showToast('Failed to update the query review status.');
    }
  };

  const handleDeleteQueryReview = async (id: string) => {
    if (!window.confirm('Delete this query response from the Review Queue? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/query-reviews/${id}`, { method: 'DELETE' });

      if (res.ok) {
        setQueryReviews((prev) => prev.filter((review) => review.id !== id));
        showToast('Query response deleted from the Review Queue.');
      }
    } catch (err) {
      console.error('Failed to delete query review:', err);
      showToast('Failed to delete the query response.');
    }
  };

  const totalDatasets = structuredDatasets.length + unstructuredDatasets.length;
  const datasetNames = [
    ...structuredDatasets.map((s) => s.name),
    ...unstructuredDatasets.map((u) => u.name),
  ];
  const pendingApprovalsCount = recommendations.filter((r) => r.status === 'pending').length;

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-white transition-colors duration-300 ${isDark
        ? 'bg-[#070b14] text-slate-100'
        : 'bg-slate-50 text-slate-900'
      }`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 border border-cyan-500/40 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetCount={totalDatasets}
        pendingApprovalsCount={pendingApprovalsCount}
        onClearData={handleClearAllData}
        onOpenExport={() => setIsExportOpen(true)}
        isClearing={isClearing}
        hasGeminiKey={hasGeminiKey}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab 1: Insights & Pulse Query */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* Search Hero */}
            <QueryHero
              onSearch={handleSearch}
              isLoading={isLoadingQuery}
              currentQuery={currentAnalysis?.query || ''}
              datasetCount={totalDatasets}
              datasetNames={datasetNames}
              onNavigateToDataPortal={() => setActiveTab('data')}
            />

            {/* Engine Status Banner */}
            {healthInfo && (
              <div className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between ${isDark ? 'border-gray-800 bg-gray-900/60 text-gray-300' : 'border-slate-200 bg-white text-slate-600 shadow-sm'
                }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${healthInfo.geminiLastFailure ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span>
                    Answer engine active
                    {healthInfo.geminiActiveModel && (
                      <span className={`font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}> ({healthInfo.geminiActiveModel})</span>
                    )}
                  </span>
                </div>
                {healthInfo.geminiLastFailure && (
                  <span className="text-amber-500 text-[11px]">Using local computation fallback</span>
                )}
              </div>
            )}

            {!currentAnalysis && (
              <>
                {totalDatasets === 0 ? (
                  <div className={`rounded-2xl border border-dashed p-8 md:p-12 text-center ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-300'
                    }`}>
                    <div className={`w-16 h-16 rounded-xl border p-1 flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                      <img src="/logo.png" alt="InsightAI Logo" className="w-full h-full object-contain" />
                    </div>
                    <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Ready to Ingest Your Business Data
                    </h3>
                    <p className={`text-xs max-w-md mx-auto mb-6 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Upload your Excel files, CSV spreadsheets, and PDF documents. InsightAI will index your records and synthesize verifiable decisions.
                    </p>
                    <button
                      onClick={() => setActiveTab('data')}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-xs rounded-xl transition-colors cursor-pointer ${isDark ? 'bg-white hover:bg-gray-100 text-gray-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Open Data Portal</span>
                    </button>
                  </div>
                ) : (
                  <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {totalDatasets} Dataset{totalDatasets > 1 ? 's' : ''} Ready for Analysis
                        </h3>
                      </div>
                      <button
                        onClick={() => setActiveTab('data')}
                        className={`text-xs transition-colors cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        Manage Datasets →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {structuredDatasets.map((ds) => (
                        <div key={ds.id} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-slate-50 border-slate-200'
                          }`}>
                          <FileSpreadsheet className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-indigo-400'}`} />
                          <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{ds.name}</span>
                          <span className={`font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>({ds.rowCount} rows)</span>
                        </div>
                      ))}
                      {unstructuredDatasets.map((doc) => (
                        <div key={doc.id} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-slate-50 border-slate-200'
                          }`}>
                          <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-emerald-400'}`} />
                          <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{doc.name}</span>
                          <span className={`font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>({doc.wordCount} words)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {currentAnalysis && (
              <div className="space-y-6">
                {/* Executive Takeaway */}
                <div className={`rounded-2xl border p-6 md:p-7 ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                  <div className={`flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'
                    }`}>
                    <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      <span>Query Result</span>
                      <span>·</span>
                      <span className="font-mono">{currentAnalysis.processingDurationMs}ms</span>
                      <span>·</span>
                      <span>{currentAnalysis.usedSources.length} Source(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSubmitQueryForReview}
                        disabled={isLoadingQuery}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${isDark ? 'text-gray-950 bg-white hover:bg-gray-100' : 'text-white bg-indigo-600 hover:bg-indigo-700'
                          }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'text-gray-400 bg-gray-800' : 'text-slate-500 bg-slate-100'
                        }`}>Verified Evidence</span>
                    </div>
                  </div>
                  <h2 className={`text-lg sm:text-xl font-bold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {currentAnalysis.executiveHeadline}
                  </h2>
                  <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line space-y-2.5 font-normal ${isDark ? 'text-gray-300' : 'text-slate-600'
                    }`}>
                    {renderAnswerText(currentAnalysis.directAnswer)}
                  </div>
                </div>

                {currentAnalysis.keyMetrics?.length > 0 && <MetricsCards metrics={currentAnalysis.keyMetrics} />}
                {currentAnalysis.chart && <DynamicChart chartConfig={currentAnalysis.chart} />}
                {currentAnalysis.evidenceTrail?.length > 0 && (
                  <EvidenceTrail
                    evidenceTrail={currentAnalysis.evidenceTrail}
                    reasoningSteps={currentAnalysis.reasoningSteps}
                    onInspectEvidence={(item) => setSelectedEvidence(item)}
                  />
                )}

                {currentAnalysis.recommendations?.length > 0 && (
                  <div className={`rounded-2xl border p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-indigo-50 border-indigo-200'
                    }`}>
                    <div>
                      <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-400' : 'text-indigo-500'}`}>
                        Workflow Triggered · {currentAnalysis.recommendations.length} Action Items
                      </div>
                      <h4 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Strategic decisions formulated for human signoff
                      </h4>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-indigo-600/80'}`}>
                        Recommendations placed in Decision Review Queue awaiting approval.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('approvals')}
                      className={`flex items-center gap-1.5 px-4 py-2 font-semibold text-xs rounded-xl transition-colors shrink-0 cursor-pointer self-start sm:self-auto ${isDark ? 'bg-white hover:bg-gray-100 text-gray-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                    >
                      <span>Open Review Queue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Multi-Source Data Portal */}
        {activeTab === 'data' && (
          <DataUploadPortal
            structuredDatasets={structuredDatasets}
            unstructuredDatasets={unstructuredDatasets}
            onUploadFiles={handleUploadFiles}
            onDeleteDataset={handleDeleteDataset}
            onViewStructured={(ds) => setViewingStructured(ds)}
            onViewUnstructured={(doc) => setViewingUnstructured(doc)}
            onContinueToQuery={() => {
              setCurrentAnalysis(null);
              setActiveTab('insights');
            }}
            isUploading={isUploading}
          />
        )}

        {/* Tab 3: Human-in-the-Loop Review Queue */}
        {activeTab === 'approvals' && (
          <ApprovalQueue
            recommendations={recommendations}
            queryReviews={queryReviews}
            onApprove={handleApproveRecommendation}
            onEdit={(item) => setEditingRecommendation(item)}
            onReject={handleRejectRecommendation}
            onExport={() => setIsExportOpen(true)}
            onDelete={handleDeleteRecommendation}
            onClearAll={handleClearRecommendations}
            onQueryReviewApprove={(id) => handleUpdateQueryReviewStatus(id, 'approved')}
            onQueryReviewReject={(id) => handleUpdateQueryReviewStatus(id, 'rejected')}
            onQueryReviewDelete={handleDeleteQueryReview}
          />
        )}
      </main>

      {/* Footer with Logo */}
      <footer className={`backdrop-blur-xl border-t mt-16 py-8 text-xs transition-colors ${isDark
          ? 'bg-[#050811]/90 border-slate-800/90 text-slate-400'
          : 'bg-white/80 border-slate-200 text-slate-500'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-lg overflow-hidden border p-0.5 flex items-center justify-center ${isDark ? 'bg-[#090e1d] border-cyan-500/30' : 'bg-slate-100 border-slate-300'
              }`}>
              <img src="/logo.png" alt="InsightAI Logo" className="w-full h-full object-contain" />
            </div>
            <span className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>InsightAI</span>
            <span>·</span>
            <span>Enterprise Decision Engine for Multi-Source Business Data</span>
          </div>
          <div className={`flex items-center gap-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>CSV · Excel · PDF · Gemini 3.8 Flash</span>
            <span>·</span>
            <span>Human-in-the-Loop Governance</span>
          </div>
        </div>
      </footer>

      {/* Evidence Source Inspection Modal */}
      {selectedEvidence && (
        <EvidenceSourceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}

      {/* Edit Recommendation Modal */}
      {editingRecommendation && (
        <EditRecommendationModal
          recommendation={editingRecommendation}
          onClose={() => setEditingRecommendation(null)}
          onSave={handleSaveEditedRecommendation}
        />
      )}

      {/* Dataset / Document Viewer Modal */}
      {(viewingStructured || viewingUnstructured) && (
        <DatasetViewerModal
          structuredDataset={viewingStructured}
          unstructuredDataset={viewingUnstructured}
          onClose={() => {
            setViewingStructured(null);
            setViewingUnstructured(null);
          }}
        />
      )}

      {/* Decision Export Modal */}
      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          recommendations={recommendations}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
