/**
 * Inspect bookings collection indexes and 11000 cause. No secrets printed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Booking = mongoose.connection.collection('bookings');

  const total = await Booking.countDocuments({});
  const missingBookingId = await Booking.countDocuments({
    $or: [{ bookingId: { $exists: false } }, { bookingId: null }],
  });
  const withBookingId = await Booking.countDocuments({ bookingId: { $exists: true, $ne: null } });
  console.log({ total, missingBookingId, withBookingId });

  // Sample a few docs field names
  const sample = await Booking.find({}).project({ bookingId: 1, status: 1, field: 1, startTime: 1, bookingCode: 1 }).limit(5).toArray();
  console.log(
    'samples',
    sample.map((d) => ({
      id: String(d._id),
      hasBookingId: Object.prototype.hasOwnProperty.call(d, 'bookingId'),
      bookingId: d.bookingId,
      status: d.status,
      field: String(d.field),
      start: d.startTime,
      bookingCode: d.bookingCode,
    }))
  );

  // Try insert that should only fail on orphan bookingId unique index
  const fieldId = new mongoose.Types.ObjectId('6a8c65a0c3d026350d30c9f4');
  const stadiumId = (await Booking.findOne({ field: fieldId }))?.stadium
    || (await mongoose.connection.collection('fields').findOne({ _id: fieldId }))?.stadium;

  const doc = {
    field: fieldId,
    stadium: stadiumId || new mongoose.Types.ObjectId(),
    startTime: new Date('2026-08-26T06:00:00.000Z'),
    endTime: new Date('2026-08-26T07:00:00.000Z'),
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
    bookingCode: 'DBG' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const res = await Booking.insertOne(doc);
    console.log('INSERT OK', String(res.insertedId));
    await Booking.deleteOne({ _id: res.insertedId });
    console.log('cleaned up test insert');
  } catch (err) {
    console.log('INSERT FAIL code', err.code, 'message', err.message);
    console.log('keyPattern', err.keyPattern);
    console.log('keyValue', err.keyValue);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
