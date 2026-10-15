// server.js - cPanel / Phusion Passenger Node.js Entry Point
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Import the production server bundle
import('./dist/server.cjs').catch((err) => {
  console.error('[cPanel Startup] Failed to load dist/server.cjs:', err);
  process.exit(1);
});
