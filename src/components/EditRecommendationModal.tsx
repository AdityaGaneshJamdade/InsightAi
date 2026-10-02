import React, { useState } from 'react';
import { X, Check, Edit3, ShieldAlert, Award } from 'lucide-react';
import { RecommendationDecision } from '../types';

interface EditRecommendationModalProps {
  recommendation: RecommendationDecision | null;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      title: string;
      description: string;
      impactLevel: 'High' | 'Medium' | 'Low';
      urgency: 'Immediate' | 'Short-Term' | 'Strategic';
      reviewerNotes: string;
      reviewedBy: string;
    }
  ) => void;
}

export const EditRecommendationModal: React.FC<EditRecommendationModalProps> = ({
  recommendation,
  onClose,
  onSave,
}) => {
  if (!recommendation) return null;

  const [title, setTitle] = useState(recommendation.title);
  const [description, setDescription] = useState(recommendation.description);
  const [impactLevel, setImpactLevel] = useState(recommendation.impactLevel);
  const [urgency, setUrgency] = useState(recommendation.urgency);
  const [reviewerNotes, setReviewerNotes] = useState(recommendation.reviewerNotes || '');
  const [reviewedBy, setReviewedBy] = useState(recommendation.reviewedBy || 'Enterprise Business Owner');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(recommendation.id, {
      title,
      description,
      impactLevel,
      urgency,
      reviewerNotes,
      reviewedBy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/95 rounded-3xl max-w-xl w-full border border-slate-800 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">Edit Recommendation Before Signoff</h3>
              <p className="text-xs text-slate-400">Human-in-the-Loop decision governance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4.5 text-xs">
          <div>
            <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
              Recommendation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none font-medium text-white transition-all"
            />
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
              Strategic Rationale &amp; Directives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none text-slate-200 font-normal leading-relaxed transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
                Impact Level
              </label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none font-medium text-white cursor-pointer"
              >
                <option value="High" className="bg-slate-900 text-white">High Impact</option>
                <option value="Medium" className="bg-slate-900 text-white">Medium Impact</option>
                <option value="Low" className="bg-slate-900 text-white">Low Impact</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
                Urgency
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none font-medium text-white cursor-pointer"
              >
                <option value="Immediate" className="bg-slate-900 text-white">Immediate (P0)</option>
                <option value="Short-Term" className="bg-slate-900 text-white">Short-Term (P1)</option>
                <option value="Strategic" className="bg-slate-900 text-white">Strategic (P2)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
              Business Owner / Signoff Assignee
            </label>
            <input
              type="text"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              placeholder="e.g. Sarah Jenkins (VP Operations)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none font-medium text-white transition-all"
            />
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">
              Reviewer Audit Notes &amp; Executive Mandate
            </label>
            <textarea
              rows={2}
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Add implementation caveats, budget approvals, or operational constraints..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl outline-none text-slate-200 leading-relaxed transition-all"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Sign Off</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
