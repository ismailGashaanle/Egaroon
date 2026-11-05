const env = require('../config/env');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;

/** Turnstile is on only when BOTH keys are set, so the widget and the check always switch on together. */
function isEnabled() {
  return Boolean(env.turnstile.secretKey && env.turnstile.siteKey);
}

/** Public, non-secret config for the browser (GET /auth/features). */
function publicConfig() {
  return { provider: 'turnstile', enabled: isEnabled(), siteKey: isEnabled() ? env.turnstile.siteKey : null };
}

/**
 * Ask Cloudflare whether a Turnstile token is genuine.
 * Returns { ok, reason, hostname, action }. Throws only when Cloudflare can't be reached.
 */
async function verifyToken(token, remoteIp) {
  const body = new URLSearchParams({ secret: env.turnstile.secretKey, response: String(token) });
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: data.success === true,
    reason: Array.isArray(data['error-codes']) ? data['error-codes'].join(',') : undefined,
    hostname: data.hostname,
    action: data.action,
  };
}

module.exports = { isEnabled, publicConfig, verifyToken };
