import React, { useState } from 'react';
import {
  MapPin,
  AlertTriangle,
  Users,
  ArrowUpRight,
  Search,
  Layers
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ALL',                 label: 'All Hubs' },
  { id: 'transit_hub',        label: 'Transit Stations' },
  { id: 'tourist_attraction', label: 'Tourist Landmarks' },
  { id: 'cultural_attraction',label: 'Cultural Epicentres' },
  { id: 'hybrid_hub',         label: 'Hybrid & Waterfront' },
  { id: 'commercial_hub',     label: 'Commercial & Retail' },
  { id: 'leisure_hotspot',    label: 'Parks & Leisure' },
];

const CATEGORY_ICONS = {
  transit_hub: '🚇',
  tourist_attraction: '🏖️',
  cultural_attraction: '🏛️',
  hybrid_hub: '⚓',
  commercial_hub: '🛍️',
  leisure_hotspot: '🌿',
};

export default function NodeMatrixView({
  nodes = [],
  nodeForecasts = {},
  selectedHour = 1,
  onSelectNodeAndSwitchToMap
}) {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('congestion');

  const filteredNodes = nodes
    .filter((n) => {
      if (filterCategory !== 'ALL' && n.category !== filterCategory) return false;
      if (
        searchTerm &&
        !n.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !n.id.toLowerCase().includes(searchTerm.toLowerCase())
      ) return false;
      return true;
    })
    .sort((a, b) => {
      const fcA = (nodeForecasts[a.id] || []).find((f) => f.horizon_hour === selectedHour) || (nodeForecasts[a.id] || [])[0];
      const fcB = (nodeForecasts[b.id] || []).find((f) => f.horizon_hour === selectedHour) || (nodeForecasts[b.id] || [])[0];
      const scoreA = fcA ? fcA.predicted_congestion : (a.current_status?.congestion_score ?? 50);
      const scoreB = fcB ? fcB.predicted_congestion : (b.current_status?.congestion_score ?? 50);
      if (sortBy === 'congestion') return scoreB - scoreA;
      if (sortBy === 'capacity')   return b.capacity_baseline - a.capacity_baseline;
      return a.name.localeCompare(b.name);
    });

  const getRiskMeta = (score) => {
    if (score < 35) return { cls: 'risk-low',      label: 'LOW',      bar: 'bg-emerald-500' };
    if (score < 60) return { cls: 'risk-moderate', label: 'MODERATE', bar: 'bg-amber-500' };
    if (score < 80) return { cls: 'risk-high',     label: 'HIGH',     bar: 'bg-orange-500' };
    return               { cls: 'risk-critical',   label: 'CRITICAL', bar: 'bg-red-500' };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fade-up bg-slate-50">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase mb-1 font-mono">
            Spatio-Temporal Intelligence
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
            Chennai Hub Network
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-semibold border border-indigo-100">
              {nodes.length} Active
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time telemetry · 48-hour forward congestion projections · Capacity baselines
          </p>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hub or station…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs w-48 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs">
            {['congestion', 'capacity', 'name'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer capitalize ${
                  sortBy === s ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
              filterCategory === cat.id
                ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNodes.map((node) => {
          const fcList = nodeForecasts[node.id] || [];
          const fcPoint = fcList.find((f) => f.horizon_hour === selectedHour) || fcList[0];
          const score = fcPoint ? fcPoint.predicted_congestion : (node.current_status?.congestion_score ?? 50);
          const footTraffic = node.current_status?.foot_traffic || Math.round((node.capacity_baseline * score) / 100);
          const risk = getRiskMeta(score);
          const emoji = CATEGORY_ICONS[node.category] || '📍';

          return (
            <div
              key={node.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between gap-4 group"
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
                      {emoji}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-medium tracking-wider block">
                        {node.category.replace(/_/g, ' ')}
                      </span>
                      <h3 className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                        {node.name}
                      </h3>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${risk.cls}`}>
                    {risk.label}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {node.description}
                </p>

                {/* Congestion bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-mono">
                    <span>Predicted Flow</span>
                    <span className="font-semibold text-slate-800">{score}/100</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${risk.bar} transition-all duration-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Score</span>
                  <strong className="text-slate-900 text-sm font-semibold">{score}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Traffic</span>
                  <strong className="text-slate-900 text-sm font-semibold">{footTraffic.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Capacity</span>
                  <strong className="text-slate-600 text-sm font-normal">{node.capacity_baseline.toLocaleString()}</strong>
                </div>
              </div>

              {/* Inspect Button */}
              <button
                onClick={() => onSelectNodeAndSwitchToMap(node.id)}
                className="w-full py-2 rounded-lg btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:border-indigo-300 hover:text-indigo-600"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Inspect on Map</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {filteredNodes.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hubs match your filter</p>
        </div>
      )}
    </div>
  );
}
