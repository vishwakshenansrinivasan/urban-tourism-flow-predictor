import React, { useState } from 'react';
import {
  MapPin,
  TrendingUp,
  AlertTriangle,
  Users,
  Compass,
  ArrowUpRight,
  Search,
  Filter
} from 'lucide-react';

export default function NodeMatrixView({
  nodes = [],
  nodeForecasts = {},
  selectedHour = 1,
  onSelectNodeAndSwitchToMap
}) {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('congestion'); // congestion, capacity, name

  const filteredNodes = nodes
    .filter((n) => {
      if (filterCategory !== 'ALL' && n.category !== filterCategory) return false;
      if (
        searchTerm &&
        !n.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !n.id.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const fcListA = nodeForecasts[a.id] || [];
      const fcA = fcListA.find((f) => f.horizon_hour === selectedHour) || fcListA[0];
      const scoreA = fcA ? fcA.predicted_congestion : (a.current_status?.congestion_score ?? 50);

      const fcListB = nodeForecasts[b.id] || [];
      const fcB = fcListB.find((f) => f.horizon_hour === selectedHour) || fcListB[0];
      const scoreB = fcB ? fcB.predicted_congestion : (b.current_status?.congestion_score ?? 50);

      if (sortBy === 'congestion') return scoreB - scoreA;
      if (sortBy === 'capacity') return b.capacity_baseline - a.capacity_baseline;
      return a.name.localeCompare(b.name);
    });

  const getRiskBadge = (score) => {
    if (score < 35) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          LOW ({score})
        </span>
      );
    }
    if (score < 60) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          MODERATE ({score})
        </span>
      );
    }
    if (score < 80) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
          HIGH ({score})
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
        CRITICAL ({score})
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>San Francisco Landmark & Transit Hub Network</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
              {nodes.length} Hubs Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, 48-hour forward congestion projections, and capacity baselines.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search station or landmark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl p-1 text-xs">
            <button
              onClick={() => setSortBy('congestion')}
              className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                sortBy === 'congestion'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Congestion
            </button>
            <button
              onClick={() => setSortBy('capacity')}
              className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                sortBy === 'capacity'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Capacity
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                sortBy === 'name'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'ALL', label: 'All Hubs (12)' },
          { id: 'transit_hub', label: 'Transit Stations & BART' },
          { id: 'tourist_attraction', label: 'Tourist Landmarks' },
          { id: 'cultural_attraction', label: 'Cultural Episenters' },
          { id: 'hybrid_hub', label: 'Hybrid Commuter & Waterfront' },
          { id: 'commercial_hub', label: 'Commercial & Retail' },
          { id: 'leisure_hotspot', label: 'Parks & Leisure' }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
              filterCategory === cat.id
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                : 'bg-slate-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNodes.map((node) => {
          const fcList = nodeForecasts[node.id] || [];
          const fcPoint = fcList.find((f) => f.horizon_hour === selectedHour) || fcList[0];
          const score = fcPoint ? fcPoint.predicted_congestion : (node.current_status?.congestion_score ?? 50);
          const footTraffic = node.current_status?.foot_traffic || Math.round((node.capacity_baseline * score) / 100);

          return (
            <div
              key={node.id}
              className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-500/40 transition group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">
                        {node.category.replace('_', ' ')}
                      </span>
                      <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition">
                        {node.name}
                      </h3>
                    </div>
                  </div>
                  <div>{getRiskBadge(score)}</div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {node.description}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Predicted Flow</span>
                  <strong className="text-cyan-400 text-xs">{score} / 100</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Foot Traffic</span>
                  <strong className="text-white text-xs">{footTraffic.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Capacity</span>
                  <strong className="text-slate-300 text-xs">{node.capacity_baseline.toLocaleString()}</strong>
                </div>
              </div>

              {/* Inspect Button */}
              <button
                onClick={() => onSelectNodeAndSwitchToMap(node.id)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 group/btn cursor-pointer"
              >
                <span>Inspect on Spatio-Temporal Map</span>
                <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
