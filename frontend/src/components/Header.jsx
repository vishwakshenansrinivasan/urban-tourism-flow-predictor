import React from 'react';
import {
  Activity,
  ShieldAlert,
  Cpu,
  Award,
  Map,
  BarChart2,
  Grid,
} from 'lucide-react';

export default function Header({
  summary,
  avgScore: dynamicAvgScore,
  bottleneck: dynamicBottleneck,
  selectedHour = 1,
  currentView = 'map',
  onSelectView,
  onOpenBenchmarks,
  onToggleAssistant,
  isAssistantOpen = false
}) {
  const avgScore = dynamicAvgScore ?? summary?.city_average_congestion ?? 48;
  const bottleneck = dynamicBottleneck ?? summary?.highest_current_bottleneck;

  const getScoreStyle = (score) => {
    if (score < 35) return 'risk-low';
    if (score < 60) return 'risk-moderate';
    if (score < 80) return 'risk-high';
    return 'risk-critical';
  };

  const views = [
    { id: 'map',      label: 'Live Flow Map',  icon: Map },
    { id: 'accuracy', label: 'Model Accuracy', icon: BarChart2 },
    { id: 'matrix',   label: 'Hub Matrix',     icon: Grid },
  ];

  return (
    <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 tracking-tight">
              Urban Flow
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
              CHENNAI · PULSE
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block font-normal">
            CMRL Metro · Suburban Rail · Tourism Spatio-Temporal Forecaster
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelectView(id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              currentView === id
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center flex-wrap gap-2">
        {/* City Average Pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${getScoreStyle(avgScore)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          <span>Avg: <strong>{avgScore}</strong>/100</span>
          {selectedHour > 1 && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/5 font-mono opacity-80">+{selectedHour}h</span>
          )}
        </div>

        {/* Top Bottleneck */}
        {bottleneck && (
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-lg risk-critical text-xs font-medium transition-all">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[140px]">
              Peak: <strong>{bottleneck.node_name.split('&')[0]}</strong> ({Math.round(bottleneck.congestion_score ?? 0)})
            </span>
          </div>
        )}

        {/* R² Badge */}
        <button
          onClick={onOpenBenchmarks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-secondary text-xs font-medium cursor-pointer"
          title="Quick Model Benchmarks"
        >
          <Award className="w-3.5 h-3.5 text-indigo-600" />
          <span className="font-mono text-slate-700">R² 0.982</span>
        </button>

        {/* PulseAI Toggle */}
        <button
          onClick={onToggleAssistant}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${
            isAssistantOpen
              ? 'btn-primary'
              : 'btn-secondary text-slate-700'
          }`}
          title="Toggle PulseAI Assistant"
        >
          <Cpu className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ask PulseAI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </button>
      </div>
    </header>
  );
}
