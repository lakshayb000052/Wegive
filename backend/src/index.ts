import http from 'http';
import app from './app';
import { initWebSocketServer } from './websocket';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Bind WebSocket Server
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(` DanaPro Backend Service Started`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==========================================`);
});

// Graceful shutdown handling for production readiness
const gracefulShutdown = (signal: string) => {
  console.log(`[System] Received ${signal}. Shutting down HTTP & WebSocket server gracefully...`);
  server.close(() => {
    console.log('[System] HTTP and WebSocket server closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[System] Shutdown forced after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Automated Background Sweep: Mark initiated transactions older than 25 minutes without update as 'failed'
import pool from './config/db';
setInterval(async () => {
  try {
    const sweepRes = await pool.query(`
      UPDATE donations 
      SET status = 'failed', updated_at = NOW() 
      WHERE status IN ('initiated', 'pending') 
        AND (created_at < NOW() - INTERVAL '25 minutes')
      RETURNING id, organization_id, amount
    `);
    if (sweepRes.rows.length > 0) {
      console.log(`[Stale Payment Reconciliation Engine] Auto-marked ${sweepRes.rows.length} initiated transaction(s) older than 25min as failed.`);
    }
  } catch (err) {
    console.error('[Stale Payment Reconciliation Engine Error]:', err);
  }
}, 60000); // Sweep every 60 seconds


