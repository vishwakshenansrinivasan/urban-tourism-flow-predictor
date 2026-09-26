import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GeospatialMap from './components/GeospatialMap';
import ForecastSlider from './components/ForecastSlider';
import NodeDrawer from './components/NodeDrawer';
import ModelAccuracyView from './components/ModelAccuracyView';
import NodeMatrixView from './components/NodeMatrixView';
import BenchmarksModal from './components/BenchmarksModal';
import ChatAssistant from './components/ChatAssistant';
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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

  // Compute dynamic city average congestion and peak bottleneck for selectedHour
  const dynamicMetrics = React.useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return {
        avgScore: summary?.city_average_congestion ?? 48,
        bottleneck: summary?.highest_current_bottleneck ?? null
      };
    }

    let totalScore = 0;
    let count = 0;
    let highestScore = -1;
    let topNode = null;

    nodes.forEach((node) => {
      const fcList = nodeForecasts[node.id] || [];
      const fcPoint = fcList.find((f) => f.horizon_hour === selectedHour) || fcList[0];
      const score = fcPoint ? fcPoint.predicted_congestion : (node.current_status?.congestion_score ?? 50);
      totalScore += score;
      count += 1;

      if (score > highestScore) {
        highestScore = score;
        topNode = {
          node_id: node.id,
          node_name: node.name,
          congestion_score: score,
          risk_level: fcPoint ? fcPoint.risk_level : (node.current_status?.risk_level ?? 'MODERATE')
        };
      }
    });

    const avgScore = count > 0 ? Math.round(totalScore / count) : 48;
    return {
      avgScore,
      bottleneck: topNode
    };
  }, [nodes, nodeForecasts, selectedHour, summary]);

  const handleSelectNodeAndNavigateToMap = (nodeId) => {
    setSelectedNodeId(nodeId);
    setCurrentView('map');
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">Urban Flow Predictor</p>
          <p className="text-sm text-slate-500 font-normal">Loading 12 Chennai Hubs & CMRL Telemetry…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="p-8 rounded-2xl bg-white border border-rose-200 shadow-sm text-slate-800 max-w-md animate-fade-up">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <span className="font-bold text-lg">!</span>
          </div>
          <h2 className="text-base font-bold mb-1.5 text-slate-900">Backend Connection Error</h2>
          <p className="text-xs text-slate-500 mb-5">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl btn-primary text-xs font-semibold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden select-none relative font-sans">
      {/* Top Header Navigation */}
      <Header
        summary={summary}
        avgScore={dynamicMetrics.avgScore}
        bottleneck={dynamicMetrics.bottleneck}
        selectedHour={selectedHour}
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenBenchmarks={() => setIsBenchmarksOpen(true)}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
        isAssistantOpen={isAssistantOpen}
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

      {/* PulseAI Interactive Question Bot */}
      <ChatAssistant
        isOpen={isAssistantOpen}
        onToggle={() => setIsAssistantOpen((prev) => !prev)}
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        selectedHour={selectedHour}
        onSelectNodeAndNavigateToMap={handleSelectNodeAndNavigateToMap}
      />

      {/* Quick Model Benchmark Comparison Modal */}
      <BenchmarksModal
        isOpen={isBenchmarksOpen}
        onClose={() => setIsBenchmarksOpen(false)}
        benchmarks={benchmarks}
      />
    </div>
  );
}
