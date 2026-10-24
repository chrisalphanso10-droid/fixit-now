/**
 * FixIt Now - Express Application Entry Point
 * Conforms to docs/PLAN.md Phase 1:
 * - Config loading
 * - DB connection pool
 * - Central error handler
 * - Request logging
 * - CORS
 */

import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import requestLogger from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { payRateLimiter, renderPayPage } from './controllers/payment.controller.js';

const app = express();

// =============================================================================
// 1. CORS Middleware (Permissive in development for localhost & Vite)
// =============================================================================
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any localhost / 127.0.0.1 port in development
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      if (config.clientUrl && origin === config.clientUrl) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
  })
);

// =============================================================================
// 2. Request Parsers & Logging Middleware
// =============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// =============================================================================
// 3. QR Code Payment Page (Server-Rendered Mobile-Friendly - ITEM 3)
// =============================================================================
app.get('/pay/:token', payRateLimiter, renderPayPage);

// =============================================================================
// 4. API Root Routes
// =============================================================================
app.use('/api', routes);

// =============================================================================
// 4. 404 Not Found & Central Error Handler
// =============================================================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
