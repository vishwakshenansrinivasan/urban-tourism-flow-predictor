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
    if (score < 35) return { hex: '#059669', bg: '#ecfdf5', ring: 'rgba(5,150,105,0.25)', label: 'LOW' };
    if (score < 60) return { hex: '#d97706', bg: '#fffbeb', ring: 'rgba(217,119,6,0.25)', label: 'MODERATE' };
    if (score < 80) return { hex: '#ea580c', bg: '#fff7ed', ring: 'rgba(234,88,12,0.25)', label: 'HIGH' };
    return { hex: '#dc2626', bg: '#fef2f2', ring: 'rgba(220,38,38,0.3)', label: 'CRITICAL' };
  };

  // Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CHENNAI_CENTER,
      zoom: CHENNAI_ZOOM,
      zoomControl: false,
      attributionControl: true
    });

    // Add zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Esri Light Gray Canvas — completely free, clean aesthetic, no watermark
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 16,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
    }).addTo(map);

    // Esri Light Gray Reference labels
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
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
        opacity: isSelected ? 0.7 : 0.35,
        fillColor: palette.hex,
        fillOpacity: isSelected ? 0.18 : 0.08
      }).addTo(circlesGroupRef.current);

      // Custom marker badge with modern clean white background & colored border
      const pulseHtml = (score >= 60 || isSelected)
        ? `<div style="
            position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;
            border-radius:9999px;
            background:${palette.ring};
            animation:pingSlow 2.2s cubic-bezier(0,0,0.2,1) infinite;
          "></div>` : '';

      const selectedGlow = isSelected
        ? `box-shadow: 0 0 0 3px #4f46e5, 0 8px 20px rgba(79,70,229,0.3); transform: scale(1.15);`
        : `box-shadow: 0 2px 8px rgba(0,0,0,0.12);`;

      const iconHtml = `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          ${pulseHtml}
          <div style="
            width:36px;height:36px;
            border-radius:9999px;
            background:#ffffff;
            border:2.5px solid ${palette.hex};
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            transition:all 0.15s ease;
            ${selectedGlow}
          ">
            <span style="font-size:12px;font-weight:700;color:#0f172a;line-height:1;font-family:var(--font-mono, monospace);">${Math.round(score)}</span>
            <span style="font-size:7px;font-weight:700;color:${palette.hex};text-transform:uppercase;letter-spacing:0.02em;line-height:1;margin-top:1px;">${palette.label}</span>
          </div>
        </div>`;

      const customIcon = L.divIcon({
        className: '',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        html: iconHtml
      });

      const marker = L.marker([node.latitude, node.longitude], { icon: customIcon });

      marker.bindTooltip(
        `<div style="padding:4px 2px;font-family:inherit;min-width:180px;">
          <div style="font-weight:700;color:#0f172a;font-size:13px;line-height:1.3;margin-bottom:4px;">
            ${node.name}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:6px;">
            <span style="color:#64748b;text-transform:uppercase;font-size:9.5px;font-family:monospace;letter-spacing:0.04em;">
              ${node.category.replace(/_/g, ' ')}
            </span>
            <span style="font-weight:700;color:${palette.hex};font-family:monospace;font-size:11px;">
              ${Math.round(score)}/100 (${risk})
            </span>
          </div>
          <div style="color:#4f46e5;font-size:10px;font-weight:600;border-top:1px solid #e2e8f0;padding-top:4px;margin-top:2px;">
            Click to inspect SHAP factors &rarr;
          </div>
        </div>`,
        { direction: 'top', offset: [0, -20], opacity: 1.0 }
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
        <div className="bg-white rounded-xl p-1 flex items-center gap-1 border border-slate-200 shadow-md">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Hubs ({nodes.length})
          </button>
          <button
            onClick={() => setFilterMode('SURGE')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'SURGE'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Surge Alert ({surgeCount})
          </button>
          <button
            onClick={() => setFilterMode('TRANSIT')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'TRANSIT'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Transit
          </button>
          <button
            onClick={() => setFilterMode('TOURIST')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterMode === 'TOURIST'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Tourist
          </button>
        </div>
      </div>

      {/* Bottom-Left Legend Overlay */}
      <div className="absolute bottom-6 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl p-3.5 border border-slate-200 shadow-lg min-w-[210px] pointer-events-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Risk Index
          </span>
          <span className="text-[10px] text-slate-500 font-mono">+{selectedHour}h Horizon</span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {[
            { color: '#059669', label: 'Low (<35)', desc: 'Smooth Flow' },
            { color: '#d97706', label: 'Moderate (35–59)', desc: 'Standard' },
            { color: '#ea580c', label: 'High (60–79)', desc: 'Crowded' },
            { color: '#dc2626', label: 'Critical (≥80)', desc: 'Severe Surge' }
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }}></span>
                {label}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
