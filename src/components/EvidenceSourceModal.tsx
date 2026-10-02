import React from 'react';
import { X, FileSpreadsheet, FileText, CheckCircle2, ShieldCheck, Quote } from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceSourceModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
}

export const EvidenceSourceModal: React.FC<EvidenceSourceModalProps> = ({
  evidence,
  onClose,
}) => {
  if (!evidence) return null;

  const isStructured = evidence.sourceType === 'structured';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/95 rounded-3xl max-w-2xl w-full border border-slate-800 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isStructured
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {isStructured ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base">{evidence.sourceFile}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {evidence.location}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Source provenance &amp; verbatim data citation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Verbatim Quoted Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Verbatim Extracted Record:
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{evidence.confidenceScore}% Grounding Confidence</span>
              </span>
            </div>

            <div className="relative rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-4 font-mono text-xs text-slate-200 leading-relaxed shadow-inner">
              <Quote className="w-4 h-4 text-cyan-400 mb-1" />
              <div className="whitespace-pre-wrap selection:bg-cyan-500 selection:text-white">
                {evidence.snippet}
              </div>
            </div>
          </div>

          {/* Explainability Rationale */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Relevance &amp; Grounding Rationale:
            </span>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-300 leading-relaxed text-xs sm:text-sm">
              {evidence.relevanceRationale}
            </div>
          </div>

          {/* Audit Verification Trail */}
          <div className="rounded-2xl border border-slate-800 p-4 bg-slate-950/40">
            <h5 className="text-xs font-bold text-white mb-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Cryptographic Provenance Verification</span>
            </h5>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <span className="text-slate-400">Source Type:</span>{' '}
                <span className="font-semibold text-white capitalize">{evidence.sourceType}</span>
              </div>
              <div>
                <span className="text-slate-400">Anchor Location:</span>{' '}
                <span className="font-mono text-cyan-300">{evidence.location}</span>
              </div>
              <div>
                <span className="text-slate-400">Hash ID:</span>{' '}
                <span className="font-mono text-[11px] text-slate-400">{evidence.id}</span>
              </div>
              <div>
                <span className="text-slate-400">Verification Engine:</span>{' '}
                <span className="font-semibold text-cyan-400">InsightAI Hybrid RAG</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close Source Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
