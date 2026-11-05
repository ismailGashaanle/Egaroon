const http = require('http');
const app = require('./app');
const env = require('./config/env');
const bootstrap = require('./bootstrap');
const { initSockets } = require('./sockets');
const { startJobs } = require('./jobs/scheduler');

async function start() {
  await bootstrap();

  const httpServer = http.createServer(app);
  initSockets(httpServer);
  startJobs();

  httpServer.listen(env.port, () => {
    console.log(`[server] kulansiiye API listening on port ${env.port} (${env.nodeEnv})`);
    try {
      const { isEnabled } = require('./services/cloudinary.service');
      console.log(`[server] cloudinary ${isEnabled() ? 'enabled' : 'disabled (set CLOUDINARY_* in server/.env)'}`);
    } catch {
      console.log('[server] cloudinary disabled');
    }
  });

  const shutdown = (signal) => {
    console.log(`[server] received ${signal}, shutting down...`);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
