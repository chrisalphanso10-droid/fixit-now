/**
 * Health Controller
 * Provides system diagnostics and status verification
 */

export const getHealth = (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'FixIt Now API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
};
