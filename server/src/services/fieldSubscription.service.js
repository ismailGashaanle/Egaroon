const Field = require('../models/Field');
const Stadium = require('../models/Stadium');
const FieldSubscriptionPeriod = require('../models/FieldSubscriptionPeriod');
const ApiError = require('../utils/ApiError');
const { getBusiness } = require('./platformSettings.service');

function moneyRound(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function deriveStatus(amountDue, amountPaid, explicit) {
  if (explicit === 'waived') return 'waived';
  const due = Number(amountDue || 0);
  const paid = Number(amountPaid || 0);
  if (paid <= 0) return 'owed';
  if (paid + 0.001 >= due) return 'paid';
  return 'partial';
}

/**
 * Ensure FieldSubscriptionPeriod rows exist for every active field for each
 * calendar month overlapping [from, to]. Does not invent paid amounts.
 */
async function ensurePeriodsForRange(from, to) {
  const biz = getBusiness();
  if (!biz.fieldSubscriptionEnabled) {
    return { enabled: false, created: 0, amount: 0 };
  }
  const amount = moneyRound(biz.fieldSubscriptionAmount);
  const currency = biz.fieldSubscriptionCurrency || 'USD';

  const fields = await Field.find({ status: 'active' }).select('_id stadium createdAt').lean();
  const months = listYearMonths(from, to);
  let created = 0;

  for (const field of fields) {
    const fieldCreated = field.createdAt ? new Date(field.createdAt) : null;
    for (const { year, month } of months) {
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      if (fieldCreated && fieldCreated > endOfMonthUtc(year, month)) continue;

      const existing = await FieldSubscriptionPeriod.findOne({ field: field._id, year, month });
      if (existing) {
        // Keep owed amount in sync with current policy when still unpaid
        if (existing.status === 'owed' && existing.amountPaid === 0 && existing.amountDue !== amount) {
          existing.amountDue = amount;
          existing.currency = currency;
          await existing.save();
        }
        continue;
      }

      await FieldSubscriptionPeriod.create({
        field: field._id,
        stadium: field.stadium,
        year,
        month,
        amountDue: amount,
        amountPaid: 0,
        currency,
        status: 'owed',
      });
      created += 1;
    }
  }

  return { enabled: true, created, amount, currency };
}

function endOfMonthUtc(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function listYearMonths(from, to) {
  const out = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1;
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

async function listSubscriptions(query = {}) {
  const filter = {};
  if (query.stadiumId) filter.stadium = query.stadiumId;
  if (query.fieldId) filter.field = query.fieldId;
  if (query.status) filter.status = query.status;
  if (query.year) filter.year = Number(query.year);
  if (query.month) filter.month = Number(query.month);

  const rows = await FieldSubscriptionPeriod.find(filter)
    .sort({ year: -1, month: -1 })
    .limit(1000)
    .populate('field', 'name status')
    .populate('stadium', 'name')
    .lean();

  return rows.map((r) => ({
    id: r._id,
    fieldId: r.field?._id || r.field,
    fieldName: r.field?.name,
    stadiumId: r.stadium?._id || r.stadium,
    stadiumName: r.stadium?.name,
    year: r.year,
    month: r.month,
    amountDue: r.amountDue,
    amountPaid: r.amountPaid,
    currency: r.currency,
    status: r.status,
    paidAt: r.paidAt,
    notes: r.notes,
  }));
}

async function markPeriod(periodId, actorId, patch) {
  const row = await FieldSubscriptionPeriod.findById(periodId);
  if (!row) throw ApiError.notFound('Subscription period not found');

  if (patch.amountPaid != null) row.amountPaid = moneyRound(patch.amountPaid);
  if (patch.amountDue != null) row.amountDue = moneyRound(patch.amountDue);
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.status === 'waived') {
    row.status = 'waived';
  } else if (patch.status) {
    row.status = deriveStatus(row.amountDue, row.amountPaid, patch.status);
  } else {
    row.status = deriveStatus(row.amountDue, row.amountPaid, row.status);
  }
  if (row.status === 'paid' || Number(row.amountPaid) > 0) {
    row.paidAt = patch.paidAt ? new Date(patch.paidAt) : row.paidAt || new Date();
  }
  row.markedBy = actorId;
  await row.save();
  return row;
}

/**
 * Aggregate subscription revenue for a date range.
 * Obligation attributed to the month; paid attributed when status paid/partial.
 */
async function aggregateSubscriptionRevenue(from, to, { stadiumIds } = {}) {
  const biz = getBusiness();
  const months = listYearMonths(from, to);
  if (!months.length) {
    return {
      enabled: Boolean(biz.fieldSubscriptionEnabled),
      owedCents: 0,
      paidCents: 0,
      waivedCents: 0,
      byStadium: {},
      byField: {},
      byMonth: {},
    };
  }

  if (biz.fieldSubscriptionEnabled) {
    await ensurePeriodsForRange(from, to);
  }

  const orMonths = months.map(({ year, month }) => ({ year, month }));
  const filter = { $or: orMonths };
  if (stadiumIds?.length) {
    filter.stadium = { $in: stadiumIds };
  }
  const rows = await FieldSubscriptionPeriod.find(filter)
    .populate('field', 'name')
    .populate('stadium', 'name')
    .lean();

  let owedCents = 0;
  let paidCents = 0;
  let waivedCents = 0;
  const byStadium = {};
  const byField = {};
  const byMonth = {};

  for (const r of rows) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const dueC = Math.round(Number(r.amountDue || 0) * 100);
    const paidC = Math.round(Number(r.amountPaid || 0) * 100);
    if (r.status === 'waived') {
      waivedCents += dueC;
    } else {
      owedCents += dueC;
      paidCents += paidC;
    }

    if (!byMonth[key]) byMonth[key] = { owedCents: 0, paidCents: 0 };
    byMonth[key].owedCents += r.status === 'waived' ? 0 : dueC;
    byMonth[key].paidCents += r.status === 'waived' ? 0 : paidC;

    const sid = String(r.stadium?._id || r.stadium);
    const sName = r.stadium?.name || sid;
    if (!byStadium[sid]) byStadium[sid] = { stadiumId: sid, stadiumName: sName, owedCents: 0, paidCents: 0 };
    byStadium[sid].owedCents += r.status === 'waived' ? 0 : dueC;
    byStadium[sid].paidCents += r.status === 'waived' ? 0 : paidC;

    const fid = String(r.field?._id || r.field);
    const fName = r.field?.name || fid;
    if (!byField[fid]) {
      byField[fid] = { fieldId: fid, fieldName: fName, stadiumId: sid, stadiumName: sName, owedCents: 0, paidCents: 0 };
    }
    byField[fid].owedCents += r.status === 'waived' ? 0 : dueC;
    byField[fid].paidCents += r.status === 'waived' ? 0 : paidC;
  }

  return {
    enabled: Boolean(biz.fieldSubscriptionEnabled),
    rate: moneyRound(biz.fieldSubscriptionAmount),
    currency: biz.fieldSubscriptionCurrency || 'USD',
    owedCents,
    paidCents,
    waivedCents,
    byStadium,
    byField,
    byMonth,
  };
}

module.exports = {
  ensurePeriodsForRange,
  listSubscriptions,
  markPeriod,
  aggregateSubscriptionRevenue,
  listYearMonths,
  moneyRound,
};
