/**
 * Price a field so the customer's TOTAL for the full match is a chosen amount (handy for payment
 * testing). The E-Garoon booking fee is added on top of the rent, so this works the rent backwards:
 * rent = total − fees. The same rules the real checkout uses (stadium agreement, else platform policy).
 *
 *   node scripts/set-field-price.js "<stadium name>" "<field name>" <total>            # preview
 *   node scripts/set-field-price.js "<stadium name>" "<field name>" <total> --apply    # save
 *
 * The output shows the previous values so you can restore them.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

const args = process.argv.slice(2).filter((a) => a !== '--apply');
const APPLY = process.argv.includes('--apply');
const [stadiumName, fieldName, priceRaw] = args;
const total = Number(priceRaw);
const round2 = (n) => Math.round(n * 100) / 100;

async function main() {
  if (!stadiumName || !fieldName || !(total > 0)) {
    throw new Error('Usage: node scripts/set-field-price.js "<stadium>" "<field>" <total> [--apply]');
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const stadiums = await db.collection('stadia').find({ name: new RegExp(`^${esc(stadiumName)}$`, 'i') }).toArray();
  if (stadiums.length !== 1) throw new Error(`Expected exactly one stadium named "${stadiumName}", found ${stadiums.length}`);
  const fields = await db
    .collection('fields')
    .find({ stadium: stadiums[0]._id, name: new RegExp(`^${esc(fieldName)}$`, 'i') })
    .toArray();
  if (fields.length !== 1) throw new Error(`Expected exactly one field named "${fieldName}", found ${fields.length}`);

  const f = fields[0];

  // Fees exactly as checkout computes them.
  const platformSettings = require('../src/services/platformSettings.service');
  const bookingFinance = require('../src/services/bookingFinance.service');
  await platformSettings.hydrate();
  let rules;
  try {
    ({ rules } = await bookingFinance.resolveRulesForStadium(stadiums[0]._id));
  } catch {
    rules = platformSettings.getBusiness(); // no accepted agreement yet: platform default fees
  }
  const feeFull = bookingFinance.feesForSide(rules, 'teamA', { coverFullMatch: true });
  const feeTeam = bookingFinance.feesForSide(rules, 'teamA', {});
  const rent = round2(total - feeFull);
  if (!(rent > 0)) throw new Error(`Total $${total} is not enough to cover the booking fees ($${feeFull}).`);

  const before = { pricingMode: f.pricingMode, pricePerPlayer: f.pricePerPlayer ?? null, fixedPrice: f.fixedPrice ?? null, currency: f.currency };
  console.log(`${stadiums[0].name} → ${f.name} (${f.type})`);
  console.log('  now   :', JSON.stringify(before));
  console.log('  after :', JSON.stringify({ ...before, pricingMode: 'fixed', fixedPrice: rent }));
  console.log(`\n  Full match : rent $${rent} + booking fees $${feeFull} = $${round2(rent + feeFull)}`);
  console.log(`  One team   : rent $${round2(rent / 2)} + booking fee $${feeTeam} = $${round2(rent / 2 + feeTeam)} each`);

  if (!APPLY) {
    console.log('\nPreview only. Re-run with --apply to save.');
    return;
  }
  await db.collection('fields').updateOne({ _id: f._id }, { $set: { pricingMode: 'fixed', fixedPrice: rent } });
  console.log('\nSaved.');
  console.log(`To restore later: pricingMode "${before.pricingMode}", pricePerPlayer ${before.pricePerPlayer}, fixedPrice ${before.fixedPrice}.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
