/**
 * Scan live HELD/PAYMENT_PENDING across all fields. No secrets printed.
 * Usage: node scripts/debug-all-holds.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const B = mongoose.connection.collection('bookings');
  const held = await B.find({ status: { $in: ['HELD', 'PAYMENT_PENDING'] } })
    .project({
      field: 1,
      status: 1,
      startTime: 1,
      endTime: 1,
      holdExpiresAt: 1,
      createdAt: 1,
      partialPaymentTimeoutAt: 1,
      'teamA.paymentDeadline': 1,
      'teamA.paymentStatus': 1,
    })
    .limit(100)
    .toArray();
  console.log('ALL live holds:', held.length);
  const now = Date.now();
  for (const h of held) {
    const due = h.holdExpiresAt || h.teamA?.paymentDeadline;
    console.log(
      JSON.stringify({
        id: String(h._id),
        field: String(h.field),
        status: h.status,
        start: h.startTime,
        end: h.endTime,
        hold: h.holdExpiresAt,
        created: h.createdAt,
        ppt: h.partialPaymentTimeoutAt,
        payA: h.teamA?.paymentStatus,
        softExpired: due ? new Date(due).getTime() <= now : 'no-due',
      })
    );
  }
  const stuck = await B.countDocuments({
    status: { $in: ['HELD', 'PAYMENT_PENDING'] },
    partialPaymentTimeoutAt: { $exists: true },
  });
  console.log('holds WITH partialPaymentTimeoutAt still live:', stuck);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
