/**
 * FixIt Now - PostgreSQL Connection Pool
 * Manages connection pooling, lifecycle events, and query execution.
 */

import pg from 'pg';
import config from './index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20, // Maximum active connections in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Fail fast after 5 seconds if unable to connect
});

// Pool lifecycle listeners
pool.on('connect', () => {
  if (config.nodeEnv === 'development') {
    // Only log verbose pool connects in debug/trace
  }
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected error on idle client', err);
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development' && duration > 500) {
      console.warn(`[Slow Query] (${duration}ms): ${text.trim().substring(0, 100)}...`);
    }
    return res;
  } catch (err) {
    console.error(`[Database Query Error]: ${err.message}\nQuery: ${text}`);
    throw err;
  }
}

/**
 * Acquire a dedicated client from the pool (for transactions)
 * Remember to call client.release() when done!
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Test DB connection health
 * @returns {Promise<{ ok: boolean, version?: string, error?: string }>}
 */
export async function testConnection() {
  try {
    const res = await pool.query('SELECT current_database(), current_user, version()');
    return {
      ok: true,
      database: res.rows[0].current_database,
      user: res.rows[0].current_user,
      version: res.rows[0].version,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
    };
  }
}

export default {
  pool,
  query,
  getClient,
  testConnection,
};
