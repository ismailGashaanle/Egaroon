/**
 * Find users and retry createHold. No secrets.
 * Usage: node scripts/verify-create-hold-any.js [fieldId] [start] [end]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

const fieldId = process.argv[2] || '6a8c65a0c3d026350d30c9f4';
const startISO = process.argv[3] || '2026-08-31T13:00:00.000Z';
const endISO = process.argv[4] || '2026-08-31T14:00:00.000Z';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../src/models/User');
  const Field = require('../src/models/Field');
  const bookingService = require('../src/services/booking.service');

  const roles = await User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]);
  console.log('roles', roles);

  const captain =
    (await User.findOne({ role: /captain/i }).sort({ createdAt: -1 })) ||
    (await User.findOne({ role: 'TEAM_CAPTAIN' })) ||
    (await User.findOne({}).sort({ createdAt: -1 }));

  if (!captain) {
    console.error('no users');
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  console.log('using user', String(captain._id), captain.role, captain.email || captain.phone);

  const field = await Field.findById(fieldId);
  if (!field) {
    console.error('field missing');
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  // Overlap before
  const Booking = require('../src/models/Booking');
  const before = await Booking.find({
    field: fieldId,
    startTime: { $lt: new Date(endISO) },
    endTime: { $gt: new Date(startISO) },
    status: { $in: ['HELD', 'PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'] },
  }).select('status startTime endTime holdExpiresAt');
  console.log(
    'overlap before',
    before.map((b) => ({ id: String(b._id), status: b.status, start: b.startTime, end: b.endTime }))
  );

  try {
    const booking = await bookingService.createHold({
      fieldId,
      stadiumId: field.stadium,
      captainId: String(captain._id),
      teamName: 'DebugHoldTeam',
      startTime: startISO,
      endTime: endISO,
    });
    console.log('createHold OK', {
      id: String(booking._id),
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt,
    });
    await bookingService.forceClearHolds({ fieldId, includeActive: true });
    console.log('cleaned');
  } catch (err) {
    console.error('createHold FAIL', err.statusCode || err.code, err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 8).join('\n'));
    process.exitCode = 1;
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
