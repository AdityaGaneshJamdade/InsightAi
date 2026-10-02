import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, Layers, Hash } from 'lucide-react';
import { StructuredDataset, UnstructuredDataset } from '../types';

interface DatasetViewerModalProps {
  structuredDataset?: StructuredDataset | null;
  unstructuredDataset?: UnstructuredDataset | null;
  onClose: () => void;
}

export const DatasetViewerModal: React.FC<DatasetViewerModalProps> = ({
  structuredDataset,
  unstructuredDataset,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  if (!structuredDataset && !unstructuredDataset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/95 rounded-3xl max-w-4xl w-full border border-slate-800 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                structuredDataset
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {structuredDataset ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">
                  {structuredDataset ? structuredDataset.name : unstructuredDataset?.name}
                </h3>
                {structuredDataset?.sheetName && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    Sheet: {structuredDataset.sheetName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {structuredDataset
                  ? `${structuredDataset.rowCount.toLocaleString()} rows · ${structuredDataset.columns.length} columns`
                  : `${unstructuredDataset?.pageCount || 1} pages · ${unstructuredDataset?.wordCount.toLocaleString()} words · ${unstructuredDataset?.lineCount} lines`}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {structuredDataset ? (
            <div className="space-y-5">
              {/* Summary Stats Cards */}
              {structuredDataset.summaryStats?.numericSummaries &&
                Object.keys(structuredDataset.summaryStats.numericSummaries).length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      Detected Column Numerical Summaries
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(structuredDataset.summaryStats.numericSummaries).map(([col, stats]) => (
                        <div key={col} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                          <span className="font-bold text-white block truncate mb-1.5">{col}</span>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 font-mono">
                            <div>Min: <span className="text-slate-200">{stats.min}</span></div>
                            <div>Max: <span className="text-slate-200">{stats.max}</span></div>
                            <div>Mean: <span className="text-slate-200">{stats.mean}</span></div>
                            <div>Sum: <span className="text-slate-200">{stats.sum}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Table Rows */}
              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Dataset Rows Preview
                </h5>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 w-12 text-center text-slate-500 font-mono">#</th>
                        {structuredDataset.columns.map((col) => (
                          <th key={col.name} className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white">{col.name}</span>
                              <span className="text-[10px] font-mono font-normal text-cyan-400">({col.type})</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono">
                      {structuredDataset.rows
                        .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                        .map((row, idx) => {
                          const actualRowIndex = (currentPage - 1) * rowsPerPage + idx + 1;
                          return (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-3.5 text-center text-slate-500 font-sans">{actualRowIndex}</td>
                              {structuredDataset.columns.map((col) => (
                                <td key={col.name} className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                                  {String(row[col.name] ?? '')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
                  <span>
                    Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
                    {Math.min(currentPage * rowsPerPage, structuredDataset.rowCount)} of {structuredDataset.rowCount} rows
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-semibold text-slate-300">Page {currentPage}</span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          p * rowsPerPage < structuredDataset.rowCount ? p + 1 : p
                        )
                      }
                      disabled={currentPage * rowsPerPage >= structuredDataset.rowCount}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Unstructured Document Chunks View */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-cyan-400">
                  Semantic Chunks &amp; Provenance Anchors
                </span>
                <span className="font-mono">{unstructuredDataset?.chunks.length} Chunks Indexed</span>
              </div>

              <div className="space-y-3">
                {unstructuredDataset?.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-2 hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="font-bold text-cyan-400">
                        Chunk #{chunk.chunkIndex} · Page {chunk.pageNumber || 1}
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                        Lines {chunk.startLine}–{chunk.endLine}
                      </span>
                    </div>
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed font-normal bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      {chunk.text}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
