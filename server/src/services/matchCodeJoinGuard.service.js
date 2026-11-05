/**
 * Anti-scam guard for Match Code join/preview:
 * - Failed attempts tracked by IP + user (lockout after N fails)
 * - Distinct codes for wrong Match Code vs wrong Team A phone (rate-limited)
 */
const redis = require('../config/redis');
const ApiError = require('../utils/ApiError');

const FAIL_WINDOW_SEC = 15 * 60;
const MAX_FAILS = 8;
const MATCH_CODE_NOT_FOUND_MSG = 'Ma jiro code-kani';
const TEAM_A_PHONE_MISMATCH_MSG = 'Lambarka lacagta laga diray waa khalad';
/** @deprecated Prefer matchCodeNotFoundError / teamAPhoneMismatchError */
const GENERIC_FAIL_MSG =
  'Match Code ama telefoonka Team A waa khalad. Hubi oo isku day mar kale.';
const LOCKOUT_MSG =
  'Isku dayo badan oo khaldan — sug 15 daqiiqo ka dib isku day.';

function failKey({ ip, userId }) {
  const ipPart = String(ip || 'unknown').slice(0, 64);
  const userPart = String(userId || 'anon').slice(0, 64);
  return `matchjoin:fail:${ipPart}:${userPart}`;
}

async function assertNotLockedOut(ctx) {
  const key = failKey(ctx);
  const raw = await redis.get(key);
  const count = Number(raw || 0);
  if (count >= MAX_FAILS) {
    throw ApiError.badRequest(LOCKOUT_MSG, { code: 'MATCH_JOIN_LOCKOUT' });
  }
}

async function recordFailedAttempt(ctx) {
  const key = failKey(ctx);
  const count = await redis.incr(key, FAIL_WINDOW_SEC);
  if (count >= MAX_FAILS) {
    throw ApiError.badRequest(LOCKOUT_MSG, { code: 'MATCH_JOIN_LOCKOUT' });
  }
}

async function clearFailedAttempts(ctx) {
  await redis.del(failKey(ctx));
}

function matchCodeNotFoundError() {
  return ApiError.notFound(MATCH_CODE_NOT_FOUND_MSG, {
    code: 'MATCH_CODE_NOT_FOUND',
    messageSo: MATCH_CODE_NOT_FOUND_MSG,
  });
}

function teamAPhoneMismatchError() {
  return ApiError.notFound(TEAM_A_PHONE_MISMATCH_MSG, {
    code: 'TEAM_A_PHONE_MISMATCH',
    messageSo: TEAM_A_PHONE_MISMATCH_MSG,
  });
}

function genericJoinError() {
  return ApiError.notFound(GENERIC_FAIL_MSG, { code: 'MATCH_JOIN_DENIED' });
}

module.exports = {
  MAX_FAILS,
  FAIL_WINDOW_SEC,
  GENERIC_FAIL_MSG,
  MATCH_CODE_NOT_FOUND_MSG,
  TEAM_A_PHONE_MISMATCH_MSG,
  assertNotLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
  matchCodeNotFoundError,
  teamAPhoneMismatchError,
  genericJoinError,
};
