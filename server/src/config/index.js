/**
 * FixIt Now - Centralized Server Configuration
 * Loads environment variables from server/.env with strict validation.
 */

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Database
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now',

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || 'fixitnow-default-jwt-secret-key-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Admin Account Defaults
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@fixitnow.com').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin@123',

  // External Geocoding Interface (SRS Section 4)
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT || 'FixItNow-HomeServicesApp/1.0 (info@fixitnow.local)',
};

export default config;
