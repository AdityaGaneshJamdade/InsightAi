import React, { useState } from 'react';
import { CheckCircle2, FileDown, Trash2, ChevronDown, ChevronUp, ListChecks, MessageSquare, Info } from 'lucide-react';
import { RecommendationDecision, QueryReviewItem } from '../types';
import { useTheme } from '../context/ThemeContext';

// ── Sub-component: individual recommendation card with tabs ──────────────────
interface CardProps {
  item: RecommendationDecision;
  isDark: boolean;
  heading: string; sub: string; mono: string; divider: string;
  itemCard: string; rejectBox: string; rejectInput: string;
  statusColors: Record<string, string>;
  rejectingId: string | null; rejectReason: string;
  setRejectingId: (id: string | null) => void;
  setRejectReason: (r: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onEdit: (item: RecommendationDecision) => void;
  onDelete?: (id: string) => void;
}

const RecommendationCard: React.FC<CardProps> = ({
  item, isDark, heading, sub, mono, divider, itemCard, rejectBox, rejectInput,
  statusColors, rejectingId, rejectReason, setRejectingId, setRejectReason,
  onApprove, onReject, onEdit, onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'steps' | 'reviewer'>('details');

  const tabBase = `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5`;
  const tabActive = isDark ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-700';
  const tabInactive = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800';

  return (
    <div className={`rounded-xl border ${itemCard}`}>
      {/* Card Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[item.status] || mono}`}>
              {item.status.toUpperCase()}
            </span>
            <span className={`text-xs ${sub}`}>{item.impactLevel} Impact</span>
            <span className={`text-xs ${sub}`}>· {item.urgency}</span>
          </div>
          <span className={`text-xs ${sub}`}>Confidence: {item.confidenceScore}%</span>
        </div>
        <h3 className={`text-sm font-bold mb-1 ${heading}`}>{item.title}</h3>
        {item.estimatedBenefit && (
          <div className={`text-xs ${sub}`}>
            Value / ROI: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.estimatedBenefit}</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className={`flex items-center gap-1 px-4 pb-2 border-b ${divider}`}>
        <button className={`${tabBase} ${activeTab === 'details' ? tabActive : tabInactive}`} onClick={() => setActiveTab('details')}>
          <Info className="w-3.5 h-3.5" /> Details
        </button>
        <button className={`${tabBase} ${activeTab === 'steps' ? tabActive : tabInactive}`} onClick={() => setActiveTab('steps')}>
          <ListChecks className="w-3.5 h-3.5" />
          Action Steps
          {item.suggestedActionItems?.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${isDark ? 'bg-cyan-900 text-cyan-300' : 'bg-indigo-100 text-indigo-600'}`}>
              {item.suggestedActionItems.length}
            </span>
          )}
        </button>
        <button className={`${tabBase} ${activeTab === 'reviewer' ? tabActive : tabInactive}`} onClick={() => setActiveTab('reviewer')}>
          <MessageSquare className="w-3.5 h-3.5" /> Reviewer Notes
        </button>
      </div>

      {/* Tab Content */}
      <div className="px-5 py-4">
        {activeTab === 'details' && (
          <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{item.description}</p>
        )}

        {activeTab === 'steps' && (
          <div>
            {item.suggestedActionItems && item.suggestedActionItems.length > 0 ? (
              <ol className="space-y-2">
                {item.suggestedActionItems.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs">
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDark ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-800' : 'bg-indigo-100 text-indigo-600'
                    }`}>{idx + 1}</span>
                    <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={`text-xs ${sub}`}>No action steps specified.</p>
            )}
          </div>
        )}

        {activeTab === 'reviewer' && (
          <div className="space-y-3 text-xs">
            {item.reviewerNotes ? (
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-950 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <span className={`font-semibold block mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Reviewer Notes:</span>
                {item.reviewerNotes}
              </div>
            ) : (
              <p className={sub}>No reviewer notes yet.</p>
            )}
            {item.reviewedBy && (
              <p className={sub}>Reviewed by: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.reviewedBy}</span></p>
            )}
            {item.reviewedAt && (
              <p className={sub}>At: {new Date(item.reviewedAt).toLocaleString()}</p>
            )}
            {item.status === 'rejected' && item.reviewerNotes && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                isDark ? 'bg-red-950/40 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span className="font-semibold">Rejection Reason:</span> {item.reviewerNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject reason input */}
      {rejectingId === item.id && (
        <div className={`mx-5 mb-3 p-3 rounded-lg border space-y-2 ${rejectBox}`}>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for declining..."
            className={`w-full px-3 py-1.5 text-xs border rounded-lg outline-none ${rejectInput}`}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRejectingId(null)} className={`px-3 py-1 text-xs ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Cancel
            </button>
            <button
              onClick={() => { onReject(item.id, rejectReason); setRejectingId(null); setRejectReason(''); }}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className={`flex items-center justify-between px-5 py-3 border-t text-xs ${divider}`}>
        <span className={`font-mono text-[11px] ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>{item.id}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(item)}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Edit
          </button>
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg cursor-pointer transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => onApprove(item.id)}
                className={`px-3 py-1 font-semibold rounded-lg cursor-pointer ${
                  isDark ? 'bg-white hover:bg-gray-200 text-gray-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                Approve
              </button>
            </>
          )}
          {item.status !== 'pending' && (
            <button
              onClick={() => onApprove(item.id)}
              className={`cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Re-review
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(item.id)} className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer">
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

interface ApprovalQueueProps {
  recommendations: RecommendationDecision[];
  queryReviews?: QueryReviewItem[];
  onApprove: (id: string) => void;
  onEdit: (item: RecommendationDecision) => void;
  onReject: (id: string, reason?: string) => void;
  onExport: () => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
  onQueryReviewApprove?: (id: string) => void;
  onQueryReviewReject?: (id: string) => void;
  onQueryReviewDelete?: (id: string) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({
  recommendations,
  queryReviews = [],
  onApprove,
  onEdit,
  onReject,
  onExport,
  onDelete,
  onClearAll,
  onQueryReviewApprove,
  onQueryReviewReject,
  onQueryReviewDelete,
}) => {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingCount = recommendations.filter((r) => r.status === 'pending').length;
  const approvedCount = recommendations.filter((r) => r.status === 'approved' || r.status === 'edited').length;
  const rejectedCount = recommendations.filter((r) => r.status === 'rejected').length;

  const filtered = recommendations.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'approved') return r.status === 'approved' || r.status === 'edited';
    if (filter === 'rejected') return r.status === 'rejected';
    return true;
  });

  // Theme tokens
  const card = isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const mono = isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600';
  const divider = isDark ? 'border-gray-800' : 'border-slate-200';
  const statCard = isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm';
  const filterBar = isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-slate-100 border-slate-200';
  const filterActive = isDark ? 'bg-white text-gray-950' : 'bg-white text-indigo-700 shadow-sm';
  const filterInactive = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900';
  const itemCard = isDark ? 'border-gray-800 bg-gray-900/40' : 'border-slate-200 bg-white shadow-sm';
  const rejectBox = isDark ? 'bg-gray-950 border-gray-800' : 'bg-slate-50 border-slate-200';
  const rejectInput = isDark ? 'bg-gray-900 text-white border-gray-700' : 'bg-white text-slate-900 border-slate-300';

  const statusColors: Record<string, string> = {
    pending: isDark ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: isDark ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    edited: isDark ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    rejected: isDark ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${card}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className={`text-xl font-bold tracking-tight ${heading}`}>Decision Governance</h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${mono}`}>AUDIT READY</span>
          </div>
          <p className={`text-xs max-w-xl ${sub}`}>
            Human-in-the-loop review for AI recommendations prior to executive export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recommendations.length > 0 && (
            <button
              onClick={onClearAll}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Clear All
            </button>
          )}
          <button
            onClick={onExport}
            disabled={approvedCount === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
              isDark
                ? 'text-gray-950 bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-gray-500'
                : 'text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export Approved ({approvedCount})</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending Review', value: pendingCount, color: isDark ? 'text-amber-300' : 'text-amber-600' },
          { label: 'Approved', value: approvedCount, color: isDark ? 'text-emerald-300' : 'text-emerald-600' },
          { label: 'Rejected', value: rejectedCount, color: isDark ? 'text-red-300' : 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${statCard}`}>
            <div className={`text-xs mb-1 ${sub}`}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className={`flex items-center gap-1 p-1 rounded-xl border max-w-fit ${filterBar}`}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
              filter === tab ? filterActive : filterInactive
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed p-8 text-center text-xs ${
          isDark ? 'border-gray-800 text-gray-500' : 'border-slate-300 text-slate-400'
        }`}>
          No decisions found in this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              isDark={isDark}
              heading={heading}
              sub={sub}
              mono={mono}
              divider={divider}
              itemCard={itemCard}
              rejectBox={rejectBox}
              rejectInput={rejectInput}
              statusColors={statusColors}
              rejectingId={rejectingId}
              rejectReason={rejectReason}
              setRejectingId={setRejectingId}
              setRejectReason={setRejectReason}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Query Reviews section */}
      {queryReviews.length > 0 && (
        <div className={`rounded-2xl border p-6 ${card}`}>
          <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${divider}`}>
            <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-indigo-500'}`} />
            <h3 className={`text-sm font-semibold ${heading}`}>Query Response Reviews</h3>
          </div>
          <div className="space-y-3">
            {queryReviews.map((qr) => (
              <div key={qr.id} className={`rounded-xl border p-4 ${itemCard}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${heading}`}>{qr.query}</p>
                    <p className={`text-[11px] mt-0.5 ${sub}`}>{new Date(qr.createdAt || qr.analysis?.timestamp).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColors[qr.status] || mono}`}>
                    {qr.status.toUpperCase()}
                  </span>
                </div>
                <p className={`text-xs line-clamp-2 mb-3 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  {qr.analysis?.directAnswer || qr.analysis?.executiveHeadline || ''}
                </p>
                {qr.status === 'pending' && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => onQueryReviewReject?.(qr.id)}
                      className="px-2.5 py-1 text-red-400 hover:text-red-500 rounded-lg cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onQueryReviewApprove?.(qr.id)}
                      className={`px-3 py-1 font-semibold rounded-lg cursor-pointer ${
                        isDark ? 'bg-white hover:bg-gray-200 text-gray-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onQueryReviewDelete?.(qr.id)}
                      className={`ml-auto px-2 py-1 rounded cursor-pointer ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
