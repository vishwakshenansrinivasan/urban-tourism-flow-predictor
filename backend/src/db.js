/**
 * Database abstraction layer.
 * Supports Node.js 22+ built-in `node:sqlite` for local SQLite
 * and `pg` for PostgreSQL + PostGIS.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, '../../data/urban_flow.db');

const databaseUrl = process.env.DATABASE_URL || '';
const isPostgres = databaseUrl.startsWith('postgres');

let sqliteDb = null;
let pgPool = null;

if (isPostgres) {
  pgPool = new pg.Pool({ connectionString: databaseUrl });
  console.log('[Backend DB] Connected to PostgreSQL + PostGIS.');
} else {
  sqliteDb = new DatabaseSync(defaultDbPath);
  console.log(`[Backend DB] Connected to SQLite database at: ${defaultDbPath}`);
}

/**
 * Executes a query with optional parameters and returns an array of row objects.
 */
export async function query(sql, params = []) {
  if (isPostgres) {
    // Translate ? placeholders to $1, $2 for postgres if needed
    let pgSql = sql;
    let paramIdx = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIdx++}`);
    }
    const result = await pgPool.query(pgSql, params);
    return result.rows;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...params);
  }
}

/**
 * Returns database health and metadata.
 */
export async function getDbHealth() {
  const nodeCount = await query('SELECT COUNT(*) as count FROM nodes');
  const metricsCount = await query('SELECT COUNT(*) as count FROM hourly_metrics');
  const forecastCount = await query('SELECT COUNT(*) as count FROM forecasts');

  return {
    engine: isPostgres ? 'PostgreSQL + PostGIS' : 'SQLite (node:sqlite)',
    nodes: Number(nodeCount[0]?.count || 0),
    metrics: Number(metricsCount[0]?.count || 0),
    forecasts: Number(forecastCount[0]?.count || 0)
  };
}
