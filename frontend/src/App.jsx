import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GeospatialMap from './components/GeospatialMap';
import ForecastSlider from './components/ForecastSlider';
import NodeDrawer from './components/NodeDrawer';
import ModelAccuracyView from './components/ModelAccuracyView';
import NodeMatrixView from './components/NodeMatrixView';
import BenchmarksModal from './components/BenchmarksModal';
import { fetchNodes, fetchForecast, fetchSummary, fetchBenchmarks } from './api';

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [nodeForecasts, setNodeForecasts] = useState({});
  const [summary, setSummary] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);
  const [selectedHour, setSelectedHour] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState('MAA_CENTRAL_STATION');
  const [currentView, setCurrentView] = useState('map'); // 'map' | 'accuracy' | 'matrix'
  const [isBenchmarksOpen, setIsBenchmarksOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial Data Ingestion
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [nodesData, summaryData, benchmarksData] = await Promise.all([
          fetchNodes(),
          fetchSummary().catch(() => null),
          fetchBenchmarks().catch(() => [])
        ]);

        setNodes(nodesData || []);
        setSummary(summaryData);
        setBenchmarks(benchmarksData || []);

        // Load 48h forecasts for all nodes in parallel
        const fcMap = {};
        if (nodesData && nodesData.length > 0) {
          await Promise.all(
            nodesData.map(async (n) => {
              try {
                const fcRes = await fetchForecast(n.id);
                fcMap[n.id] = fcRes.forecast || [];
              } catch (e) {
                console.warn(`Forecast fetch failed for ${n.id}:`, e);
              }
            })
          );
        }
        setNodeForecasts(fcMap);
        setError(null);
      } catch (err) {
        console.error('Initial data loading failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedNodeForecastList = (selectedNodeId && nodeForecasts[selectedNodeId]) || [];

  // Pick a sample forecast point for the weather capsule in the scrubber
  const samplePoint =
    selectedNodeForecastList.find((f) => f.horizon_hour === selectedHour) ||
    Object.values(nodeForecasts)[0]?.find((f) => f.horizon_hour === selectedHour) ||
    null;

  const handleSelectNodeAndNavigateToMap = (nodeId) => {
    setSelectedNodeId(nodeId);
    setCurrentView('map');
  };

  if (loading) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
          <div className="absolute font-bold text-xs text-cyan-400">PULSE</div>
        </div>
        <div className="text-sm font-medium text-slate-300">
          Loading 12 Chennai Hubs & CMRL Telemetry...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md">
          <h2 className="font-bold text-base mb-1">Backend Connection Error</h2>
          <p className="text-xs text-slate-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header Navigation */}
      <Header
        summary={summary}
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenBenchmarks={() => setIsBenchmarksOpen(true)}
      />

      {/* VIEW 1: Interactive Spatio-Temporal Geospatial Map */}
      {currentView === 'map' && (
        <div className="flex-1 w-full overflow-hidden flex flex-col">
          <main className="relative flex-1 w-full overflow-hidden flex">
            <GeospatialMap
              nodes={nodes}
              nodeForecasts={nodeForecasts}
              selectedHour={selectedHour}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />

            {/* Analytics & Explainability Drawer */}
            {selectedNode && (
              <NodeDrawer
                node={selectedNode}
                forecastList={selectedNodeForecastList}
                selectedHour={selectedHour}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </main>

          {/* Interactive 48-Hour Forecast Timeline Scrubber */}
          <ForecastSlider
            selectedHour={selectedHour}
            onChangeHour={setSelectedHour}
            maxHours={48}
            sampleForecastPoint={samplePoint}
          />
        </div>
      )}

      {/* VIEW 2: Dedicated Model Accuracy & Metric Scores Section */}
      {currentView === 'accuracy' && (
        <ModelAccuracyView
          onNavigateToMap={() => setCurrentView('map')}
        />
      )}

      {/* VIEW 3: All 12 Landmark & Transit Hubs Network Matrix */}
      {currentView === 'matrix' && (
        <NodeMatrixView
          nodes={nodes}
          nodeForecasts={nodeForecasts}
          selectedHour={selectedHour}
          onSelectNodeAndSwitchToMap={handleSelectNodeAndNavigateToMap}
        />
      )}

      {/* Quick Model Benchmark Comparison Modal */}
      <BenchmarksModal
        isOpen={isBenchmarksOpen}
        onClose={() => setIsBenchmarksOpen(false)}
        benchmarks={benchmarks}
      />
    </div>
  );
}
