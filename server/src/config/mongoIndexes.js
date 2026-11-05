const mongoose = require('mongoose');

/**
 * Removes legacy 2dsphere indexes on `stadiums.location` that conflict with the
 * current subdocument schema (address/city/region + optional lat/lng).
 */
async function dropLegacyStadiumGeoIndexes() {
  try {
    const coll = mongoose.connection.collection('stadiums');
    const indexes = await coll.indexes();
    let dropped = false;
    for (const idx of indexes) {
      const keyEntries = Object.entries(idx.key || {});
      const isGeo = keyEntries.some(([, v]) => v === '2dsphere');
      if (isGeo) {
        await coll.dropIndex(idx.name);
        console.log(`[mongo] dropped legacy stadium geo index: ${idx.name}`);
        dropped = true;
      }
    }
    // Common auto-generated name when schema once used `{ location: '2dsphere' }`
    if (!dropped) {
      try {
        await coll.dropIndex('location_2dsphere');
        console.log('[mongo] dropped legacy stadium geo index: location_2dsphere');
      } catch {
        // index absent — expected on fresh databases
      }
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[mongo] could not inspect stadium indexes:', err.message);
    }
  }
}

/**
 * Orphan indexes on `bookings` that are NOT defined by models/Booking.js.
 *
 * Critical: `bookingId_1` unique (non-sparse) treats missing bookingId as null,
 * so after the first booking every insert fails with E11000 { bookingId: null }.
 * createHold then misreports that as "This slot is already booked".
 *
 * `user_1_tournament_1` belongs to tournament registration, not Booking.
 */
const ORPHAN_BOOKING_INDEX_NAMES = ['bookingId_1', 'user_1_tournament_1'];

async function dropOrphanBookingIndexes() {
  try {
    const coll = mongoose.connection.collection('bookings');
    const indexes = await coll.indexes();
    const byName = new Set(indexes.map((i) => i.name));

    for (const name of ORPHAN_BOOKING_INDEX_NAMES) {
      if (!byName.has(name)) continue;
      try {
        await coll.dropIndex(name);
        console.log(`[mongo] dropped orphan bookings index: ${name}`);
      } catch (err) {
        console.warn(`[mongo] failed to drop bookings index ${name}:`, err.message);
      }
    }

    // Also catch unique indexes on fields the Booking schema never defines.
    for (const idx of indexes) {
      if (idx.name === '_id_' || ORPHAN_BOOKING_INDEX_NAMES.includes(idx.name)) continue;
      const keys = Object.keys(idx.key || {});
      const looksOrphan =
        idx.unique &&
        (keys.includes('bookingId') || (keys.includes('user') && keys.includes('tournament')));
      if (looksOrphan) {
        try {
          await coll.dropIndex(idx.name);
          console.log(`[mongo] dropped orphan bookings index: ${idx.name}`);
        } catch (err) {
          console.warn(`[mongo] failed to drop bookings index ${idx.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[mongo] could not inspect booking indexes:', err.message);
    }
  }
}

/**
 * Legacy sparse unique `{ user: 1, dedupeKey: 1 }` treated missing dedupeKey as null,
 * so the 2nd Notification.create for the same user threw E11000 → gate check-in 409.
 * Drop old names; schema recreates partial unique `user_1_dedupeKey_1_partial`.
 */
async function dropBrokenNotificationIndexes() {
  try {
    const coll = mongoose.connection.collection('notifications');
    const indexes = await coll.indexes();
    for (const idx of indexes) {
      if (idx.name === '_id_') continue;
      const keys = Object.keys(idx.key || {});
      const isUserDedupe =
        idx.unique && keys.length === 2 && keys.includes('user') && keys.includes('dedupeKey');
      if (!isUserDedupe) continue;
      // Keep the corrected partial index if already present
      if (idx.name === 'user_1_dedupeKey_1_partial' && idx.partialFilterExpression) continue;
      try {
        await coll.dropIndex(idx.name);
        console.log(`[mongo] dropped broken notifications index: ${idx.name}`);
      } catch (err) {
        console.warn(`[mongo] failed to drop notifications index ${idx.name}:`, err.message);
      }
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[mongo] could not inspect notification indexes:', err.message);
    }
  }
}

async function ensureMongoIndexes() {
  await dropLegacyStadiumGeoIndexes();
  await dropOrphanBookingIndexes();
  await dropBrokenNotificationIndexes();
}

module.exports = {
  dropLegacyStadiumGeoIndexes,
  dropOrphanBookingIndexes,
  dropBrokenNotificationIndexes,
  ensureMongoIndexes,
};
