import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ExternalLink,
  Quote,
  Sparkles,
  Check,
} from 'lucide-react';
import { EvidenceItem } from '../types';
import { useTheme } from '../context/ThemeContext';

interface EvidenceTrailProps {
  evidenceTrail: EvidenceItem[];
  reasoningSteps?: string[];
  onInspectEvidence: (item: EvidenceItem) => void;
}

export const EvidenceTrail: React.FC<EvidenceTrailProps> = ({
  evidenceTrail,
  reasoningSteps,
  onInspectEvidence,
}) => {
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!evidenceTrail || evidenceTrail.length === 0) return null;

  const handleCopyCitation = (item: EvidenceItem) => {
    const citation = `[Evidence Citation: ${item.sourceFile} - ${item.location}]\n"${item.snippet}"\nRationale: ${item.relevanceRationale}`;
    navigator.clipboard.writeText(citation);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`rounded-3xl backdrop-blur-xl border shadow-lg overflow-hidden mb-6 ${
      isDark
        ? 'bg-slate-900/85 border-slate-800 shadow-black/40'
        : 'bg-white border-slate-200 shadow-slate-200/60'
    }`}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between p-5 md:p-6 transition-colors cursor-pointer border-b ${
          isDark
            ? 'bg-slate-950/40 hover:bg-slate-950/70 border-slate-800'
            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md ${
            isDark
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className={`font-extrabold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Explainable Evidence Trail &amp; Source Provenance
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {evidenceTrail.length} Verified Citations
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Every insight is corroborated by exact tabular rows and document clauses.
            </p>
          </div>
        </div>

        <button className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'
        }`}>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 md:p-6 space-y-5">
          {/* Reasoning Steps */}
          {reasoningSteps && reasoningSteps.length > 0 && (
            <div className={`p-4 rounded-2xl border ${
              isDark
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-indigo-50/60 border-indigo-100'
            }`}>
              <div className={`flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-cyan-400' : 'text-indigo-600'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Grounding &amp; Corroboration Logic</span>
              </div>
              <ol className={`space-y-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {reasoningSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className={`font-bold font-mono shrink-0 ${isDark ? 'text-cyan-400' : 'text-indigo-500'}`}>{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Citations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceTrail.map((item) => {
              const isStructured = item.sourceType === 'structured';
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between shadow-sm transition-all ${
                    isDark
                      ? 'border-slate-800 bg-slate-950/50 hover:border-cyan-500/40'
                      : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Source File and Location */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isStructured
                          ? <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                          : <FileText className="w-4 h-4 text-cyan-500 shrink-0" />}
                        <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {item.sourceFile}
                        </span>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-lg border font-mono ${
                        isDark
                          ? 'text-slate-300 bg-slate-900 border-slate-800'
                          : 'text-slate-600 bg-white border-slate-200'
                      }`}>
                        {item.location}
                      </span>
                    </div>

                    {/* Quoted Snippet */}
                    <div className={`rounded-xl border p-3 mb-3 font-mono text-[11px] leading-relaxed max-h-28 overflow-y-auto ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-start gap-1.5">
                        <Quote className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? 'text-cyan-400' : 'text-indigo-400'}`} />
                        <span>{item.snippet}</span>
                      </div>
                    </div>

                    {/* Relevance Rationale */}
                    <p className={`text-xs leading-relaxed mb-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Rationale: </span>
                      {item.relevanceRationale}
                    </p>
                  </div>

                  {/* Footer actions */}
                  <div className={`flex items-center justify-between pt-3 border-t text-xs ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Confidence:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        isDark
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.confidenceScore}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCopyCitation(item)}
                        className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {isCopied ? (
                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Copied
                          </span>
                        ) : 'Copy'}
                      </button>

                      <button
                        onClick={() => onInspectEvidence(item)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                          isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-indigo-500 hover:text-indigo-700'
                        }`}
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
