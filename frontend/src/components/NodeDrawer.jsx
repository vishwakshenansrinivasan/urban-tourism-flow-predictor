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
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
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

  const getRiskBadge = (score) => {
    if (score < 35) return 'risk-low';
    if (score < 60) return 'risk-moderate';
    if (score < 80) return 'risk-high';
    return 'risk-critical';
  };

  // Mitigation plans based on risk and node category in Chennai
  const getMitigationStrategies = () => {
    if (currentScore >= 80) {
      return [
        { title: 'Emergency CMRL Metro & EMU Surge Dispatch', desc: 'Deploy 4 additional auxiliary CMRL Metro train runs & suburban EMU rakes to clear platform crowd density.', level: 'Critical' },
        { title: 'Pedestrian Skywalk & Road Diversion', desc: 'Activate MTC traffic police diversion at feeder junctions and open full pedestrian skywalk capacity.', level: 'Critical' },
        { title: 'Terminal Gate & Concourse Marshalling', desc: 'Stagger turnstile automatic fare collection intake to maintain safe platform capacity limits.', level: 'High' }
      ];
    }
    if (currentScore >= 60) {
      return [
        { title: 'Dynamic MTC Feeder Frequency Adjustment', desc: 'Shorten MTC feeder bus headway from 15 mins to 8 mins to absorb incoming weekend beach/shopping surge.', level: 'High' },
        { title: 'Auto-Rickshaw & Cab Staging Regulation', desc: 'Regulate designated outer perimeter pickup zones to prevent arterial road blockages.', level: 'Moderate' },
        { title: 'Real-time Flow Advisory', desc: 'Broadcast live crowd density advisory to Chennai Transit & CMRL mobile passenger apps.', level: 'Informational' }
      ];
    }
    return [
      { title: 'Standard Transit Operation', desc: 'Current pedestrian and transit volume is well within nominal capacity baseline. No intervention needed.', level: 'Optimal' },
      { title: 'Continuous Sensor Telemetry Active', desc: 'All turnstiles, MTC GPS feeds, and CMRL passenger sensors operating with normal latency.', level: 'Optimal' }
    ];
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-[500px] lg:w-[540px] bg-white border-l border-slate-200 z-30 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden animate-slide-right">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {node.category.replace(/_/g, ' ')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getRiskBadge(currentScore)}`}>
              {currentRisk} ({currentScore}/100)
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 leading-snug">
            {node.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {node.description}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg btn-secondary text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Row at Selected Hour */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-100 bg-slate-50 text-xs">
        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-mono uppercase tracking-wide text-[10px]">Congestion</span>
          </div>
          <div className="text-base font-bold text-slate-900">{currentScore} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
          <div className="text-[10px] text-slate-400 font-mono">+{selectedHour}h Horizon</div>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Train className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-mono uppercase tracking-wide text-[10px]">Transit</span>
          </div>
          <div className="text-base font-bold text-slate-900">{currentFc.scheduled_trips ?? 14} <span className="text-xs font-normal text-slate-400">trips/h</span></div>
          <div className="text-[10px] text-slate-400 font-mono">CMRL / EMU / MTC</div>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono uppercase tracking-wide text-[10px]">Weather</span>
          </div>
          <div className="text-base font-bold text-slate-900">{currentFc.temp_c ?? 30}°C</div>
          <div className="text-[10px] text-slate-400 font-mono truncate">{currentFc.weather_condition ?? 'Sunny & Warm'}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 px-4 overflow-x-auto no-scrollbar text-xs">
        {[
          { id: 'shap', label: 'SHAP Explainability', icon: Brain },
          { id: 'forecast', label: '48h Curve', icon: TrendingUp },
          { id: 'mitigation', label: 'Mitigation', icon: ShieldAlert },
          { id: 'history', label: '7-Day History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 py-3 px-3 font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === id
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* TAB 1: SHAP EXPLAINABILITY */}
        {activeTab === 'shap' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  TreeSHAP Feature Attribution
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Base: <strong>{currentFc.shap_base_value ?? 53.4}</strong>
                </span>
              </div>

              {/* Explanatory description */}
              <p className="text-xs text-slate-600 leading-relaxed">
                Feature contribution towards the predicted congestion of{' '}
                <strong className="text-slate-900 font-semibold">{currentScore} / 100</strong> at hour +{selectedHour}. Warm red bars increase congestion; green/indigo bars relieve pressure.
              </p>

              {/* Waterfall Summary Step Pill */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Base</span>
                  <strong className="text-slate-700 text-xs">{currentFc.shap_base_value ?? 53.4}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Net Delta</span>
                  <strong className={currentScore >= (currentFc.shap_base_value ?? 53.4) ? 'text-rose-600 text-xs' : 'text-emerald-600 text-xs'}>
                    {currentScore >= (currentFc.shap_base_value ?? 53.4) ? '+' : ''}
                    {(currentScore - (currentFc.shap_base_value ?? 53.4)).toFixed(1)} pts
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Prediction</span>
                  <strong className="text-slate-900 font-bold text-xs">{currentScore} / 100</strong>
                </div>
              </div>

              {/* Bi-Directional Diverging Feature Rows */}
              <div className="space-y-2 pt-1">
                {combinedShapData.map((item, idx) => {
                  const maxAbs = Math.max(...combinedShapData.map((d) => Math.abs(d.impact)), 1);
                  const barWidthPercent = Math.min(100, (Math.abs(item.impact) / maxAbs) * 100);
                  const isPositive = item.impact > 0;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-1.5"
                    >
                      {/* Top text row: Feature name and impact number */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-800 font-medium truncate max-w-[280px]">
                          {item.name}
                        </span>
                        <span
                          className={`font-mono font-bold text-xs px-1.5 py-0.2 rounded ${
                            isPositive
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isPositive ? `+${item.impact}` : item.impact} pts
                        </span>
                      </div>

                      {/* Bi-directional diverging bar */}
                      <div className="relative w-full h-2 bg-slate-200 rounded-full flex items-center overflow-hidden">
                        {/* Center Zero Tick Indicator */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10"></div>

                        {/* Negative bar extending left from center */}
                        {!isPositive && (
                          <div className="w-1/2 flex justify-end h-full">
                            <div
                              className="h-full bg-emerald-500 rounded-l-full"
                              style={{ width: `${barWidthPercent}%` }}
                            ></div>
                          </div>
                        )}

                        {/* Positive bar extending right from center */}
                        {isPositive && (
                          <div className="w-1/2 ml-auto flex justify-start h-full">
                            <div
                              className="h-full bg-rose-500 rounded-r-full"
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
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  48-Hour Congestion Risk Trajectory
                </h3>
                <span className="text-[10px] font-mono text-indigo-600">Hour +{selectedHour} Selected</span>
              </div>
              <p className="text-xs text-slate-500">
                Hourly forward predictions with threshold bands (<span className="text-amber-600 font-semibold">35</span>, <span className="text-orange-600 font-semibold">60</span>, <span className="text-rose-600 font-semibold">80</span>).
              </p>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGradLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" width={34} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-200 space-y-1">
                            <p className="font-bold text-slate-900 font-mono">{data.timeLabel}</p>
                            <p className="text-indigo-600 font-bold font-mono">Score: {data.score}/100 ({data.risk})</p>
                            <p className="text-slate-600">Transit: {data.trips} trips/h</p>
                            <p className="text-slate-600">Weather: {data.temp}°C</p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={35} stroke="#d97706" strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#ea580c" strokeDasharray="3 3" />
                    <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3" />
                    <ReferenceLine x={selectedHour} stroke="#4f46e5" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#scoreGradLight)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MITIGATION & ACTION PLAN */}
        {activeTab === 'mitigation' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-indigo-600" />
                Crowd Mitigation & Operations Plan
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Automated recommendations generated for transit dispatchers and city crowd managers based on predicted congestion score ({currentScore}/100).
              </p>

              <div className="space-y-2.5">
                {getMitigationStrategies().map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        {item.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                        item.level === 'Critical' ? 'bg-rose-100 text-rose-700' :
                        item.level === 'High' ? 'bg-orange-100 text-orange-700' :
                        item.level === 'Moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 pl-5">
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
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                168-Hour Historical Foot-Traffic & Ridership
              </h3>
              <p className="text-xs text-slate-500 mb-4">
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
                      <XAxis dataKey="dateLabel" interval={24} stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-200">
                              <p className="font-bold text-slate-900">{data.dateLabel}</p>
                              <p className="text-indigo-600 font-semibold">Congestion: {data.score}/100</p>
                              <p className="text-slate-600">Foot Traffic: {data.footTraffic}</p>
                              <p className="text-slate-600">Ridership: {data.ridership}</p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#4f46e5"
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
