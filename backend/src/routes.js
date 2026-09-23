/**
 * REST API Routes for Urban Tourism and Transit Flow Predictor.
 */
import { Router } from 'express';
import { query, getDbHealth } from './db.js';

const router = Router();

/**
 * GET /nodes and /api/nodes
 * Returns all 7 transit & tourism hub nodes with their latest real-time status.
 */
router.get(['/nodes', '/api/nodes'], async (req, res) => {
  try {
    const nodes = await query('SELECT * FROM nodes ORDER BY name ASC');

    // Attach latest metric for each node
    const enrichedNodes = await Promise.all(
      nodes.map(async (node) => {
        const latestMetrics = await query(
          'SELECT * FROM hourly_metrics WHERE node_id = ? ORDER BY timestamp DESC LIMIT 1',
          [node.id]
        );
        const latest = latestMetrics[0] || null;

        // Parse geojson if string
        let geojsonObj = null;
        try {
          geojsonObj = typeof node.geojson === 'string' ? JSON.parse(node.geojson) : node.geojson;
        } catch {
          geojsonObj = null;
        }

        return {
          id: node.id,
          name: node.name,
          category: node.category,
          latitude: node.latitude,
          longitude: node.longitude,
          description: node.description,
          capacity_baseline: node.capacity_baseline,
          transit_weight: node.transit_weight,
          tourist_weight: node.tourist_weight,
          geojson: geojsonObj,
          current_status: latest
            ? {
                timestamp: latest.timestamp,
                congestion_score: latest.congestion_score,
                risk_level: latest.risk_level,
                foot_traffic: latest.foot_traffic,
                ridership_volume: latest.ridership_volume,
                scheduled_trips: latest.scheduled_trips,
                temp_c: latest.temp_c,
                weather_condition: latest.weather_condition,
                is_rain: latest.is_rain === 1
              }
            : null
        };
      })
    );

    res.json({
      success: true,
      city: "San Francisco",
      count: enrichedNodes.length,
      nodes: enrichedNodes
    });
  } catch (err) {
    console.error('Error fetching nodes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /forecast/:nodeId and /api/forecast/:nodeId
 * Returns 24-48 hour forward forecast for a specific node with SHAP feature breakdowns.
 */
router.get(['/forecast/:nodeId', '/api/forecast/:nodeId'], async (req, res) => {
  const { nodeId } = req.params;
  try {
    const nodeRows = await query('SELECT * FROM nodes WHERE id = ?', [nodeId]);
    if (nodeRows.length === 0) {
      return res.status(404).json({ success: false, error: `Node ${nodeId} not found.` });
    }
    const node = nodeRows[0];

    const forecastRows = await query(
      'SELECT * FROM forecasts WHERE node_id = ? ORDER BY forecast_timestamp ASC',
      [nodeId]
    );

    const parsedForecasts = forecastRows.map((f) => {
      let posFactors = [];
      let negFactors = [];
      try {
        posFactors = typeof f.top_positive_factors === 'string' ? JSON.parse(f.top_positive_factors) : f.top_positive_factors;
        negFactors = typeof f.top_negative_factors === 'string' ? JSON.parse(f.top_negative_factors) : f.top_negative_factors;
      } catch {
        posFactors = [];
        negFactors = [];
      }

      return {
        id: f.id,
        horizon_hour: f.horizon_hour,
        forecast_timestamp: f.forecast_timestamp,
        predicted_congestion: f.predicted_congestion,
        risk_level: f.risk_level,
        temp_c: f.temp_c,
        weather_condition: f.weather_condition,
        scheduled_trips: f.scheduled_trips,
        shap_base_value: f.shap_base_value,
        top_positive_factors: posFactors,
        top_negative_factors: negFactors
      };
    });

    res.json({
      success: true,
      node: {
        id: node.id,
        name: node.name,
        category: node.category,
        capacity_baseline: node.capacity_baseline,
        latitude: node.latitude,
        longitude: node.longitude
      },
      horizon_hours: parsedForecasts.length,
      forecast: parsedForecasts
    });
  } catch (err) {
    console.error(`Error fetching forecast for ${nodeId}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /nodes/:nodeId/history and /api/nodes/:nodeId/history
 * Returns the past 7 days (168 hours) of hourly observations for a node.
 */
router.get(['/nodes/:nodeId/history', '/api/nodes/:nodeId/history'], async (req, res) => {
  const { nodeId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 168, 720);

  try {
    const nodeRows = await query('SELECT * FROM nodes WHERE id = ?', [nodeId]);
    if (nodeRows.length === 0) {
      return res.status(404).json({ success: false, error: `Node ${nodeId} not found.` });
    }

    const historyRows = await query(
      'SELECT * FROM hourly_metrics WHERE node_id = ? ORDER BY timestamp DESC LIMIT ?',
      [nodeId, limit]
    );

    // Return chronological order
    const chronological = historyRows.reverse().map((r) => ({
      timestamp: r.timestamp,
      congestion_score: r.congestion_score,
      risk_level: r.risk_level,
      foot_traffic: r.foot_traffic,
      ridership_volume: r.ridership_volume,
      scheduled_trips: r.scheduled_trips,
      temp_c: r.temp_c,
      precip_mm: r.precip_mm,
      weather_condition: r.weather_condition,
      is_rain: r.is_rain === 1,
      is_synthetic: r.is_synthetic === 1
    }));

    res.json({
      success: true,
      node_id: nodeId,
      count: chronological.length,
      history: chronological
    });
  } catch (err) {
    console.error(`Error fetching history for ${nodeId}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/summary
 * City-wide situational overview, highest congestion alert, and forecast horizon peaks.
 */
router.get('/api/summary', async (req, res) => {
  try {
    const nodes = await query('SELECT * FROM nodes');
    const latestMetrics = await query(`
      SELECT m.*, n.name as node_name
      FROM hourly_metrics m
      JOIN nodes n ON m.node_id = n.id
      WHERE m.timestamp = (SELECT MAX(timestamp) FROM hourly_metrics)
      ORDER BY m.congestion_score DESC
    `);

    const peakForecasts = await query(`
      SELECT f.*, n.name as node_name
      FROM forecasts f
      JOIN nodes n ON f.node_id = n.id
      ORDER BY f.predicted_congestion DESC
      LIMIT 1
    `);

    const avgScore = latestMetrics.reduce((sum, m) => sum + m.congestion_score, 0) / (latestMetrics.length || 1);

    const benchmarks = await query('SELECT * FROM model_benchmarks ORDER BY trained_at DESC LIMIT 5');

    res.json({
      success: true,
      city: "San Francisco",
      timestamp: latestMetrics[0]?.timestamp || null,
      city_average_congestion: Math.round(avgScore * 10) / 10,
      active_nodes_count: nodes.length,
      highest_current_bottleneck: latestMetrics[0] ? {
        node_id: latestMetrics[0].node_id,
        node_name: latestMetrics[0].node_name,
        congestion_score: latestMetrics[0].congestion_score,
        risk_level: latestMetrics[0].risk_level,
        foot_traffic: latestMetrics[0].foot_traffic
      } : null,
      forecast_peak: peakForecasts[0] ? {
        node_id: peakForecasts[0].node_id,
        node_name: peakForecasts[0].node_name,
        predicted_congestion: peakForecasts[0].predicted_congestion,
        forecast_timestamp: peakForecasts[0].forecast_timestamp,
        risk_level: peakForecasts[0].risk_level
      } : null,
      model_benchmarks: benchmarks
    });
  } catch (err) {
    console.error('Error in summary endpoint:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/benchmarks
 * Evaluation comparison between XGBoost Production Model and SARIMA Baseline.
 */
router.get('/api/benchmarks', async (req, res) => {
  try {
    const benchmarks = await query('SELECT * FROM model_benchmarks ORDER BY trained_at DESC LIMIT 10');
    res.json({
      success: true,
      benchmarks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/health
 */
router.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await getDbHealth();
    res.json({
      status: 'healthy',
      service: 'urban-flow-backend',
      timestamp: new Date().toISOString(),
      database: dbHealth
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

export default router;
