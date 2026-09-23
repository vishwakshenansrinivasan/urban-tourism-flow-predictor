import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Brain,
  History,
  Zap,
  Train,
  CloudSun
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { fetchHistory } from '../api';

export default function NodeDrawer({
  node,
  forecastList = [],
  selectedHour = 1,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('shap'); // 'shap' | 'forecast' | 'history'
  const [historyData, setHistoryData] = useState([]);
  // Initialise to true so we don't need a synchronous setState call inside the effect
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Current forecast point for the active scrubber hour
  const currentFc = forecastList.find((f) => f.horizon_hour === selectedHour) || forecastList[0] || {};
  const currentScore = currentFc.predicted_congestion ?? (node.current_status?.congestion_score ?? 50);
  const currentRisk = currentFc.risk_level ?? (node.current_status?.risk_level ?? 'MODERATE');

  // Fetch 7-day history when node changes; use a ref to prevent race conditions
  const loadHistory = useCallback(async (nodeId, signal) => {
    try {
      const data = await fetchHistory(nodeId, 168);
      if (!signal.aborted) {
        setHistoryData(data || []);
        setLoadingHistory(false);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error('Failed to load history:', err);
        setLoadingHistory(false);
      }
    }
  }, []);

  // eslint-disable-next-line react/set-state-in-effect -- setState calls are async (inside fetchHistory await), not synchronous
  useEffect(() => {
    if (!node?.id) return;
    const controller = new AbortController();
    loadHistory(node.id, controller.signal);
    return () => controller.abort();
  }, [node?.id, loadHistory]);

  if (!node) return null;

  // Prepare SHAP chart data
  const positiveFactors = (currentFc.top_positive_factors || []).map((f) => ({
    name: f.feature_name,
    impact: f.impact,
    type: 'positive',
    value: f.feature_value
  }));

  const negativeFactors = (currentFc.top_negative_factors || []).map((f) => ({
    name: f.feature_name,
    impact: f.impact,
    type: 'negative',
    value: f.feature_value
  }));

  const combinedShapData = [...positiveFactors, ...negativeFactors].sort(
    (a, b) => Math.abs(b.impact) - Math.abs(a.impact)
  );

  // Prepare 48h curve data
  const forecastChartData = forecastList.map((f) => {
    const d = new Date(f.forecast_timestamp);
    return {
      hour: f.horizon_hour,
      timeLabel: `+${f.horizon_hour}h (${d.getHours()}:00)`,
      score: f.predicted_congestion,
      risk: f.risk_level,
      trips: f.scheduled_trips,
      temp: f.temp_c
    };
  });

  // Prepare 7-day history chart data (downsampled slightly for smooth rendering)
  const historyChartData = historyData.map((h, idx) => {
    const d = new Date(h.timestamp);
    return {
      index: idx,
      dateLabel: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getHours()}:00`,
      score: h.congestion_score,
      footTraffic: h.foot_traffic,
      ridership: h.ridership_volume
    };
  });

  const getRiskBadge = (risk, score) => {
    if (score < 35) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (score < 60) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (score < 80) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-[500px] lg:w-[560px] glass-panel border-l border-white/10 z-30 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {node.category.replace('_', ' ')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRiskBadge(currentRisk, currentScore)}`}>
              {currentRisk} RISK ({currentScore}/100)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
            {node.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {node.description}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Metrics Row at Selected Hour */}
      <div className="grid grid-cols-3 gap-2.5 p-4 bg-slate-950/40 border-b border-white/5 text-xs">
        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Congestion</span>
          </div>
          <div className="text-lg font-black text-white">{currentScore} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
          <div className="text-[10px] text-slate-400 font-mono">Hour +{selectedHour} Forecast</div>
        </div>

        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Train className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scheduled Transit</span>
          </div>
          <div className="text-lg font-black text-white">{currentFc.scheduled_trips ?? 12} <span className="text-xs font-normal text-slate-400">trips/h</span></div>
          <div className="text-[10px] text-slate-400 font-mono">GTFS Muni/BART</div>
        </div>

        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>Weather</span>
          </div>
          <div className="text-lg font-black text-white">{currentFc.temp_c ?? 15}°C</div>
          <div className="text-[10px] text-slate-400 font-mono truncate">{currentFc.weather_condition ?? 'Clear'}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 px-4 bg-slate-900/40">
        <button
          onClick={() => setActiveTab('shap')}
          className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'shap'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>SHAP Explainability</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'forecast'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>48h Curve</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'history'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>7-Day History</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* TAB 1: SHAP EXPLAINABILITY */}
        {activeTab === 'shap' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  TreeSHAP Feature Attribution
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Base: <strong>{currentFc.shap_base_value ?? 53.4}</strong>
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Exact mathematical breakdown of <strong>why</strong> the model predicts a congestion score of{' '}
                <strong className="text-white">{currentScore}</strong> at hour +{selectedHour}. Positive values (coral) push bottleneck risk UP; negative values (cyan) relieve flow.
              </p>

              {/* Horizontal Divergence Bar Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={combinedShapData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={160}
                      stroke="#64748b"
                      tick={{ fill: '#cbd5e1', fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="glass-panel p-2.5 rounded-lg text-xs shadow-xl border border-white/10">
                            <p className="font-bold text-white">{data.name}</p>
                            <p className="text-slate-300 mt-1">
                              Impact:{' '}
                              <strong className={data.impact > 0 ? 'text-rose-400' : 'text-cyan-400'}>
                                {data.impact > 0 ? `+${data.impact}` : data.impact} pts
                              </strong>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Bar dataKey="impact" radius={[4, 4, 4, 4]}>
                      {combinedShapData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.impact > 0 ? '#f87171' : '#22d3ee'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Explanatory Cards */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Key Congestion Drivers
              </h4>
              <div className="space-y-1.5">
                {positiveFactors.slice(0, 3).map((pf, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs"
                  >
                    <span className="text-slate-200">{pf.name}</span>
                    <span className="font-mono font-bold text-rose-400">+{pf.impact} pts</span>
                  </div>
                ))}
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-3">
                Key Relief & Capacity Factors
              </h4>
              <div className="space-y-1.5">
                {negativeFactors.slice(0, 3).map((nf, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs"
                  >
                    <span className="text-slate-200">{nf.name}</span>
                    <span className="font-mono font-bold text-cyan-400">{nf.impact} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 48-HOUR FORECAST CURVE */}
        {activeTab === 'forecast' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                48-Hour Congestion Risk Trajectory
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                XGBoost forward trajectory with threshold bands (Moderate: 35, High: 60, Severe: 80).
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="glass-panel p-2.5 rounded-lg text-xs shadow-xl border border-white/10">
                            <p className="font-bold text-white">{data.timeLabel}</p>
                            <p className="text-cyan-400 font-bold mt-1">Score: {data.score}/100 ({data.risk})</p>
                            <p className="text-slate-300">Transit: {data.trips} trips/hr</p>
                            <p className="text-slate-300">Temp: {data.temp}°C</p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#f97316" strokeDasharray="3 3" />
                    <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine x={selectedHour} stroke="#38bdf8" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#scoreGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 7-DAY HISTORICAL TREND */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                168-Hour Historical Foot-Traffic & Ridership
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                Demonstrates the baseline diurnal cycles (weekday morning/evening rush vs weekend tourist flow).
              </p>

              {loadingHistory ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Loading historical records...
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="dateLabel" interval={24} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="glass-panel p-2.5 rounded-lg text-xs shadow-xl border border-white/10">
                              <p className="font-bold text-white">{data.dateLabel}</p>
                              <p className="text-cyan-400">Congestion: {data.score}/100</p>
                              <p className="text-indigo-400">Foot Traffic: {data.footTraffic}</p>
                              <p className="text-emerald-400">Ridership: {data.ridership}</p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                        name="Congestion"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
