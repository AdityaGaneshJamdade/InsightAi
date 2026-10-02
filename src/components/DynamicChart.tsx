import React, { useState } from 'react';
import { ChartConfig } from '../types';
import { useTheme } from '../context/ThemeContext';

interface DynamicChartProps {
  chartConfig?: ChartConfig;
}

const PALETTE_DARK = [
  '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#e2e8f0', '#38bdf8',
];

const PALETTE_LIGHT = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

export const DynamicChart: React.FC<DynamicChartProps> = ({ chartConfig }) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
  const [hoveredBar, setHoveredBar] = useState<{ series: string; category: string; value: number } | null>(null);

  if (!chartConfig || !chartConfig.categories || chartConfig.categories.length === 0) {
    return null;
  }

  const { title, subtitle, categories, series } = chartConfig;
  const PALETTE = isDark ? PALETTE_DARK : PALETTE_LIGHT;

  let maxVal = 0;
  series.forEach((s) => { s.data.forEach((v) => { if (v > maxVal) maxVal = v; }); });
  if (maxVal === 0) maxVal = 10;
  const niceMax = Math.ceil(maxVal * 1.15);

  return (
    <div className={`rounded-2xl border p-5 md:p-6 mb-6 ${
      isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3 mb-4 ${
        isDark ? 'border-gray-800' : 'border-slate-200'
      }`}>
        <div>
          <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{subtitle}</p>}
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-lg border self-start sm:self-auto ${
          isDark ? 'bg-gray-950 border-gray-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
              activeTab === 'chart'
                ? isDark ? 'bg-gray-800 text-white font-medium' : 'bg-white text-slate-900 font-medium shadow-sm'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Visual
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
              activeTab === 'table'
                ? isDark ? 'bg-gray-800 text-white font-medium' : 'bg-white text-slate-900 font-medium shadow-sm'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {activeTab === 'chart' ? (
        <div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {series.map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{s.name}</span>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="h-60 sm:h-64 w-full pt-2">
            <div className="flex h-full w-full">
              <div className={`flex flex-col justify-between text-right pr-2 pb-6 text-[10px] font-mono select-none ${
                isDark ? 'text-gray-500' : 'text-slate-400'
              }`}>
                <span>{niceMax}</span>
                <span>{Math.round(niceMax * 0.5)}</span>
                <span>0</span>
              </div>

              <div className={`relative flex-1 flex flex-col justify-between border-l border-b ${
                isDark ? 'border-gray-800' : 'border-slate-300'
              }`}>
                <div className="relative z-10 flex-1 flex items-end justify-around px-2 pb-0.5">
                  {categories.map((cat, catIdx) => (
                    <div key={catIdx} className="flex-1 flex flex-col items-center max-w-[100px] px-1 group">
                      <div className="w-full flex items-end justify-center gap-1 h-48 sm:h-52">
                        {series.map((s, sIdx) => {
                          const val = s.data[catIdx] ?? 0;
                          const heightPct = Math.max(4, Math.min(100, (val / niceMax) * 100));
                          const color = PALETTE[sIdx % PALETTE.length];
                          return (
                            <div
                              key={sIdx}
                              onMouseEnter={() => setHoveredBar({ series: s.name, category: cat, value: val })}
                              onMouseLeave={() => setHoveredBar(null)}
                              className="relative flex-1 rounded-t-sm transition-opacity hover:opacity-80 cursor-pointer"
                              style={{ height: `${heightPct}%`, backgroundColor: color }}
                            />
                          );
                        })}
                      </div>
                      <span className={`mt-2 text-[10px] truncate w-full text-center ${
                        isDark ? 'text-gray-400' : 'text-slate-500'
                      }`}>
                        {cat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {hoveredBar && (
              <div className={`mt-2 text-xs font-mono ${isDark ? 'text-gray-300' : 'text-slate-500'}`}>
                {hoveredBar.category}: <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{hoveredBar.series} = {hoveredBar.value}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDark ? 'bg-gray-950 text-gray-400 border-gray-800' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <tr>
                <th className="py-2.5 px-3">Dimension</th>
                {series.map((s, idx) => (
                  <th key={idx} className="py-2.5 px-3 text-right">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${isDark ? 'divide-gray-800/80' : 'divide-slate-100'}`}>
              {categories.map((cat, catIdx) => (
                <tr key={catIdx} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'}>
                  <td className={`py-2 px-3 font-sans ${isDark ? 'text-white' : 'text-slate-800'}`}>{cat}</td>
                  {series.map((s, sIdx) => (
                    <td key={sIdx} className={`py-2 px-3 text-right ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      {s.data[catIdx] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
