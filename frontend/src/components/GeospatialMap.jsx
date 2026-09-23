import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Filter, Layers, AlertCircle, Sparkles } from 'lucide-react';

// Fix Leaflet's default icon URL resolution broken by Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Chennai Metropolitan Area default center & zoom
const CHENNAI_CENTER = [13.0450, 80.2450];
const CHENNAI_ZOOM = 12.5;

export default function GeospatialMap({
  nodes = [],
  nodeForecasts = {},
  selectedHour = 1,
  selectedNodeId,
  onSelectNode
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const circlesGroupRef = useRef(null);
  const [filterMode, setFilterMode] = useState('ALL'); // ALL, SURGE, TRANSIT, TOURIST

  // Helper for congestion colors — returns hex values for direct inline use
  const getColor = (score) => {
    if (score < 35) return { hex: '#10b981', ring: 'rgba(16,185,129,0.5)', label: 'LOW' };
    if (score < 60) return { hex: '#f59e0b', ring: 'rgba(245,158,11,0.5)', label: 'MODERATE' };
    if (score < 80) return { hex: '#f97316', ring: 'rgba(249,115,22,0.55)', label: 'HIGH' };
    return { hex: '#ef4444', ring: 'rgba(239,68,68,0.65)', label: 'CRITICAL' };
  };

  // Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CHENNAI_CENTER,
      zoom: CHENNAI_ZOOM,
      zoomControl: false, // Custom placed zoom control
      attributionControl: true
    });

    // Add zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Esri Dark Gray Canvas tiles — free, no API key required
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 16,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, HERE'
    }).addTo(map);

    // Optional reference labels on top of dark canvas
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 16
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    circlesGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers & crowd circles whenever nodes / forecast / selection / filter change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current || !circlesGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    circlesGroupRef.current.clearLayers();

    nodes.forEach((node) => {
      const nodeFcList = nodeForecasts[node.id] || [];
      const fcPoint = nodeFcList.find((f) => f.horizon_hour === selectedHour) || nodeFcList[0];
      const score = fcPoint ? fcPoint.predicted_congestion : (node.current_status?.congestion_score ?? 50);
      const risk = fcPoint ? fcPoint.risk_level : (node.current_status?.risk_level ?? 'MODERATE');
      const isSelected = node.id === selectedNodeId;
      const palette = getColor(score);

      // Filtering logic
      if (filterMode === 'SURGE' && score < 60) return;
      if (filterMode === 'TRANSIT' && node.category !== 'transit_hub' && node.category !== 'hybrid_hub') return;
      if (filterMode === 'TOURIST' && node.category !== 'tourist_attraction' && node.category !== 'cultural_attraction' && node.category !== 'leisure_hotspot') return;

      // Crowd-density heatmap halo circle
      const radiusMeters = 250 + (score / 100) * 450;
      L.circle([node.latitude, node.longitude], {
        radius: radiusMeters,
        color: palette.hex,
        weight: isSelected ? 2 : 1,
        opacity: isSelected ? 0.9 : 0.4,
        fillColor: palette.hex,
        fillOpacity: isSelected ? 0.25 : 0.14
      }).addTo(circlesGroupRef.current);

      // Custom marker badge using clean inline styles
      const pulseHtml = (score >= 60 || isSelected)
        ? `<div style="
            position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;
            border-radius:9999px;
            background:${palette.ring};
            animation:ping-slow 2.2s cubic-bezier(0,0,0.2,1) infinite;
          "></div>` : '';

      const selectedGlow = isSelected
        ? `box-shadow:0 0 0 3px #22d3ee, 0 0 20px rgba(34,211,238,0.6);transform:scale(1.15);`
        : `box-shadow:0 4px 16px rgba(0,0,0,0.7);`;

      const iconHtml = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          ${pulseHtml}
          <div style="
            width:38px;height:38px;
            border-radius:9999px;
            background:#090d16;
            border:2px solid ${palette.hex};
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            transition:all 0.2s ease-in-out;
            ${selectedGlow}
          ">
            <span style="font-size:12px;font-weight:900;color:#ffffff;line-height:1;font-family:monospace;">${Math.round(score)}</span>
            <span style="font-size:7.5px;font-weight:700;color:${palette.hex};text-transform:uppercase;letter-spacing:0.04em;line-height:1;margin-top:1px;">${palette.label}</span>
          </div>
        </div>`;

      const customIcon = L.divIcon({
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: iconHtml
      });

      const marker = L.marker([node.latitude, node.longitude], { icon: customIcon });

      marker.bindTooltip(
        `<div style="padding:4px 2px;font-family:inherit;min-width:180px;">
          <div style="font-weight:800;color:#ffffff;font-size:13px;line-height:1.25;margin-bottom:5px;">
            ${node.name}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:6px;">
            <span style="color:#94a3b8;text-transform:uppercase;font-size:9.5px;font-family:monospace;letter-spacing:0.04em;">
              ${node.category.replace('_', ' ')}
            </span>
            <span style="font-weight:800;color:${palette.hex};font-family:monospace;font-size:11px;">
              ${Math.round(score)}/100 (${risk})
            </span>
          </div>
          <div style="color:#22d3ee;font-size:10px;font-weight:600;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;margin-top:2px;">
            Click to inspect SHAP factors &rarr;
          </div>
        </div>`,
        { direction: 'top', offset: [0, -22], opacity: 1.0, className: 'leaflet-dark-tooltip' }
      );

      marker.on('click', () => onSelectNode(node.id));
      marker.addTo(markersGroupRef.current);
    });
  }, [nodes, nodeForecasts, selectedHour, selectedNodeId, filterMode, onSelectNode]);

  // Pan/fly to the selected node
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedNodeId) return;
    const target = nodes.find((n) => n.id === selectedNodeId);
    if (target) {
      mapInstanceRef.current.flyTo([target.latitude, target.longitude], 14.5, { duration: 0.8 });
    }
  }, [selectedNodeId, nodes]);

  // Compute surge count for HUD
  const surgeCount = nodes.filter((n) => {
    const list = nodeForecasts[n.id] || [];
    const fc = list.find((f) => f.horizon_hour === selectedHour) || list[0];
    const s = fc ? fc.predicted_congestion : (n.current_status?.congestion_score ?? 50);
    return s >= 60;
  }).length;

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Filter Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="glass-panel rounded-xl p-1 flex items-center gap-1 border border-white/10 shadow-xl">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            All Hubs ({nodes.length})
          </button>
          <button
            onClick={() => setFilterMode('SURGE')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'SURGE'
                ? 'bg-rose-500 text-white font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Surge Alert ({surgeCount})
          </button>
          <button
            onClick={() => setFilterMode('TRANSIT')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'TRANSIT'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Transit
          </button>
          <button
            onClick={() => setFilterMode('TOURIST')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'TOURIST'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Tourist
          </button>
        </div>
      </div>

      {/* Bottom-Left Legend Overlay */}
      <div className="absolute bottom-6 left-4 z-10 glass-panel rounded-2xl p-3.5 border border-white/10 shadow-2xl min-w-[200px] pointer-events-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Risk Index
          </span>
          <span className="text-[10px] text-slate-400 font-mono">+ {selectedHour}h Horizon</span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {[
            { color: '#10b981', label: 'Low (<35)', desc: 'Smooth Flow' },
            { color: '#f59e0b', label: 'Moderate (35–59)', desc: 'Standard' },
            { color: '#f97316', label: 'High (60–79)', desc: 'Crowded' },
            { color: '#ef4444', label: 'Critical (≥80)', desc: 'Severe Surge' }
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }}></span>
                {label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
