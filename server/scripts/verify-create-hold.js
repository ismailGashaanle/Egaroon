/**
 * Drop orphan bookings indexes + simulate createHold for a field/slot.
 * Usage: node scripts/verify-create-hold.js [fieldId] [startISO] [endISO] [captainEmail]
 * Does not print MONGO_URI / secrets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { dropOrphanBookingIndexes } = require('../src/config/mongoIndexes');

const fieldId = process.argv[2] || '6a8c65a0c3d026350d30c9f4';
const startISO = process.argv[3] || '2026-08-26T06:00:00.000Z';
const endISO = process.argv[4] || '2026-08-26T07:00:00.000Z';
const captainEmail = process.argv[5] || null;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[verify] connected');

  await dropOrphanBookingIndexes();

  const idxs = await mongoose.connection.collection('bookings').indexes();
  const orphan = idxs.filter((i) => i.name === 'bookingId_1' || i.name === 'user_1_tournament_1');
  console.log('[verify] orphan indexes remaining:', orphan.map((i) => i.name));

  // Probe insert (same as earlier debug)
  const BookingColl = mongoose.connection.collection('bookings');
  const probe = {
    field: new mongoose.Types.ObjectId(fieldId),
    stadium: new mongoose.Types.ObjectId(),
    startTime: new Date('2099-01-01T00:00:00.000Z'),
    endTime: new Date('2099-01-01T01:00:00.000Z'),
    status: 'HELD',
    pricing: { mode: 'fixed', unitPrice: 1, totalPrice: 1, currency: 'USD' },
    teamA: {
      team: new mongoose.Types.ObjectId(),
      captain: new mongoose.Types.ObjectId(),
      playersCount: 7,
      amountDue: 1,
      paymentStatus: 'PENDING',
    },
    holdExpiresAt: new Date(Date.now() + 600000),
    bookingCode: 'PROBE' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    const r = await BookingColl.insertOne(probe);
    console.log('[verify] probe insert OK', String(r.insertedId));
    await BookingColl.deleteOne({ _id: r.insertedId });
  } catch (err) {
    console.error('[verify] probe insert FAILED', err.code, err.message, err.keyPattern, err.keyValue);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  // Full createHold via service (needs Field + captain)
  require('../src/models/Booking');
  require('../src/models/Field');
  require('../src/models/User');
  require('../src/models/Team');
  require('../src/models/Stadium');
  require('../src/models/PlatformSettings');

  const Field = require('../src/models/Field');
  const User = require('../src/models/User');
  const bookingService = require('../src/services/booking.service');

  const field = await Field.findById(fieldId);
  if (!field) {
    console.error('[verify] field not found', fieldId);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  console.log('[verify] field', String(field._id), 'status', field.status, 'stadium', String(field.stadium));

  let captain = null;
  if (captainEmail) {
    captain = await User.findOne({ email: captainEmail.toLowerCase() });
  }
  if (!captain) {
    captain = await User.findOne({ role: 'team_captain' }).sort({ createdAt: -1 });
  }
  if (!captain) {
    console.error('[verify] no TEAM_CAPTAIN user found');
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  console.log('[verify] captain', String(captain._id), captain.email || captain.phone);

  try {
    const booking = await bookingService.createHold({
      fieldId,
      stadiumId: field.stadium,
      captainId: String(captain._id),
      teamName: 'Warsame8',
      startTime: startISO,
      endTime: endISO,
    });
    console.log('[verify] createHold OK', {
      id: String(booking._id),
      status: booking.status,
      start: booking.startTime,
      end: booking.endTime,
      holdExpiresAt: booking.holdExpiresAt,
    });

    // Idempotent re-hold
    const again = await bookingService.createHold({
      fieldId,
      stadiumId: field.stadium,
      captainId: String(captain._id),
      teamName: 'Warsame8',
      startTime: startISO,
      endTime: endISO,
    });
    console.log('[verify] re-hold same captain OK', {
      id: String(again._id),
      same: String(again._id) === String(booking._id),
    });

    // Cleanup test hold so field stays free
    await bookingService.forceClearHolds({ fieldId, includeActive: true });
    console.log('[verify] cleaned test holds for field');
  } catch (err) {
    console.error('[verify] createHold FAILED', err.statusCode || err.code, err.message, err.details || '');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
