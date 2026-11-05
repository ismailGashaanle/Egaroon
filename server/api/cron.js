// Runs one tick of the background jobs (hold expiry, match lifecycle, settlement/escrow release,
// lineup cleanup, weather). Replaces startJobs()'s setInterval on Vercel.
// Call it every minute — Vercel Cron (Pro) or any external pinger — with
//   Authorization: Bearer <CRON_SECRET>
const crypto = require('crypto');
const bootstrap = require('../src/bootstrap');

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = String(req.headers.authorization || '');
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (!authorized(req)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }));
    return;
  }
  try {
    await bootstrap();
    const { runOnce } = require('../src/jobs/scheduler');
    await runOnce();
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, ranAt: new Date().toISOString() }));
  } catch (err) {
    console.error('[cron] tick failed:', err.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: { message: 'Job tick failed' } }));
  }
};
