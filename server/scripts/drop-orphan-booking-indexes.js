/**
 * One-shot: drop orphan bookings indexes (bookingId_1 etc).
 * Usage: node scripts/drop-orphan-booking-indexes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { dropOrphanBookingIndexes } = require('../src/config/mongoIndexes');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const before = await mongoose.connection.collection('bookings').indexes();
  console.log(
    'before',
    before.map((i) => i.name)
  );
  await dropOrphanBookingIndexes();
  const after = await mongoose.connection.collection('bookings').indexes();
  console.log(
    'after',
    after.map((i) => i.name)
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
