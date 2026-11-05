const RevenueLedger = require('../models/RevenueLedger');
const { LEDGER_TYPES } = require('../constants/revenue');

async function postEntry({
  type,
  booking,
  stadium,
  agreement,
  amount,
  currency = 'USD',
  party,
  status = 'posted',
  note,
  meta,
  idempotencyKey,
}) {
  if (idempotencyKey) {
    const existing = await RevenueLedger.findOne({ idempotencyKey });
    if (existing) return existing;
  }
  return RevenueLedger.create({
    type,
    booking,
    stadium,
    agreement,
    amount,
    currency,
    party,
    status,
    note,
    meta,
    idempotencyKey,
  });
}

async function postSettlementBreakdown({ booking, stadiumId, agreementId, rentAmount, commissionAmount, bookingFeeAmount }) {
  const entries = [];
  if (Number(bookingFeeAmount) > 0) {
    entries.push(
      await postEntry({
        type: LEDGER_TYPES.BOOKING_FEE,
        booking,
        stadium: stadiumId,
        agreement: agreementId,
        amount: bookingFeeAmount,
        party: 'platform',
        note: 'Team booking fee (E-Garoon)',
        idempotencyKey: `booking_fee:${booking}`,
      })
    );
  }
  if (Number(commissionAmount) > 0) {
    entries.push(
      await postEntry({
        type: LEDGER_TYPES.COMMISSION,
        booking,
        stadium: stadiumId,
        agreement: agreementId,
        amount: commissionAmount,
        party: 'platform',
        note: 'Commission on stadium rent',
        idempotencyKey: `commission:${booking}`,
      })
    );
  }
  const ownerRent = Math.round((Number(rentAmount || 0) - Number(commissionAmount || 0)) * 100) / 100;
  if (ownerRent > 0) {
    entries.push(
      await postEntry({
        type: LEDGER_TYPES.OWNER_RENT,
        booking,
        stadium: stadiumId,
        agreement: agreementId,
        amount: ownerRent,
        party: 'stadium_owner',
        note: 'Stadium rent due to owner',
        idempotencyKey: `owner_rent:${booking}`,
      })
    );
  }
  return entries;
}

async function summarize({ stadiumId, from, to } = {}) {
  const filter = { status: 'posted' };
  if (stadiumId) filter.stadium = stadiumId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  const rows = await RevenueLedger.aggregate([
    { $match: filter },
    { $group: { _id: { type: '$type', party: '$party' }, amount: { $sum: '$amount' } } },
  ]);
  const out = { platform: { booking_fee: 0, commission: 0, subscription: 0 }, stadium_owner: { owner_rent: 0 } };
  for (const r of rows) {
    const party = r._id.party;
    const type = r._id.type;
    if (!out[party]) out[party] = {};
    out[party][type] = Math.round(Number(r.amount || 0) * 100) / 100;
  }
  return out;
}

module.exports = { postEntry, postSettlementBreakdown, summarize, LEDGER_TYPES };
