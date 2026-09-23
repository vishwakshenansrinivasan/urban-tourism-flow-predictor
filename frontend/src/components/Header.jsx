import React from 'react';
import { Activity, ShieldAlert, Cpu, Award } from 'lucide-react';

export default function Header({ summary, onOpenBenchmarks }) {
  const avgScore = summary?.city_average_congestion ?? 50;
  const bottleneck = summary?.highest_current_bottleneck;

  const getScoreColor = (score) => {
    if (score < 35) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score < 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (score < 80) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <header className="glass-panel border-b border-white/10 px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-20">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>URBAN FLOW</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                PREDICTOR
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            San Francisco GTFS Transit & Tourism Spatio-Temporal Forecaster
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-3">
        {/* City Average Pill */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${getScoreColor(avgScore)}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
          <span>City Average: <strong className="font-bold">{avgScore}</strong> / 100</span>
        </div>

        {/* Top Bottleneck Alert */}
        {bottleneck && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate max-w-xs">
              Peak: <strong>{bottleneck.node_name.split('&')[0]}</strong> ({bottleneck.congestion_score})
            </span>
          </div>
        )}

        {/* Model Tech Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-300 text-xs">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>XGBoost + TreeSHAP</span>
        </div>

        {/* Benchmarks Button */}
        <button
          onClick={onOpenBenchmarks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold transition cursor-pointer"
        >
          <Award className="w-3.5 h-3.5 text-indigo-400" />
          <span>Model Benchmark</span>
        </button>
      </div>
    </header>
  );
}
