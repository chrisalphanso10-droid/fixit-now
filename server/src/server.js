/**
 * FixIt Now - HTTP Server Bootstrap
 * Connects to PostgreSQL connection pool, starts HTTP listener, handles graceful shutdown.
 */

import http from 'http';
import config from './config/index.js';
import db from './config/db.js';
import app from './app.js';
import { initSocketServer, cleanupOrphanedSearchingRequests } from './services/socket.service.js';
import { recoverPaymentAttemptsOnStartup } from './services/payment.service.js';

const PORT = config.port || 5000;

// Test DB connection before listening
async function startServer() {
  const dbStatus = await db.testConnection();
  if (dbStatus.ok) {
    console.log(`[Database Connected] PostgreSQL: ${dbStatus.database} (user: ${dbStatus.user})`);
  } else {
    console.warn(`[Database Warning] Could not connect to PostgreSQL: ${dbStatus.error}`);
    console.warn(`Ensure PostgreSQL is running and DATABASE_URL in server/.env is correct.`);
  }

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  // Requirement h: If server restarts, cleanly expire orphaned searching requests
  await cleanupOrphanedSearchingRequests();

  // ITEM 3: Recover payment attempts on startup (complete processing attempts, expire past-expiry ones)
  await recoverPaymentAttemptsOnStartup();

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`FixIt Now Backend Server running on port ${PORT} (0.0.0.0)`);
    console.log(`Socket.IO Engine:  Ready for dispatches & rooms`);
    console.log(`Health Diagnostic: http://localhost:${PORT}/api/health`);
    console.log(`Environment:       ${config.nodeEnv}`);
    console.log(`Public Base URL:   ${config.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:' + PORT}`);
    console.log(`UPI Demo ID:       ${config.upiId || process.env.UPI_ID || 'fixitnow@demo'}`);
    console.log(`===============================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FixIt Now Server Error] Port ${PORT} is already in use.`);
      console.error(
        `Please close any existing process on port ${PORT} or set PORT in server/.env.\n`
      );
      process.exit(1);
    } else {
      console.error('[FixIt Now Server Error]', err);
      process.exit(1);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Closing FixIt Now server and DB connections...`);
    server.close(async () => {
      await db.pool.end();
      console.log('FixIt Now server and database pool closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Startup Failure]', err);
  process.exit(1);
});
