/**
 * Express Server Bootstrap for Urban Tourism & Transit Flow Predictor Backend.
 * In production (NODE_ENV=production), also serves the compiled React frontend from ../frontend/dist.
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Mount API routes
app.use('/', routes);

// In production, serve the compiled React frontend
if (isProduction) {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));

  // SPA fallback: send index.html for any unmatched non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/nodes') && !req.path.startsWith('/forecast')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    } else {
      res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
    }
  });
} else {
  // Development: 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
  });
}

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
});

// Only start listening if this file is run directly (not imported by tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Urban Flow Predictor API running on http://localhost:${PORT}`);
    if (isProduction) {
      console.log(` - Frontend:          http://localhost:${PORT}`);
    }
    console.log(` - Nodes Endpoint:    http://localhost:${PORT}/api/nodes`);
    console.log(` - Forecast Endpoint: http://localhost:${PORT}/api/forecast/SF_POWELL_ST`);
    console.log(` - History Endpoint:  http://localhost:${PORT}/api/nodes/SF_POWELL_ST/history`);
    console.log(` - Summary Endpoint:  http://localhost:${PORT}/api/summary`);
    console.log(` - Health Endpoint:   http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

export default app;
