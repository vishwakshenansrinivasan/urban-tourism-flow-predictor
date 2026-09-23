import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// San Francisco default center & zoom
const SF_CENTER = [37.7749, -122.4294];
const SF_ZOOM = 13;

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

  // Helper for congestion colors
  const getColor = (score) => {
    if (score < 35) return { hex: '#10b981', ring: 'rgba(16, 185, 129, 0.45)', bg: 'bg-emerald-500' };
    if (score < 60) return { hex: '#f59e0b', ring: 'rgba(245, 158, 11, 0.45)', bg: 'bg-amber-500' };
    if (score < 80) return { hex: '#f97316', ring: 'rgba(249, 115, 22, 0.50)', bg: 'bg-orange-500' };
    return { hex: '#ef4444', ring: 'rgba(239, 68, 68, 0.65)', bg: 'bg-rose-500' };
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: SF_CENTER,
      zoom: SF_ZOOM,
      zoomControl: true,
      attributionControl: false
    });

    // CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Minimal attribution in bottom-right
    L.control.attribution({ position: 'bottomright' })
      .addAttribution('&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap')
      .addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    circlesGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Crowd Circles when nodes, forecast hour, or selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current || !circlesGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    circlesGroupRef.current.clearLayers();

    nodes.forEach((node) => {
      // Find forecast point for this node at the selected hour
      const nodeFcList = nodeForecasts[node.id] || [];
      const fcPoint = nodeFcList.find((f) => f.horizon_hour === selectedHour) || nodeFcList[0];
      const score = fcPoint ? fcPoint.predicted_congestion : (node.current_status?.congestion_score ?? 50);
      const risk = fcPoint ? fcPoint.risk_level : (node.current_status?.risk_level ?? 'MODERATE');
      const isSelected = node.id === selectedNodeId;

      const palette = getColor(score);

      // Heatmap circle representing crowd density footprint
      const radiusMeters = 300 + (score / 100) * 450;
      const circle = L.circle([node.latitude, node.longitude], {
        radius: radiusMeters,
        color: palette.hex,
        weight: isSelected ? 2 : 1,
        opacity: isSelected ? 0.8 : 0.4,
        fillColor: palette.hex,
        fillOpacity: isSelected ? 0.22 : 0.12
      });
      circle.addTo(circlesGroupRef.current);

      // Custom HTML Marker
      const customIcon = L.divIcon({
        className: 'custom-node-icon',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `
          <div class="relative w-11 h-11 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110">
            <!-- Pulsing Ring for high/severe or selected -->
            ${score >= 60 || isSelected ? `
              <div class="node-pulse-ring" style="background-color: ${palette.ring};"></div>
            ` : ''}
            
            <!-- Outer Glow Badge -->
            <div class="w-10 h-10 rounded-full flex flex-col items-center justify-center border-2 shadow-xl ${
              isSelected ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-950 scale-110' : ''
            }" style="background-color: #0f172a; border-color: ${palette.hex};">
              <span class="text-[11px] font-black leading-tight text-white tracking-tight">${Math.round(score)}</span>
              <span class="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none">RISK</span>
            </div>
          </div>
        `
      });

      const marker = L.marker([node.latitude, node.longitude], { icon: customIcon });

      // Tooltip
      marker.bindTooltip(
        `<div class="p-1 text-xs">
          <p class="font-bold text-white">${node.name}</p>
          <p class="text-slate-300">Congestion: <span style="color: ${palette.hex}" class="font-bold">${score}/100 (${risk})</span></p>
          <p class="text-[10px] text-cyan-400 mt-0.5">Click for SHAP factor breakdown</p>
        </div>`,
        { direction: 'top', offset: [0, -22], opacity: 0.95 }
      );

      marker.on('click', () => {
        onSelectNode(node.id);
      });

      marker.addTo(markersGroupRef.current);
    });
  }, [nodes, nodeForecasts, selectedHour, selectedNodeId, onSelectNode]);

  // Pan to selected node
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedNodeId) return;
    const target = nodes.find((n) => n.id === selectedNodeId);
    if (target) {
      mapInstanceRef.current.flyTo([target.latitude, target.longitude], 14.5, {
        duration: 0.8
      });
    }
  }, [selectedNodeId, nodes]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Legend Overlay */}
      <div className="absolute top-4 left-4 glass-panel rounded-xl p-3 z-10 text-xs pointer-events-auto border border-white/10 shadow-xl max-w-xs">
        <p className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Congestion Risk (0–100)
        </p>
        <div className="space-y-1.5 font-medium">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Low Flow (&lt;35)
            </span>
            <span className="text-[11px] text-slate-400">Normal</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Moderate (35–59)
            </span>
            <span className="text-[11px] text-slate-400">Busy</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              High (60–79)
            </span>
            <span className="text-[11px] text-slate-400">Bottleneck Risk</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              Severe (80–100)
            </span>
            <span className="text-[11px] text-slate-400">Critical Queue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
