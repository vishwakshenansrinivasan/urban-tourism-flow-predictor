/**
 * API client service for communicating with the backend.
 */
const API_BASE = import.meta.env.VITE_API_BASE !== undefined ? import.meta.env.VITE_API_BASE : '';

export async function fetchNodes() {
  const res = await fetch(`${API_BASE}/api/nodes`);
  if (!res.ok) throw new Error(`Failed to fetch nodes: ${res.statusText}`);
  const data = await res.json();
  return data.nodes;
}

export async function fetchForecast(nodeId) {
  const res = await fetch(`${API_BASE}/api/forecast/${encodeURIComponent(nodeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch forecast: ${res.statusText}`);
  const data = await res.json();
  return data;
}

export async function fetchHistory(nodeId, limit = 168) {
  const res = await fetch(`${API_BASE}/api/nodes/${encodeURIComponent(nodeId)}/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
  const data = await res.json();
  return data.history;
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.statusText}`);
  const data = await res.json();
  return data;
}

export async function fetchBenchmarks() {
  const res = await fetch(`${API_BASE}/api/benchmarks`);
  if (!res.ok) throw new Error(`Failed to fetch benchmarks: ${res.statusText}`);
  const data = await res.json();
  return data.benchmarks;
}
