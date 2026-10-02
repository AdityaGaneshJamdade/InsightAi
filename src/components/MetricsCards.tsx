import React from 'react';
import { KeyMetric } from '../types';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface MetricsCardsProps {
  metrics: KeyMetric[];
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics }) => {
  const { isDark } = useTheme();

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={`rounded-xl border p-4 ${
            isDark
              ? 'bg-gray-900/60 border-gray-800'
              : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className={`text-xs uppercase tracking-wider truncate ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {metric.label}
            </span>
            {metric.change && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                {metric.isPositive
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : <TrendingDown className="w-3 h-3 text-red-500" />}
                <span>{metric.change}</span>
              </span>
            )}
          </div>

          <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metric.value}
          </div>

          {metric.subtext && (
            <p className={`mt-1 text-xs truncate ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              {metric.subtext}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
