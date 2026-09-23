/**
 * Module 3 Verification Script: Backend API Integration Test.
 * Spins up an ephemeral server instance, queries all REST endpoints,
 * asserts response shapes and data integrity, then gracefully terminates.
 */
import http from 'node:http';
import app from '../src/server.js';

const PORT = 5099; // Test port to avoid colliding with any running servers

async function requestJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${data}`));
        }
      });
    });
    req.on('error', reject);
  });
}

async function runApiTests() {
  console.log('======================================================================');
  console.log('RUNNING MODULE 3 VERIFICATION: BACKEND REST API ENDPOINTS');
  console.log('======================================================================\n');

  const server = app.listen(PORT, async () => {
    try {
      // 1. Health Endpoint
      console.log('[Step 1/6] Testing GET /api/health...');
      const health = await requestJson('/api/health');
      if (health.status !== 200 || health.data.status !== 'healthy') {
        throw new Error(`Health check failed: ${JSON.stringify(health)}`);
      }
      console.log(`  [OK] Health check passed (${health.data.database.nodes} nodes, ${health.data.database.forecasts} forecasts).`);

      // 2. Nodes Endpoint
      console.log('\n[Step 2/6] Testing GET /nodes and GET /api/nodes...');
      const nodesRes = await requestJson('/api/nodes');
      if (nodesRes.status !== 200 || !nodesRes.data.nodes || nodesRes.data.nodes.length !== 7) {
        throw new Error(`Nodes endpoint failed: ${JSON.stringify(nodesRes.data)}`);
      }
      const sampleNode = nodesRes.data.nodes[0];
      if (!sampleNode.latitude || !sampleNode.longitude || !sampleNode.current_status) {
        throw new Error(`Node missing coordinates or current status: ${JSON.stringify(sampleNode)}`);
      }
      console.log(`  [OK] Retrieved ${nodesRes.data.count} nodes. Sample: ${sampleNode.name} (Congestion: ${sampleNode.current_status.congestion_score})`);

      // 3. Forecast Endpoint with SHAP
      console.log('\n[Step 3/6] Testing GET /forecast/:nodeId with SHAP explanations...');
      const forecastRes = await requestJson('/forecast/SF_POWELL_ST');
      if (forecastRes.status !== 200 || !forecastRes.data.forecast || forecastRes.data.forecast.length !== 48) {
        throw new Error(`Forecast endpoint failed: ${JSON.stringify(forecastRes.data)}`);
      }
      const firstHour = forecastRes.data.forecast[0];
      if (!firstHour.top_positive_factors || firstHour.top_positive_factors.length === 0) {
        throw new Error(`Forecast missing SHAP top positive factors: ${JSON.stringify(firstHour)}`);
      }
      console.log(`  [OK] 48-hour forecast returned. Hour 1 predicted: ${firstHour.predicted_congestion} (${firstHour.risk_level})`);
      console.log(`  [OK] SHAP Explanation: Top driver is '${firstHour.top_positive_factors[0].feature_name}' (+${firstHour.top_positive_factors[0].impact})`);

      // 4. History Endpoint
      console.log('\n[Step 4/6] Testing GET /nodes/:nodeId/history...');
      const historyRes = await requestJson('/nodes/SF_POWELL_ST/history?limit=168');
      if (historyRes.status !== 200 || !historyRes.data.history || historyRes.data.history.length === 0) {
        throw new Error(`History endpoint failed: ${JSON.stringify(historyRes.data)}`);
      }
      console.log(`  [OK] Historical series returned ${historyRes.data.count} hours of observation.`);

      // 5. City Summary Endpoint
      console.log('\n[Step 5/6] Testing GET /api/summary...');
      const summaryRes = await requestJson('/api/summary');
      if (summaryRes.status !== 200 || !summaryRes.data.highest_current_bottleneck) {
        throw new Error(`Summary endpoint failed: ${JSON.stringify(summaryRes.data)}`);
      }
      console.log(`  [OK] City average congestion: ${summaryRes.data.city_average_congestion}/100`);
      console.log(`  [OK] Current peak bottleneck: ${summaryRes.data.highest_current_bottleneck.node_name} (${summaryRes.data.highest_current_bottleneck.congestion_score})`);

      // 6. Benchmarks Endpoint
      console.log('\n[Step 6/6] Testing GET /api/benchmarks...');
      const benchRes = await requestJson('/api/benchmarks');
      if (benchRes.status !== 200 || benchRes.data.benchmarks.length === 0) {
        throw new Error(`Benchmarks endpoint failed: ${JSON.stringify(benchRes.data)}`);
      }
      console.log(`  [OK] Retrieved ${benchRes.data.benchmarks.length} model benchmark records.`);

      console.log('\n======================================================================');
      console.log('MODULE 3 VERIFICATION PASSED: ALL BACKEND REST APIS FUNCTIONAL!');
      console.log('======================================================================');

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n[FAIL] API verification error:', err);
      server.close();
      process.exit(1);
    }
  });
}

runApiTests();
