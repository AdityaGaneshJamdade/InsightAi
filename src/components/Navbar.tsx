
import React from 'react';
import {
  Database,
  CheckCircle2,
  FileDown,
  Trash2,
  Cpu,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'insights' | 'data' | 'approvals';
  setActiveTab: (tab: 'insights' | 'data' | 'approvals') => void;
  datasetCount: number;
  pendingApprovalsCount: number;
  onClearData: () => void;
  onOpenExport: () => void;
  isClearing: boolean;
  hasGeminiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  datasetCount,
  pendingApprovalsCount,
  onClearData,
  onOpenExport,
  isClearing,
  hasGeminiKey,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const onToggleTheme = toggleTheme;

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${isDark
        ? 'bg-[#090d16]/80 border-slate-800/80 shadow-md shadow-black/20'
        : 'bg-white/80 border-slate-200/80 shadow-sm'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setActiveTab('insights')}
          >
            <div
              className={`w-9 h-9 rounded-xl overflow-hidden border p-0.5 flex items-center justify-center shrink-0 transition-colors ${isDark
                ? 'bg-slate-900 border-slate-700/80'
                : 'bg-slate-100 border-slate-200'
                }`}
            >
              <img
                src="/logo.png"
                alt="InsightAI Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold tracking-tight text-base ${isDark ? 'text-white' : 'text-slate-900'
                    }`}
                >
                  InsightAI
                </span>

                <span
                  className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${isDark
                    ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/50'
                    : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    }`}
                >
                  Decision Engine
                </span>


              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Workflow steps"
            className={`flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md transition-colors ${isDark
              ? 'bg-slate-900/60 border-slate-800'
              : 'bg-slate-100/80 border-slate-200'
              }`}
          >
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'data'
                ? isDark
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'bg-white text-indigo-600 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              <span>Data Portal</span>

              {datasetCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${isDark
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                    : 'bg-cyan-100 text-cyan-700'
                    }`}
                >
                  {datasetCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'insights'
                ? isDark
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'bg-white text-indigo-600 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>Query Portal</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'approvals'
                ? isDark
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'bg-white text-indigo-600 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Review Queue</span>

              {pendingApprovalsCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${isDark
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                    : 'bg-amber-100 text-amber-800'
                    }`}
                >
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </nav>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">

            {datasetCount > 0 && (
              <button
                onClick={onClearData}
                disabled={isClearing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {isClearing ? 'Clearing...' : 'Clear'}
                </span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={`Current theme: ${isDark ? 'Dark' : 'Light'}. Click to switch to ${isDark ? 'Light' : 'Dark'} mode.`}
              aria-label={`Current theme is ${isDark ? 'Dark' : 'Light'}. Switch theme`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${isDark
                ? 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              {isDark ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            {/* Export Decisions */}
            <button
              onClick={onOpenExport}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm ${isDark
                ? 'text-slate-950 bg-white hover:bg-slate-100'
                : 'text-white bg-slate-900 hover:bg-slate-800'
                }`}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export Decisions</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};