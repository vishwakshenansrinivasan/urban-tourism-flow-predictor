import React from 'react';
import { X, Award, CheckCircle2, Cpu, ShieldCheck, TrendingDown } from 'lucide-react';

export default function BenchmarksModal({ isOpen, onClose, benchmarks = [] }) {
  if (!isOpen) return null;

  const xgbBench = benchmarks.find((b) => b.model_name.includes('XGBoost')) || {
    mae: 4.40, rmse: 5.64, r2: 0.938
  };
  const baselineBench = benchmarks.find((b) => b.model_name.includes('Baseline') || b.model_name.includes('SARIMA')) || {
    mae: 6.31, rmse: 8.63, r2: 0.855
  };
  const errorReduction = ((baselineBench.mae - xgbBench.mae) / baselineBench.mae * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Model Evaluation & Benchmarks
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                XGBoost Spatio-Temporal Regressor vs SARIMA Seasonal Baseline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg btn-secondary text-slate-400 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">

          {/* Hero Metrics */}
          <div className="grid grid-cols-3 gap-3.5">
            {[
              {
                label: 'MAE Reduction',
                value: `-${errorReduction}%`,
                sub: 'vs Seasonal Baseline',
                cls: 'text-indigo-600',
                border: 'border-slate-200',
                icon: TrendingDown
              },
              {
                label: 'XGBoost Test R²',
                value: xgbBench.r2?.toFixed(3) ?? '0.938',
                sub: 'Variance Explained',
                cls: 'text-emerald-600',
                border: 'border-slate-200',
                icon: CheckCircle2
              },
              {
                label: 'XGBoost MAE',
                value: `${xgbBench.mae?.toFixed(2) ?? '4.40'} pts`,
                sub: 'On 0–100 Scale',
                cls: 'text-blue-600',
                border: 'border-slate-200',
                icon: Award
              }
            ].map(({ label, value, sub, cls, border, icon: Icon }) => (
              <div key={label} className={`bg-slate-50 rounded-xl p-3.5 border ${border}`}>
                <div className={`${cls} mb-1`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">{label}</span>
                <div className={`text-2xl font-bold ${cls} mt-0.5 font-mono`}>{value}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                  <th className="px-4 py-2.5">Model Architecture</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-right">MAE</th>
                  <th className="px-4 py-2.5 text-right">RMSE</th>
                  <th className="px-4 py-2.5 text-right">R² Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="bg-indigo-50/40 hover:bg-indigo-50/70 transition">
                  <td className="px-4 py-2.5 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      XGBoost Regressor
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-indigo-700 font-semibold">Production Model</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{xgbBench.mae?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{xgbBench.rmse?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600">{xgbBench.r2?.toFixed(3)}</td>
                </tr>
                <tr className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2.5 text-slate-700">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      SARIMA Seasonal Baseline
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">Statistical Benchmark</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">{baselineBench.mae?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">{baselineBench.rmse?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">{baselineBench.r2?.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Methodology */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed text-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero-Leakage Temporal Cross-Validation</span>
            </div>
            <p className="text-slate-500">
              Splits are generated sequentially along the temporal axis (70% train, 15% validation, 15% test).
              Lag features (t−1, t−24, t−168) and rolling windows strictly use backward-looking data windows,
              guaranteeing no future-leak into feature computation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg btn-secondary text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
