import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, TrendingUp, FileSpreadsheet, FileText, Sparkles, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface QueryHeroProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  currentQuery: string;
  datasetCount?: number;
  datasetNames?: string[];
  onNavigateToDataPortal?: () => void;
}

export const QueryHero: React.FC<QueryHeroProps> = ({
  onSearch,
  isLoading,
  currentQuery,
  datasetCount = 0,
  datasetNames = [],
}) => {
  const { isDark } = useTheme();
  const [inputVal, setInputVal] = useState(currentQuery);

  useEffect(() => { setInputVal(currentQuery); }, [currentQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim() && !isLoading) onSearch(inputVal.trim());
  };

  const handleSelectPrompt = (query: string) => { setInputVal(query); onSearch(query); };

  const prompts = datasetCount > 0 && datasetNames.length > 0
    ? [
        { label: 'Executive Summary', query: `Provide an executive summary of key metrics in ${datasetNames[0]}.`, icon: TrendingUp },
        { label: 'Outliers & Variances', query: 'Identify highest and lowest outliers and variances in the data.', icon: FileSpreadsheet },
        { label: 'Cross-Source Synthesis', query: 'Synthesize findings across all uploaded files and correlations.', icon: FileText },
        { label: 'Decision Recommendations', query: 'What top recommendations should we execute based on this data?', icon: Sparkles },
      ]
    : [
        { label: 'Tabular Analysis', query: 'What are the total records, averages, and statistical distributions?', icon: FileSpreadsheet },
        { label: 'Document Clauses', query: 'Extract executive summary and primary clauses from the reports.', icon: FileText },
        { label: 'Variance Analysis', query: 'Compare key metrics across categories and explain variances.', icon: TrendingUp },
        { label: 'Strategic Directives', query: 'Identify operational bottlenecks and recommend actions.', icon: Sparkles },
      ];

  const card = isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const inputBg = isDark
    ? 'bg-gray-950 border-gray-700/80 focus-within:border-gray-500'
    : 'bg-slate-50 border-slate-300 focus-within:border-indigo-400';
  const inputText = isDark ? 'text-white placeholder:text-gray-500' : 'text-slate-900 placeholder:text-slate-400';
  const promptCard = isDark
    ? 'border-gray-800 bg-gray-950/40 hover:bg-gray-800/40 hover:border-gray-700'
    : 'border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300';
  const promptIcon = isDark ? 'bg-gray-800 text-gray-400' : 'bg-indigo-50 text-indigo-500';
  const promptTitle = isDark ? 'text-white' : 'text-slate-800';
  const promptSub = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <div className={`rounded-2xl border p-6 md:p-8 ${card}`}>
      <div className="max-w-3xl mx-auto text-center mb-6">
        <h1 className={`text-2xl font-bold tracking-tight ${heading}`}>Pulse & Query Portal</h1>
        <p className={`mt-1.5 text-xs max-w-lg mx-auto ${sub}`}>
          Ask operational questions across your uploaded data. Every answer is grounded with verifiable evidence citations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-6">
        <div className={`relative flex items-center rounded-xl border transition-colors ${inputBg}`}>
          <div className={`pl-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
            {isLoading
              ? <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-gray-300' : 'text-indigo-500'}`} />
              : <Search className="w-4 h-4" />}
          </div>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              datasetCount > 0
                ? `Ask anything about your ${datasetCount} uploaded dataset(s)...`
                : 'Upload data in the Data Portal, then query it here...'
            }
            disabled={isLoading}
            className={`w-full pl-3 pr-28 py-3.5 bg-transparent text-sm outline-none font-medium ${inputText}`}
          />
          <div className="pr-2 shrink-0">
            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-white hover:bg-gray-100 disabled:bg-gray-800 text-gray-950 disabled:text-gray-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400'
              }`}
            >
              <span>{isLoading ? 'Analyzing...' : 'Ask AI'}</span>
              {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </form>

      <div className="max-w-3xl mx-auto">
        <div className={`text-[11px] font-medium uppercase tracking-wider mb-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
          Suggested Prompts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {prompts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPrompt(item.query)}
                disabled={isLoading}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${promptCard}`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${promptIcon}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold mb-0.5 truncate ${promptTitle}`}>{item.label}</div>
                  <div className={`text-xs line-clamp-1 ${promptSub}`}>{item.query}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
