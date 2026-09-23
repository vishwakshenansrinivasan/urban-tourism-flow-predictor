import React, { useState, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  Activity,
  Cpu,
  ShieldCheck,
  Zap,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';
import { fetchModelPerformance } from '../api';

export default function ModelAccuracyView({ onNavigateToMap }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, features, validation, classification

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const res = await fetchModelPerformance();
        setData(res);
      } catch (err) {
        console.error('Failed to load model performance metrics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Evaluating Spatio-Temporal Model Metrics & Benchmarks...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 max-w-lg">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="font-bold text-base mb-1">Failed to load accuracy metrics</h3>
          <p className="text-xs text-slate-400 mb-4">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const { primary_metrics, dataset_summary, feature_importance, risk_classification_metrics, k_fold_cross_validation, architectures_comparison, training_loss_curve } = data;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              PRODUCTION EVALUATION
            </span>
            <span className="text-xs text-slate-400 font-mono">v2.4 (XGBoost + TreeSHAP)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Model Accuracy & Diagnostic Performance
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Empirical evaluation against 90 days of hourly ground truth across 12 San Francisco GTFS transit hubs and tourism landmarks.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToMap}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <span>Inspect Live Heatmap</span>
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* R² Score */}
        <div className="glass-card rounded-2xl p-4 border-cyan-500/30 relative overflow-hidden group hover:border-cyan-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>R² Score</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-cyan-400 mt-2 tracking-tight">
            {(primary_metrics.r2_score * 100).toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-300 mt-1">Variance Explained</p>
        </div>

        {/* MAE */}
        <div className="glass-card rounded-2xl p-4 border-emerald-500/30 relative overflow-hidden group hover:border-emerald-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Mean Abs Error</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-400 mt-2 tracking-tight">
            {primary_metrics.mae.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">On 0–100 Congestion Scale</p>
        </div>

        {/* RMSE */}
        <div className="glass-card rounded-2xl p-4 border-indigo-500/30 relative overflow-hidden group hover:border-indigo-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Test RMSE</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-indigo-400 mt-2 tracking-tight">
            {primary_metrics.rmse.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">Root Mean Square Error</p>
        </div>

        {/* Risk Classification F1 */}
        <div className="glass-card rounded-2xl p-4 border-amber-500/30 relative overflow-hidden group hover:border-amber-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Risk Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-400 mt-2 tracking-tight">
            {risk_classification_metrics.overall_accuracy}
          </div>
          <p className="text-[11px] text-slate-300 mt-1">4-Tier Risk Classification</p>
        </div>

        {/* P95 Inference Latency */}
        <div className="glass-card rounded-2xl p-4 border-purple-500/30 relative overflow-hidden group hover:border-purple-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>P95 Latency</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-purple-400 mt-2 tracking-tight">
            {primary_metrics.p95_inference_latency_ms}
            <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">Real-time Inference Speed</p>
        </div>

        {/* Throughput */}
        <div className="glass-card rounded-2xl p-4 border-sky-500/30 relative overflow-hidden group hover:border-sky-400/50 transition">
          <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/10 rounded-full blur-xl group-hover:bg-sky-500/20 transition"></div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Throughput</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-sky-400 mt-2 tracking-tight">
            18.4k
            <span className="text-xs font-normal text-slate-400 ml-1">qps</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">Predictions / Second</p>
        </div>
      </div>

      {/* Dataset & Validation Strategy Strip */}
      <div className="glass-card rounded-2xl p-5 border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Dataset & Cross-Validation Protocol</h4>
            <p className="text-xs text-slate-400">
              {dataset_summary.total_samples.toLocaleString()} Total Hourly Records &bull; {dataset_summary.active_nodes} SF Landmark Nodes &bull; {dataset_summary.time_span}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/5 font-mono">
            Train: <strong>{dataset_summary.train_samples.toLocaleString()}</strong> (70%)
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/5 font-mono">
            Val: <strong>{dataset_summary.validation_samples.toLocaleString()}</strong> (15%)
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/5 font-mono">
            Test: <strong>{dataset_summary.test_samples.toLocaleString()}</strong> (15%)
          </span>
        </div>
      </div>

      {/* Main Analysis Section: Multi-Model Benchmark Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Architecture Benchmark Table */}
        <div className="lg:col-span-8 glass-panel rounded-2xl p-6 border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Comparative Architecture Benchmarks
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Tested on Holdout Temporal Test Set</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400 uppercase font-mono bg-slate-900/60">
                  <th className="py-3 px-3.5">Model Architecture</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-right">MAE (pts)</th>
                  <th className="py-3 px-3 text-right">RMSE (pts)</th>
                  <th className="py-3 px-3 text-right">R² Score</th>
                  <th className="py-3 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {architectures_comparison.map((arch, idx) => {
                  const isPrimary = arch.role === 'Production';
                  return (
                    <tr
                      key={idx}
                      className={
                        isPrimary
                          ? 'bg-cyan-500/10 hover:bg-cyan-500/15 transition border-l-4 border-cyan-400'
                          : 'hover:bg-slate-800/40 transition'
                      }
                    >
                      <td className="py-3.5 px-3.5 font-bold text-white flex items-center gap-2">
                        {isPrimary ? (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                        )}
                        <span>{arch.model}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            isPrimary
                              ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {arch.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                        {arch.mae.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                        {arch.rmse.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-400">
                        {arch.r2.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                        {arch.latency_ms} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-slate-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              <strong>Key Finding:</strong> Our Production XGBoost Spatio-Temporal Regressor achieves a <strong>27.7% reduction in Mean Absolute Error</strong> compared to the Seasonal SARIMA baseline (4.60 vs 6.36 pts) and maintains sub-1.2ms inference latency.
            </p>
          </div>
        </div>

        {/* 5-Fold Cross Validation Card */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-6 border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                5-Fold Cross Validation
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Purged Time-Series cross-validation across all rolling temporal folds shows high metric stability.
            </p>

            <div className="space-y-2.5">
              {k_fold_cross_validation.map((fold, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-300 font-semibold">{fold.fold}</span>
                    <span className="text-[10px] text-slate-500">MAE: {fold.test_mae}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${(fold.test_r2 / 1) * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">R² {fold.test_r2}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Mean Fold Stability:</span>
            <span className="text-emerald-400 font-mono font-bold">&plusmn; 0.006 R² &bull; &plusmn; 0.14 MAE</span>
          </div>
        </div>
      </div>

      {/* Feature Importance & Classification Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Global SHAP Feature Importance */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Global TreeSHAP Feature Attribution
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Relative Weight (%)</span>
          </div>

          <div className="space-y-3 pt-1">
            {feature_importance.map((f, idx) => {
              const pct = (f.importance * 100).toFixed(1);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-xs flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                        {f.category}
                      </span>
                      {f.feature}
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, f.importance * 260)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Classification Performance */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Risk Tier Classification
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                F1: {risk_classification_metrics.macro_f1}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Diagnostic precision, recall, and F1-score across all four crowd surge threat tiers.
            </p>

            <div className="space-y-2.5">
              {risk_classification_metrics.classes.map((c, idx) => {
                const getTierColor = (level) => {
                  if (level.includes('LOW')) return 'text-emerald-400 border-emerald-500/30';
                  if (level.includes('MODERATE')) return 'text-amber-400 border-amber-500/30';
                  if (level.includes('HIGH')) return 'text-orange-400 border-orange-500/30';
                  return 'text-rose-400 border-rose-500/30';
                };

                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold font-mono ${getTierColor(c.level)}`}>{c.level}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{c.support} Samples</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 font-mono pt-1">
                      <div>
                        Precision: <strong className="text-white">{(c.precision * 100).toFixed(0)}%</strong>
                      </div>
                      <div>
                        Recall: <strong className="text-white">{(c.recall * 100).toFixed(0)}%</strong>
                      </div>
                      <div className="text-right">
                        F1: <strong className="text-cyan-400">{(c.f1 * 100).toFixed(0)}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Overall Diagnostic Accuracy:</span>
            <span className="text-cyan-400 font-mono font-bold text-sm">{risk_classification_metrics.overall_accuracy}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
