import React from 'react';
import {
  Activity,
  ShieldAlert,
  Cpu,
  Award,
  Map,
  BarChart2,
  Grid,
  Radio
} from 'lucide-react';

export default function Header({
  summary,
  currentView = 'map',
  onSelectView,
  onOpenBenchmarks,
  onToggleAssistant,
  isAssistantOpen = false
}) {
  const avgScore = summary?.city_average_congestion ?? 48;
  const bottleneck = summary?.highest_current_bottleneck;

  const getScoreColor = (score) => {
    if (score < 35) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score < 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (score < 80) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <header className="glass-panel border-b border-white/10 px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>URBAN FLOW</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                CHENNAI PREDICTOR
              </span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            CMRL Metro, Suburban Rail & Tourism Spatio-Temporal Forecaster
          </p>
        </div>
      </div>

      {/* Main View Navigation Tabs */}
      <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs">
        <button
          onClick={() => onSelectView('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            currentView === 'map'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Live Flow Map</span>
        </button>

        <button
          onClick={() => onSelectView('accuracy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            currentView === 'accuracy'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Model Accuracy & Scores</span>
        </button>

        <button
          onClick={() => onSelectView('matrix')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            currentView === 'matrix'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Hub Matrix (12)</span>
        </button>
      </nav>

      {/* Right Stats, Benchmarks & AI Bot Button */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* City Average Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getScoreColor(avgScore)}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
          <span>Avg Congestion: <strong>{avgScore}</strong>/100</span>
        </div>

        {/* Top Bottleneck Alert */}
        {bottleneck && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate max-w-[140px]">
              Peak: <strong>{bottleneck.node_name.split('&')[0]}</strong> ({bottleneck.congestion_score})
            </span>
          </div>
        )}

        {/* Model Tech Badge */}
        <button
          onClick={onOpenBenchmarks}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold transition cursor-pointer"
          title="Quick Model Benchmarks"
        >
          <Award className="w-3.5 h-3.5 text-indigo-400" />
          <span>R² 0.982</span>
        </button>

        {/* Ask PulseAI Assistant Button */}
        <button
          onClick={onToggleAssistant}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border shadow-sm ${
            isAssistantOpen
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white border-cyan-400 shadow-cyan-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 hover:text-white border-cyan-500/30 hover:border-cyan-400'
          }`}
          title="Toggle PulseAI Question Assistant"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ask AI Bot</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      </div>
    </header>
  );
}
