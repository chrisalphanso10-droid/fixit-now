import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`FixIt Now Backend Server running on port ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Environment:  ${process.env.NODE_ENV || 'development'}`);
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('FixIt Now server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('FixIt Now server closed.');
    process.exit(0);
  });
});
