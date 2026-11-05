/**
 * Safe one-shot maintenance for stuck HELD / PAYMENT_PENDING docs.
 * NEVER touches CONFIRMED / CHECKED_IN / IN_PROGRESS / COMPLETED / paid matches.
 *
 * Usage:
 *   node scripts/expire-stuck-holds.js
 *   node scripts/expire-stuck-holds.js <fieldId>
 *   node scripts/expire-stuck-holds.js <fieldId> --include-active
 *
 * --include-active: also expire holds still inside holdExpiresAt (dev/admin only).
 *
 * Does not print MONGO_URI / secrets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { dropOrphanBookingIndexes } = require('../src/config/mongoIndexes');

const fieldId = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null;
const includeActive = process.argv.includes('--include-active');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[expire-stuck] connected');

  await dropOrphanBookingIndexes();

  require('../src/models/Booking');
  require('../src/models/PlatformSettings');
  const bookingService = require('../src/services/booking.service');

  const stale = await bookingService.expireStaleHolds();
  console.log('[expire-stuck] expireStaleHolds cleared', stale.length);

  const forced = await bookingService.forceClearHolds({
    fieldId: fieldId || undefined,
    includeActive,
  });
  console.log('[expire-stuck] forceClearHolds', {
    fieldId: fieldId || 'ALL',
    includeActive,
    clearedCount: forced.clearedCount,
    skippedCount: (forced.skipped || []).length,
  });
  for (const s of (forced.skipped || []).slice(0, 20)) {
    console.log('  skipped', String(s.id), s.reason, s.status || '');
  }

  await mongoose.disconnect();
  console.log('[expire-stuck] done');
})().catch((e) => {
  console.error('[expire-stuck] ERR', e.message);
  process.exit(1);
});
