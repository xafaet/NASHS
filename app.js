// app.js - cPanel / Phusion Passenger Node.js Startup Entry Point
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if (typeof require !== 'undefined') {
  try {
    require('./dist/server.cjs');
  } catch (err) {
    console.error('[cPanel Startup] Failed to load dist/server.cjs via require:', err);
    process.exit(1);
  }
} else {
  import('./dist/server.cjs').catch((err) => {
    console.error('[cPanel Startup] Failed to load dist/server.cjs via import:', err);
    process.exit(1);
  });
}
