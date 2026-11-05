/**
 * Debug live bookings / overlap for a field. Does not print MONGO_URI.
 * Usage: node scripts/debug-field-holds.js [fieldId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const fieldId = process.argv[2] || '6a8c65a0c3d026350d30c9f4';
const LIVE = ['HELD', 'PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const Booking = mongoose.connection.collection('bookings');
  const blocks = mongoose.connection.collection('availabilityblocks');
  const oid = new mongoose.Types.ObjectId(fieldId);

  const all = await Booking.find({ field: oid })
    .project({
      status: 1,
      startTime: 1,
      endTime: 1,
      holdExpiresAt: 1,
      teamBPaymentDueAt: 1,
      partialPaymentTimeoutAt: 1,
      cancelReason: 1,
      createdAt: 1,
      'teamA.captain': 1,
      'teamA.paymentStatus': 1,
      'teamA.paymentDeadline': 1,
      coveredFullMatch: 1,
    })
    .sort({ startTime: 1 })
    .toArray();

  console.log('TOTAL bookings for field:', all.length);
  const byStatus = {};
  for (const b of all) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  console.log('byStatus', byStatus);

  const liveDocs = all.filter((b) => LIVE.includes(b.status));
  console.log('LIVE count:', liveDocs.length);
  for (const b of liveDocs) {
    console.log(
      JSON.stringify({
        id: String(b._id),
        status: b.status,
        start: b.startTime,
        end: b.endTime,
        holdExpiresAt: b.holdExpiresAt,
        teamBPaymentDueAt: b.teamBPaymentDueAt,
        partialPaymentTimeoutAt: b.partialPaymentTimeoutAt,
        teamADeadline: b.teamA?.paymentDeadline,
        payA: b.teamA?.paymentStatus,
        captain: String(b.teamA?.captain || ''),
        createdAt: b.createdAt,
        durationHrs: (new Date(b.endTime) - new Date(b.startTime)) / 3600000,
      })
    );
  }

  const wide = all.filter((b) => new Date(b.endTime) - new Date(b.startTime) > 6 * 3600000);
  console.log('WIDE (>6h) bookings:', wide.length);
  for (const b of wide.slice(0, 30)) {
    console.log('WIDE', b._id.toString(), b.status, b.startTime, b.endTime);
  }

  const ab = await blocks.find({ field: oid }).toArray();
  console.log('AvailabilityBlocks:', ab.length);
  for (const x of ab) {
    console.log(
      JSON.stringify({
        id: String(x._id),
        type: x.type,
        startsAt: x.startsAt,
        endsAt: x.endsAt,
        reason: x.reason,
      })
    );
  }

  console.log('count with string field:', await Booking.countDocuments({ field: fieldId }));

  const slots = [
    ['2026-08-26T06:00:00.000Z', '2026-08-26T07:00:00.000Z'],
    ['2026-08-26T08:00:00.000Z', '2026-08-26T09:00:00.000Z'],
    ['2026-08-31T13:00:00.000Z', '2026-08-31T14:00:00.000Z'],
  ];
  for (const [s, e] of slots) {
    const start = new Date(s);
    const end = new Date(e);
    const hits = await Booking.find({
      field: oid,
      startTime: { $lt: end },
      endTime: { $gt: start },
      status: { $in: LIVE },
    })
      .project({ status: 1, startTime: 1, endTime: 1, holdExpiresAt: 1, teamA: 1 })
      .toArray();
    console.log('OVERLAP', s, 'hits', hits.length);
    for (const h of hits) {
      console.log(
        ' ',
        String(h._id),
        h.status,
        h.startTime.toISOString(),
        h.endTime.toISOString(),
        'hold',
        h.holdExpiresAt,
        'captain',
        String(h.teamA?.captain || '')
      );
    }
  }

  console.log('INDEXES', JSON.stringify(await Booking.indexes(), null, 2));

  // Sample any HELD with future holdExpiresAt or missing
  const held = await Booking.find({ field: oid, status: { $in: ['HELD', 'PAYMENT_PENDING'] } })
    .project({ status: 1, startTime: 1, endTime: 1, holdExpiresAt: 1, createdAt: 1, partialPaymentTimeoutAt: 1 })
    .toArray();
  console.log('HELD/PAYMENT_PENDING raw:', held.length);
  for (const h of held) {
    console.log(
      JSON.stringify({
        id: String(h._id),
        status: h.status,
        start: h.startTime,
        end: h.endTime,
        holdExpiresAt: h.holdExpiresAt,
        createdAt: h.createdAt,
        partialPaymentTimeoutAt: h.partialPaymentTimeoutAt,
        softExpiredWould: h.holdExpiresAt
          ? new Date(h.holdExpiresAt).getTime() <= Date.now()
          : 'no-deadline',
      })
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
