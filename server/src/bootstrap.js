const connectDB = require('./config/db');

let ready = null;

/**
 * One-time startup work shared by the long-running server (server.js) and the
 * Vercel serverless functions (api/*.js). Cached per process, so a warm
 * serverless instance only pays for it on cold start.
 */
function bootstrap() {
  if (!ready) {
    ready = (async () => {
      await connectDB();

      if (require('./services/demo2fa.service').isEnabled()) {
        console.warn(
          '[security] DEMO_2FA_CODE is set: the login second step accepts a FIXED sample code. This is for testing only — not real two-factor security.'
        );
      }

      // Redis is optional — init never throws; falls back to in-memory locks if offline.
      try {
        const { initRedis, isRedisAvailable } = require('./config/redis');
        await initRedis();
        console.log(`[server] redis ${isRedisAvailable() ? 'connected' : 'offline (memory locks)'}`);
      } catch (err) {
        console.warn('[server] redis init skipped:', err.message);
      }

      try {
        const { hydrate } = require('./services/platformSettings.service');
        await hydrate();
        console.log('[server] platform settings loaded');
      } catch (err) {
        console.warn('[server] platform settings hydrate failed, using env defaults:', err.message);
      }

      try {
        const { hydrate: hydrateSiteContent } = require('./services/siteContent.service');
        await hydrateSiteContent();
        console.log('[server] site content loaded');
      } catch (err) {
        console.warn('[server] site content hydrate failed, using empty defaults:', err.message);
      }

      try {
        const { ensureDefaultCities } = require('./services/weather.service');
        await ensureDefaultCities();
        console.log('[server] weather cities seeded (Hargeisa, Muqdisho, Burao, Borama)');
      } catch (err) {
        console.warn('[server] weather cities seed failed:', err.message);
      }
    })().catch((err) => {
      ready = null; // let the next request retry
      throw err;
    });
  }
  return ready;
}

module.exports = bootstrap;
