// Vercel serverless entry: every request (see vercel.json rewrite) lands here and is handled by Express.
// Socket.IO and the in-process job scheduler do not run here — jobs are driven by api/cron.js.
const app = require('../src/app');
const bootstrap = require('../src/bootstrap');

module.exports = async (req, res) => {
  try {
    await bootstrap();
  } catch (err) {
    console.error('[api] bootstrap failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { message: 'Service temporarily unavailable' } }));
    return;
  }
  // Pick up Platform Settings changed on another instance (e.g. owner signup toggled by the admin).
  try {
    await require('../src/services/platformSettings.service').refreshIfStale();
  } catch (err) {
    console.warn('[api] settings refresh failed:', err.message);
  }
  // No always-on timer on Vercel: let regular traffic drive expiry/settlement ticks (throttled).
  try {
    await require('../src/jobs/scheduler').runOnceIfDue();
  } catch (err) {
    console.warn('[api] job tick failed:', err.message);
  }
  return app(req, res);
};
