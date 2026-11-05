/**
 * Read-only diagnostics for hold 409. No PII, no mutations.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection('users');
  const bookings = mongoose.connection.collection('bookings');

  const roles = await users.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]).toArray();
  console.log('roles', JSON.stringify(roles));
  console.log('team_captain_count', await users.countDocuments({ role: 'team_captain' }));

  const dups = await bookings
    .aggregate([
      { $match: { bookingCode: { $exists: true, $ne: null } } },
      { $group: { _id: '$bookingCode', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ])
    .toArray();
  console.log('dup_bookingCodes', dups.length);

  const fieldId = new mongoose.Types.ObjectId('6a8c65a0c3d026350d30c9f4');
  const conf = await bookings
    .find({ field: fieldId, status: 'CONFIRMED' })
    .project({ startTime: 1, endTime: 1, status: 1 })
    .toArray();
  console.log(
    'confirmed_slots',
    conf.map((b) => ({ start: b.startTime, end: b.endTime }))
  );

  const live = await bookings.countDocuments({
    status: { $in: ['HELD', 'PAYMENT_PENDING'] },
  });
  console.log('global_live_holds', live);

  const idxs = await bookings.indexes();
  console.log(
    'unique_indexes',
    idxs
      .filter((i) => i.unique)
      .map((i) => ({ name: i.name, key: i.key, partial: i.partialFilterExpression || null, sparse: i.sparse || false }))
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
