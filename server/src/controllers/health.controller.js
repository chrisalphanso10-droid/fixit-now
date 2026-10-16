/**
 * FixIt Now - Health Controller
 * Provides system diagnostics, database connection status, and operational health.
 */

import db from '../config/db.js';
import config from '../config/index.js';

export const getHealth = async (req, res, next) => {
  try {
    const dbTest = await db.testConnection();

    // Query counts of seeded baseline entities if DB is connected
    let tablesSummary = null;
    if (dbTest.ok) {
      try {
        const counts = await db.query(`
          SELECT 
            (SELECT COUNT(*) FROM services) AS services_count,
            (SELECT COUNT(*) FROM plans) AS plans_count,
            (SELECT COUNT(*) FROM partners) AS partners_count,
            (SELECT COUNT(*) FROM admins) AS admins_count
        `);
        tablesSummary = {
          services: parseInt(counts.rows[0].services_count, 10),
          plans: parseInt(counts.rows[0].plans_count, 10),
          partners: parseInt(counts.rows[0].partners_count, 10),
          admins: parseInt(counts.rows[0].admins_count, 10),
        };
      } catch {
        // Table count is optional info
      }
    }

    return res.status(dbTest.ok ? 200 : 503).json({
      status: dbTest.ok ? 'ok' : 'degraded',
      service: 'FixIt Now API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      database: {
        connected: dbTest.ok,
        database: dbTest.database || null,
        user: dbTest.user || null,
        error: dbTest.error || null,
        baseline: tablesSummary,
      },
    });
  } catch (err) {
    next(err);
  }
};
