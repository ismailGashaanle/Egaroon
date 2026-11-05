/**
 * A fake "Google" for testing Continue-with-Google locally — no Google account needed.
 *
 *   node scripts/mock-google.js            # listens on http://localhost:9099
 *
 * Start the API (not production) with:
 *   GOOGLE_CLIENT_ID=mock-client GOOGLE_CLIENT_SECRET=mock-secret \
 *   GOOGLE_OAUTH_AUTH_URL=http://localhost:9099/auth \
 *   GOOGLE_OAUTH_TOKEN_URL=http://localhost:9099/token \
 *   GOOGLE_OAUTH_USERINFO_URL=http://localhost:9099/userinfo \
 *   npm run dev
 *
 * Then click "Continue with Google": you get an account chooser instead of Google.
 */
const http = require('http');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.MOCK_GOOGLE_PORT || 9099);
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock-secret';

const ACCOUNTS = {
  alice: { sub: 'mock-alice', email: 'alice@example.com', name: 'Alice New Captain', email_verified: true, label: 'New player (verified email)' },
  bob: { sub: 'mock-bob', email: 'bob.owner@example.com', name: 'Bob Stadium Owner', email_verified: true, label: 'New stadium owner (verified email)' },
  demo: { sub: 'mock-demo', email: 'captain@demo.kulansiiye', name: 'Demo Captain', email_verified: true, label: 'Existing demo captain (should link, not duplicate)' },
  unverified: { sub: 'mock-unv', email: 'admin@demo.kulansiiye', name: 'Attacker', email_verified: false, label: 'Unverified email matching an EXISTING admin (must be refused)' },
};

const codes = new Map(); // code -> account
const tokens = new Map(); // access token -> account

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(new URLSearchParams(data)));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/auth') {
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const rows = Object.entries(ACCOUNTS)
      .map(([id, a]) => {
        const target = `/approve?acct=${id}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
        return `<a class="a" href="${esc(target)}"><b>${esc(a.name)}</b><br><small>${esc(a.email)} — ${esc(a.label)}</small></a>`;
      })
      .join('');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!doctype html><meta charset=utf-8><title>Mock Google</title>
<style>body{font:15px system-ui;max-width:460px;margin:60px auto}h2{margin-bottom:4px}.a{display:block;border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0;text-decoration:none;color:#222}.a:hover{background:#f3f7ff}small{color:#666}</style>
<h2>Mock Google sign-in</h2><p>Choose an account to continue to E-Garoon</p>${rows}`);
  }

  if (req.method === 'GET' && url.pathname === '/approve') {
    const acct = ACCOUNTS[url.searchParams.get('acct')];
    const redirectUri = url.searchParams.get('redirect_uri');
    if (!acct || !redirectUri) {
      res.writeHead(400);
      return res.end('bad request');
    }
    const code = `mockcode_${randomUUID()}`;
    codes.set(code, acct);
    const back = new URL(redirectUri);
    back.searchParams.set('code', code);
    back.searchParams.set('state', url.searchParams.get('state') || '');
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/token') {
    const form = await readBody(req);
    const acct = codes.get(form.get('code'));
    codes.delete(form.get('code')); // single use, like the real thing
    if (!acct || form.get('client_secret') !== CLIENT_SECRET || form.get('grant_type') !== 'authorization_code') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid_grant' }));
    }
    const token = `mocktok_${randomUUID()}`;
    tokens.set(token, acct);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: 3600 }));
  }

  if (req.method === 'GET' && url.pathname === '/userinfo') {
    const acct = tokens.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!acct) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid_token' }));
    }
    const { label, ...profile } = acct;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(profile));
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => console.log(`[mock-google] listening on http://localhost:${PORT}`));
