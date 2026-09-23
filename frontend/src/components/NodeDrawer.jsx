import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Brain,
  History,
  Zap,
  Train,
  CloudSun,
  ShieldAlert,
  CheckCircle2,
  Navigation
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
  const [activeTab, setActiveTab] = useState('shap'); // 'shap' | 'forecast' | 'history' | 'mitigation'
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Current forecast point for the active scrubber hour
  const currentFc = forecastList.find((f) => f.horizon_hour === selectedHour) || forecastList[0] || {};
  const currentScore = currentFc.predicted_congestion ?? (node.current_status?.congestion_score ?? 50);
  const currentRisk = currentFc.risk_level ?? (node.current_status?.risk_level ?? 'MODERATE');

  // Fetch 7-day history when node changes
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

  // Prepare 7-day history chart data
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

  // Mitigation plans based on risk and node category
  const getMitigationStrategies = () => {
    if (currentScore >= 80) {
      return [
        { title: 'Emergency Transit Headway Surge', desc: 'Deploy 4 additional auxiliary Muni/BART shuttle runs to clear platform density.', level: 'Critical' },
        { title: 'Dynamic Pedestrian Diversion Wayfinding', desc: 'Activate digital signage at feeder intersections directing tourists to alternate corridors.', level: 'Critical' },
        { title: 'Station Crowd Marshalling', desc: 'Stagger turnstile intake to maintain safe concourse capacity limits.', level: 'High' }
      ];
    }
    if (currentScore >= 60) {
      return [
        { title: 'Dynamic Transit Frequency Adjustment', desc: 'Shorten Muni headway from 12 mins to 7 mins to absorb incoming tourist surge.', level: 'High' },
        { title: 'Mobile Tour Bus Staging Regulation', desc: 'Hold tour buses at outer perimeter staging zones to prevent curbside blockage.', level: 'Moderate' },
        { title: 'Real-time Flow Notifications', desc: 'Broadcast high-density advisory to municipal transit mobile apps.', level: 'Informational' }
      ];
    }
    return [
      { title: 'Standard Schedule Operation', desc: 'Current flow is well within nominal capacity baseline. No intervention required.', level: 'Optimal' },
      { title: 'Proactive Sensor Telemetry Check', desc: 'All turnstiles and GTFS real-time feeds operating with high fidelity.', level: 'Optimal' }
    ];
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-[500px] lg:w-[560px] glass-panel border-l border-white/10 z-30 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {node.category.replace('_', ' ')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRiskBadge(currentRisk, currentScore)}`}>
              {currentRisk} RISK ({currentScore}/100)
            </span>
          </div>
          <h2 className="text-base lg:text-lg font-bold text-white tracking-tight leading-snug">
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
      <div className="grid grid-cols-3 gap-2.5 p-4 bg-slate-950/60 border-b border-white/5 text-xs">
        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Congestion</span>
          </div>
          <div className="text-base lg:text-lg font-black text-white">{currentScore} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
          <div className="text-[10px] text-slate-400 font-mono">+ {selectedHour}h Horizon</div>
        </div>

        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Train className="w-3.5 h-3.5 text-indigo-400" />
            <span>GTFS Transit</span>
          </div>
          <div className="text-base lg:text-lg font-black text-white">{currentFc.scheduled_trips ?? 14} <span className="text-xs font-normal text-slate-400">trips/h</span></div>
          <div className="text-[10px] text-slate-400 font-mono">Scheduled Muni/BART</div>
        </div>

        <div className="glass-card rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>Weather</span>
          </div>
          <div className="text-base lg:text-lg font-black text-white">{currentFc.temp_c ?? 16}°C</div>
          <div className="text-[10px] text-slate-400 font-mono truncate">{currentFc.weather_condition ?? 'Clear'}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 px-4 bg-slate-900/40 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('shap')}
          className={`flex items-center gap-1.5 py-3 px-3 font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 py-3 px-3 font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'forecast'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>48h Curve</span>
        </button>

        <button
          onClick={() => setActiveTab('mitigation')}
          className={`flex items-center gap-1.5 py-3 px-3 font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'mitigation'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Mitigations</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 py-3 px-3 font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
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
            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  TreeSHAP Feature Attribution
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/10 text-slate-300">
                  Base Value: <strong>{currentFc.shap_base_value ?? 53.4}</strong>
                </span>
              </div>

              {/* Explanatory description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                Mathematical contribution of each feature towards the final congestion prediction of{' '}
                <strong className="text-white font-bold">{currentScore} / 100</strong> at hour +{selectedHour}. Coral bars increase bottleneck risk; cyan bars relieve pressure.
              </p>

              {/* Waterfall Summary Step Pill */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-white/5 text-center text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Base Baseline</span>
                  <strong className="text-slate-300 text-xs">{currentFc.shap_base_value ?? 53.4}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Net Factor Delta</span>
                  <strong className={currentScore >= (currentFc.shap_base_value ?? 53.4) ? 'text-rose-400 text-xs' : 'text-cyan-400 text-xs'}>
                    {currentScore >= (currentFc.shap_base_value ?? 53.4) ? '+' : ''}
                    {(currentScore - (currentFc.shap_base_value ?? 53.4)).toFixed(1)} pts
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Final Prediction</span>
                  <strong className="text-white font-bold text-xs">{currentScore} / 100</strong>
                </div>
              </div>

              {/* Bi-Directional Diverging Feature Rows */}
              <div className="space-y-2.5 pt-2">
                {combinedShapData.map((item, idx) => {
                  const maxAbs = Math.max(...combinedShapData.map((d) => Math.abs(d.impact)), 1);
                  const barWidthPercent = Math.min(100, (Math.abs(item.impact) / maxAbs) * 100);
                  const isPositive = item.impact > 0;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition flex flex-col gap-1.5"
                    >
                      {/* Top text row: Feature name and impact number */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 font-semibold truncate max-w-[280px]">
                          {item.name}
                        </span>
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                            isPositive
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {isPositive ? `+${item.impact}` : item.impact} pts
                        </span>
                      </div>

                      {/* Bi-directional diverging bar (Center anchored at 0) */}
                      <div className="relative w-full h-2 bg-slate-800/80 rounded-full flex items-center overflow-hidden">
                        {/* Center Zero Tick Indicator */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10"></div>

                        {/* Negative bar extending left from center */}
                        {!isPositive && (
                          <div className="w-1/2 flex justify-end h-full">
                            <div
                              className="h-full bg-gradient-to-l from-cyan-400 to-cyan-600 rounded-l-full"
                              style={{ width: `${barWidthPercent}%` }}
                            ></div>
                          </div>
                        )}

                        {/* Positive bar extending right from center */}
                        {isPositive && (
                          <div className="w-1/2 ml-auto flex justify-start h-full">
                            <div
                              className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full"
                              style={{ width: `${barWidthPercent}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 48-HOUR FORECAST CURVE */}
        {activeTab === 'forecast' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  48-Hour Congestion Risk Trajectory
                </h3>
                <span className="text-[10px] font-mono text-cyan-400">Hour +{selectedHour} Selected</span>
              </div>
              <p className="text-xs text-slate-300">
                Hourly forward predictions with automated threshold bands (<span className="text-amber-400 font-bold">35</span>, <span className="text-orange-400 font-bold">60</span>, <span className="text-rose-400 font-bold">80</span>).
              </p>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#475569" width={34} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="glass-panel p-2.5 rounded-xl text-xs shadow-xl border border-white/10 space-y-1">
                            <p className="font-bold text-white font-mono">{data.timeLabel}</p>
                            <p className="text-cyan-400 font-bold font-mono">Score: {data.score}/100 ({data.risk})</p>
                            <p className="text-slate-300">GTFS Transit: {data.trips} trips/h</p>
                            <p className="text-slate-300">Weather: {data.temp}°C</p>
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
                      stroke="#22d3ee"
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

        {/* TAB 3: MITIGATION & ACTION PLAN */}
        {activeTab === 'mitigation' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-cyan-400" />
                Crowd Mitigation & Operations Plan
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                Automated recommendations generated for Muni/BART dispatchers and city crowd managers based on predicted congestion score ({currentScore}/100).
              </p>

              <div className="space-y-2.5">
                {getMitigationStrategies().map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        {item.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                        item.level === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                        item.level === 'High' ? 'bg-orange-500/20 text-orange-400' :
                        item.level === 'Moderate' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 pl-5">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 7-DAY HISTORICAL TREND */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                168-Hour Historical Foot-Traffic & Ridership
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                Demonstrates baseline weekly cycles (weekday commuter flow vs weekend tourist concentration).
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
