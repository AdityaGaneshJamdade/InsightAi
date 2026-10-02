import React, { useState } from 'react';
import { X, FileDown, Copy, Check, FileText, FileSpreadsheet, Code2 } from 'lucide-react';
import { RecommendationDecision } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: RecommendationDecision[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  recommendations,
}) => {
  const [format, setFormat] = useState<'markdown' | 'csv' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const approved = recommendations.filter((r) => r.status === 'approved' || r.status === 'edited');

  const generateContent = () => {
    if (format === 'json') {
      return JSON.stringify(
        {
          exportDate: new Date().toISOString(),
          system: 'InsightAI Decision Intelligence Engine',
          totalApprovedDecisions: approved.length,
          decisions: approved,
        },
        null,
        2
      );
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
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    // Markdown Brief
    return `# InsightAI – Executive Business Decision Brief
**Generated:** ${new Date().toLocaleString()}  
**Governance Status:** Human-in-the-Loop Signoff Completed  
**Total Validated Strategic Interventions:** ${approved.length}

---

## 1. Executive Summary & Directive
This executive briefing compiles decisions synthesized across quantitative operational tables (sales, churn, and SLA logs) and unstructured management filings. Each decision has been independently reviewed, edited, and approved for execution.

${approved
  .map(
    (r, idx) => `
### Decision #${idx + 1}: ${r.title}
- **Impact Level:** ${r.impactLevel} | **Urgency:** ${r.urgency} | **Confidence:** ${r.confidenceScore}%
- **Estimated ROI / Value Preservation:** ${r.estimatedBenefit}
- **Approval Status:** **${r.status.toUpperCase()}** (Authorized by ${r.reviewedBy || 'Enterprise Owner'})
- **Strategic Directive:** ${r.description}
${r.reviewerNotes ? `- **Reviewer Signoff Notes:** _"${r.reviewerNotes}"_` : ''}

**Mandated Implementation Steps:**
${r.suggestedActionItems.map((step) => `  1. ${step}`).join('\n')}
`
  )
  .join('\n---\n')}

---
*Generated securely by InsightAI Decision Engine.*
`;
  };

  const content = generateContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `InsightAI_Approved_Decisions.${format === 'markdown' ? 'md' : format}`;
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/95 rounded-3xl max-w-3xl w-full border border-slate-800 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">Export Approved Decision Brief</h3>
              <p className="text-xs text-slate-400">
                {approved.length} decision(s) approved and ready for stakeholder distribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Format:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFormat('markdown')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  format === 'markdown' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Executive Markdown</span>
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  format === 'csv' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Audit CSV</span>
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  format === 'json' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>System JSON</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200 leading-relaxed max-h-[50vh]">
          <pre className="whitespace-pre-wrap selection:bg-cyan-500 selection:text-white">{content}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
