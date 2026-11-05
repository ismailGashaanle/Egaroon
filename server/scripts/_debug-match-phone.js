/* one-off debug: match code phone snapshot */
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const m = env.match(/^MONGO_URI=(.*)$/m);
const uri = m && m[1] ? m[1].trim().replace(/^["']|["']$/g, '') : null;
if (!uri) {
  console.error('NO_URI');
  process.exit(1);
}

const mongoose = require('mongoose');
const sp = require('../src/utils/somaliPhone');

(async () => {
  await mongoose.connect(uri);
  const b = await mongoose.connection.collection('bookings').findOne({ matchCode: 'SG-CRM9-QZHT' });
  if (!b) {
    console.log('BOOKING_NOT_FOUND');
    await mongoose.disconnect();
    return;
  }
  console.log(
    JSON.stringify(
      {
        id: String(b._id),
        matchCode: b.matchCode,
        teamAPayerPhone: b.teamAPayerPhone,
        invitePhone: b.invitePhone,
        teamACaptain: b.teamA && b.teamA.captain,
        status: b.status,
      },
      null,
      2
    )
  );
  const pays = await mongoose.connection
    .collection('payments')
    .find({ booking: b._id, side: 'teamA' })
    .project({ payerPhone: 1, msisdn: 1, status: 1, operator: 1, paidAt: 1 })
    .sort({ paidAt: -1 })
    .limit(5)
    .toArray();
  console.log('payments', JSON.stringify(pays, null, 2));
  if (b.teamA && b.teamA.captain) {
    const u = await mongoose.connection
      .collection('users')
      .findOne({ _id: b.teamA.captain }, { projection: { phone: 1, name: 1 } });
    console.log('captain', JSON.stringify(u));
  }
  const expected = [b.teamAPayerPhone].filter(Boolean);
  console.log('formatDisplay payer', sp.formatDisplay(b.teamAPayerPhone));
  console.log('normalize payer', sp.normalizeSomaliPhone(b.teamAPayerPhone));
  console.log('match body 7856383', sp.phoneMatchesAny('7856383', expected, { carrierId: 'telesom' }));
  console.log('match 0637856383', sp.phoneMatchesAny('0637856383', expected));
  console.log('match full 383', sp.phoneMatchesAny('+252637856383', expected));
  console.log('match 0637856838', sp.phoneMatchesAny('0637856838', expected));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
