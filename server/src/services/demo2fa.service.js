const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * DEMO second login step — a fixed sample code, for TESTING deployments only.
 *
 * Off unless DEMO_2FA_CODE is set. When on, a correct password does not sign the user in: they must
 * also enter that sample code. It is NOT real two-factor security (anyone who knows the code passes),
 * so replace it with real authenticator-app 2FA before opening the site to real customers.
 */
const PURPOSE = 'login_demo_2fa';
const CHALLENGE_TTL = '5m';

function isEnabled() {
  return env.demo2fa.codes.length > 0;
}

function signChallenge(user) {
  return jwt.sign({ sub: String(user._id), purpose: PURPOSE }, env.jwt.refreshSecret, { expiresIn: CHALLENGE_TTL });
}

function readChallenge(token) {
  try {
    const payload = jwt.verify(String(token || ''), env.jwt.refreshSecret);
    if (payload.purpose !== PURPOSE) throw new Error('wrong purpose');
    return payload.sub;
  } catch {
    throw ApiError.unauthorized('This login session expired. Please sign in again.');
  }
}

/** True when `input` equals any configured sample code (every code is compared, in constant time). */
function codeMatches(input) {
  const a = crypto.createHash('sha256').update(String(input || '').trim()).digest();
  let ok = false;
  for (const code of env.demo2fa.codes) {
    const b = crypto.createHash('sha256').update(code).digest();
    ok = crypto.timingSafeEqual(a, b) || ok;
  }
  return ok;
}

module.exports = { isEnabled, signChallenge, readChallenge, codeMatches };
