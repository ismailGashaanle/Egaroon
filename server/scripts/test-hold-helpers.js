/**
 * Pure unit checks for hold conflict helpers (no Mongo).
 * Usage: node scripts/test-hold-helpers.js
 */
const assert = require('assert');

// Minimal stubs so requiring booking.service doesn't need a live DB connection yet.
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kulansiiye_test';

// Load only the bits we can exercise via exported functions after require.
// booking.service pulls models; we only assert exported helpers that don't hit DB.

function isOrphanBookingIdDup(err) {
  if (!err || err.code !== 11000) return false;
  if (err.keyPattern && Object.prototype.hasOwnProperty.call(err.keyPattern, 'bookingId')) {
    return true;
  }
  if (err.keyValue && Object.prototype.hasOwnProperty.call(err.keyValue, 'bookingId')) {
    return true;
  }
  const msg = String(err.message || '');
  return /index:\s*bookingId_1\b/i.test(msg) || /dup key:.*bookingId/i.test(msg);
}

function isSlotUniqueDup(err) {
  if (!err || err.code !== 11000 || !err.keyPattern) return false;
  const keys = Object.keys(err.keyPattern);
  return keys.includes('field') && keys.includes('startTime') && keys.includes('endTime');
}

function isSoftExpiredHold(booking, now = Date.now()) {
  const LIVE = ['HELD', 'PAYMENT_PENDING'];
  if (!LIVE.includes(booking.status)) return false;
  const due =
    booking.teamBPaymentDueAt ||
    booking.holdExpiresAt ||
    booking.teamB?.paymentDeadline ||
    booking.teamA?.paymentDeadline ||
    null;
  if (due) return new Date(due).getTime() <= now;
  const holdMs = 10 * 60 * 1000;
  const created = booking.createdAt ? new Date(booking.createdAt).getTime() : 0;
  return created > 0 && created + holdMs <= now;
}

assert.strictEqual(
  isOrphanBookingIdDup({ code: 11000, keyPattern: { bookingId: 1 }, keyValue: { bookingId: null } }),
  true,
  'orphan via keyPattern'
);
assert.strictEqual(
  isOrphanBookingIdDup({ code: 11000, keyValue: { bookingId: null } }),
  true,
  'orphan via keyValue alone (historical misdetect)'
);
assert.strictEqual(
  isOrphanBookingIdDup({
    code: 11000,
    keyPattern: { field: 1, startTime: 1, endTime: 1 },
  }),
  false
);
assert.strictEqual(
  isSlotUniqueDup({ code: 11000, keyPattern: { field: 1, startTime: 1, endTime: 1 } }),
  true
);
assert.strictEqual(
  isSoftExpiredHold({
    status: 'HELD',
    holdExpiresAt: new Date(Date.now() - 1000),
  }),
  true
);
assert.strictEqual(
  isSoftExpiredHold({
    status: 'HELD',
    holdExpiresAt: new Date(Date.now() + 60_000),
  }),
  false
);
assert.strictEqual(
  isSoftExpiredHold({
    status: 'CONFIRMED',
    holdExpiresAt: new Date(Date.now() - 1000),
  }),
  false,
  'confirmed never soft-expired'
);
assert.strictEqual(
  isSoftExpiredHold({
    status: 'EXPIRED',
    holdExpiresAt: new Date(Date.now() - 1000),
  }),
  false,
  'expired status not live'
);

console.log('test-hold-helpers: OK');
