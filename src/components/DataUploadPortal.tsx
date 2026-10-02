import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Plus,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Trash2,
  Eye,
} from 'lucide-react';
import { StructuredDataset, UnstructuredDataset } from '../types';
import { useTheme } from '../context/ThemeContext';

interface DataUploadPortalProps {
  structuredDatasets: StructuredDataset[];
  unstructuredDatasets: UnstructuredDataset[];
  onUploadFiles: (files: FileList) => Promise<void>;
  onDeleteDataset: (id: string) => Promise<void>;
  onViewStructured: (dataset: StructuredDataset) => void;
  onViewUnstructured: (dataset: UnstructuredDataset) => void;
  onContinueToQuery: () => void;
  isUploading: boolean;
}

export const DataUploadPortal: React.FC<DataUploadPortalProps> = ({
  structuredDatasets,
  unstructuredDatasets,
  onUploadFiles,
  onDeleteDataset,
  onViewStructured,
  onViewUnstructured,
  onContinueToQuery,
  isUploading,
}) => {
  const { isDark } = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUploadedFiles = structuredDatasets.length + unstructuredDatasets.length > 0;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) await onUploadFiles(e.dataTransfer.files);
  };
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { await onUploadFiles(e.target.files); e.target.value = ''; }
  };

  // Reusable theme tokens
  const card = isDark
    ? 'bg-gray-900/60 border-gray-800'
    : 'bg-white border-slate-200 shadow-sm';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const divider = isDark ? 'border-gray-800' : 'border-slate-200';
  const pill = isDark
    ? 'bg-gray-800 text-gray-300 border-gray-700'
    : 'bg-slate-100 text-slate-600 border-slate-300';
  const dataCard = isDark
    ? 'border-gray-800 bg-gray-950/40 hover:border-gray-700'
    : 'border-slate-200 bg-slate-50 hover:border-indigo-300';
  const mono = isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-100 text-slate-500';
  const preview = isDark ? 'bg-gray-900 text-gray-400' : 'bg-slate-100 text-slate-500';
  const iconColor = isDark ? 'text-gray-400' : 'text-slate-400';
  const actionLink = isDark
    ? 'text-gray-300 hover:text-white'
    : 'text-slate-500 hover:text-slate-900';

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className={`rounded-2xl border p-6 md:p-8 ${card}`}>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className={`text-xl font-bold tracking-tight ${heading}`}>
              Data Portal · Source Ingestion
            </h2>
            <p className={`text-xs mt-1 max-w-xl ${sub}`}>
              Upload your business files and let AI turn them into useful insights.
            </p>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl p-8 md:p-10 text-center cursor-pointer transition-colors border border-dashed ${isDragOver
              ? isDark
                ? 'border-indigo-500 bg-indigo-950/20'
                : 'border-indigo-400 bg-indigo-50'
              : isDark
                ? 'border-gray-700/80 hover:border-gray-500 bg-gray-950/40 hover:bg-gray-950/70'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/30'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.pdf,.txt,.md,.json"
            onClick={(e) => e.stopPropagation()}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-3 ${isDark
                ? 'bg-gray-800 border-gray-700 text-indigo-400'
                : 'bg-indigo-50 border-indigo-200 text-indigo-500'
              }`}
          >
            <UploadCloud className="w-6 h-6" />
          </div>

          <h4 className={`text-sm font-semibold mb-1 ${heading}`}>
            {isUploading ? 'Ingesting and parsing files...' : 'Drag & drop business data here, or browse files'}
          </h4>
          <p className={`text-xs max-w-sm mx-auto mb-4 ${sub}`}>
            Supports CSV, Excel (.xlsx, .xls), PDF documents, Text reports, and Markdown.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {['CSV / Excel (.xlsx, .xls)', 'PDF Documents (.pdf)', 'Text / Reports (.txt, .md)'].map((label) => (
              <span key={label} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${pill}`}>
                {label}
              </span>
            ))}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              disabled={isUploading}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add files
            </button>

            {hasUploadedFiles && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onContinueToQuery(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${isDark
                    ? 'text-gray-950 bg-white hover:bg-gray-100'
                    : 'text-white bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Structured Datasets */}
      <div className={`rounded-2xl border p-6 ${card}`}>
        <div className={`flex items-center justify-between mb-4 pb-3 border-b ${divider}`}>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className={`w-4 h-4 ${isDark ? 'text-cyan-500' : 'text-indigo-500'}`} />
            <h3 className={`text-sm font-semibold ${heading}`}>Structured Tabular Datasets</h3>
            <span className={`text-xs ml-1 ${sub}`}>Spreadsheets, financial logs, and quantitative metrics</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isDark
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-900'
                : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}
          >
            {structuredDatasets.length} {structuredDatasets.length === 1 ? 'Table' : 'Tables'} Loaded
          </span>
        </div>

        {structuredDatasets.length === 0 ? (
          <div className={`p-8 text-center space-y-2 ${sub}`}>
            <FileSpreadsheet className={`w-8 h-8 mx-auto opacity-30 ${iconColor}`} />
            <p className="text-xs">No tabular datasets uploaded yet.</p>
            <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>Upload a CSV or Excel file above to see rows and columns.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {structuredDatasets.map((ds) => (
              <div key={ds.id} className={`rounded-xl border p-4 transition-colors flex flex-col justify-between ${dataCard}`}>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className={`text-xs font-bold truncate ${heading}`}>{ds.name}</h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${mono}`}>
                      {ds.type.toUpperCase()}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs mb-3 ${sub}`}>
                    <span>{ds.rowCount.toLocaleString()} rows</span>
                    <span>·</span>
                    <span>{ds.columns.length} columns</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ds.columns.slice(0, 5).map((col) => (
                      <span key={col.name} className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${mono}`}>
                        {col.name}
                      </span>
                    ))}
                    {ds.columns.length > 5 && (
                      <span className={`px-1.5 py-0.5 text-[10px] ${sub}`}>+{ds.columns.length - 5}</span>
                    )}
                  </div>
                </div>
                <div className={`flex items-center justify-between pt-2.5 border-t text-xs ${divider}`}>
                  <button onClick={() => onViewStructured(ds)} className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${actionLink}`}>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Data</span>
                  </button>
                  <button onClick={() => onDeleteDataset(ds.id)} className="p-1 rounded text-rose-400 hover:text-rose-500 transition-colors cursor-pointer" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unstructured Reports */}
      <div className={`rounded-2xl border p-6 ${card}`}>
        <div className={`flex items-center justify-between mb-4 pb-3 border-b ${divider}`}>
          <div className="flex items-center gap-2.5">
            <FileText className={`w-4 h-4 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`} />
            <h3 className={`text-sm font-semibold ${heading}`}>Unstructured Business Reports</h3>
            <span className={`text-xs ml-1 ${sub}`}>PDFs, corporate filings, memos, and qualitative reports</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isDark
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-900'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
          >
            {unstructuredDatasets.length} {unstructuredDatasets.length === 1 ? 'Document' : 'Documents'} Indexed
          </span>
        </div>

        {unstructuredDatasets.length === 0 ? (
          <div className={`p-8 text-center space-y-2 ${sub}`}>
            <FileText className={`w-8 h-8 mx-auto opacity-30 ${iconColor}`} />
            <p className="text-xs">No documents uploaded yet.</p>
            <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>Upload a PDF or TXT document above to index clauses.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unstructuredDatasets.map((doc) => (
              <div key={doc.id} className={`rounded-xl border p-4 transition-colors flex flex-col justify-between ${dataCard}`}>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className={`text-xs font-bold truncate ${heading}`}>{doc.name}</h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${mono}`}>
                      {doc.type.toUpperCase()}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs mb-3 ${sub}`}>
                    <span>{doc.pageCount || 1} pages</span>
                    <span>·</span>
                    <span>{doc.wordCount.toLocaleString()} words</span>
                  </div>
                  <div className={`p-2.5 rounded-lg text-[11px] line-clamp-2 mb-3 font-mono ${preview}`}>
                    {doc.text.slice(0, 160)}...
                  </div>
                </div>
                <div className={`flex items-center justify-between pt-2.5 border-t text-xs ${divider}`}>
                  <button onClick={() => onViewUnstructured(doc)} className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${actionLink}`}>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Read Chunks</span>
                  </button>
                  <button onClick={() => onDeleteDataset(doc.id)} className="p-1 rounded text-rose-400 hover:text-rose-500 transition-colors cursor-pointer" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};