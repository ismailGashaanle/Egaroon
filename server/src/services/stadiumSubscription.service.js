const Stadium = require('../models/Stadium');
const StadiumSubscriptionPeriod = require('../models/StadiumSubscriptionPeriod');
const ApiError = require('../utils/ApiError');
const { getBusiness } = require('./platformSettings.service');
const { SUBSCRIPTION_SCOPE } = require('../constants/revenue');
const { getActiveAgreement } = require('./bookingFinance.service');

const Field = require('../models/Field');
const Booking = require('../models/Booking');

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

function stadiumSubEnabled(biz = getBusiness()) {
  return Boolean(biz.stadiumSubscriptionEnabled);
}

async function rateForStadium(stadiumId, biz = getBusiness()) {
  const activeFieldsCount = await Field.countDocuments({
    stadium: stadiumId,
    status: { $ne: 'inactive' },
  });
  const fieldsCount = Math.max(1, activeFieldsCount);

  const agreement = await getActiveAgreement(stadiumId);
  const baseRate =
    agreement?.rules?.subscriptionAmount != null
      ? Number(agreement.rules.subscriptionAmount)
      : Number(biz.fieldSubscriptionAmount ?? biz.stadiumSubscriptionAmount ?? 7);

  const ratePerField = moneyRound(baseRate);
  const currency =
    agreement?.rules?.subscriptionCurrency ||
    biz.fieldSubscriptionCurrency ||
    biz.stadiumSubscriptionCurrency ||
    'USD';

  // Dynamic formula: fieldsCount * ratePerField (e.g. 3 fields * $7 = $21)
  const totalDue = moneyRound(fieldsCount * ratePerField);

  if (agreement && agreement.rules?.subscriptionEnabled === false) {
    return { enabled: false, amount: 0, fieldsCount, ratePerField, currency, agreementId: agreement._id };
  }
  return {
    enabled: stadiumSubEnabled(biz),
    amount: totalDue,
    fieldsCount,
    ratePerField,
    currency,
    agreementId: agreement?._id || null,
  };
}

async function tryAutoDeductSubscription(stadiumDoc, periodDoc) {
  const stadium = typeof stadiumDoc === 'object' && stadiumDoc?._id ? stadiumDoc : await Stadium.findById(stadiumDoc);
  if (!stadium || !stadium.subscriptionAutoDeduct) return false;

  const due = moneyRound(Number(periodDoc.amountDue || 0) - Number(periodDoc.amountPaid || 0));
  if (due <= 0) return true;

  // Calculate available settled match earnings
  const settled = await Booking.find({
    stadium: stadium._id,
    status: 'SETTLED',
  }).select('ownerPayoutAmount');
  const totalEarnings = settled.reduce((sum, b) => sum + (b.ownerPayoutAmount || 0), 0);

  // Minus past auto-deductions
  const prevPeriods = await StadiumSubscriptionPeriod.find({
    stadium: stadium._id,
    payMethod: 'auto_deduct',
    _id: { $ne: periodDoc._id },
    status: 'paid',
  }).select('amountPaid');
  const previouslyDeducted = prevPeriods.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  const availableBalance = moneyRound(Math.max(0, totalEarnings - previouslyDeducted));
  if (availableBalance >= due) {
    periodDoc.amountPaid = periodDoc.amountDue;
    periodDoc.status = 'paid';
    periodDoc.payMethod = 'auto_deduct';
    periodDoc.paidAt = new Date();
    periodDoc.notes = `Si toos ah looga jaray dakhliga garoonka ($${due} USD)`;
    await periodDoc.save();
    return true;
  }
  return false;
}

async function ensurePeriodsForRange(from, to) {
  const biz = getBusiness();
  if (!stadiumSubEnabled(biz) && !biz.stadiumSubscriptionEnabled) {
    return { enabled: false, created: 0 };
  }
  const stadiums = await Stadium.find({ status: { $in: ['approved'] } })
    .select('_id createdAt subscriptionAutoDeduct')
    .lean();
  const months = listYearMonths(from, to);
  let created = 0;

  for (const stadium of stadiums) {
    const rate = await rateForStadium(stadium._id, biz);
    if (!rate.enabled) continue;
    const createdAt = stadium.createdAt ? new Date(stadium.createdAt) : null;
    for (const { year, month } of months) {
      if (createdAt && createdAt > endOfMonthUtc(year, month)) continue;
      const existing = await StadiumSubscriptionPeriod.findOne({ stadium: stadium._id, year, month });
      if (existing) {
        if (existing.status === 'owed' && existing.amountPaid === 0) {
          existing.amountDue = rate.amount;
          existing.fieldsCount = rate.fieldsCount;
          existing.ratePerField = rate.ratePerField;
          existing.currency = rate.currency;
          existing.agreement = rate.agreementId || existing.agreement;
          await existing.save();
        }
        continue;
      }
      const period = await StadiumSubscriptionPeriod.create({
        stadium: stadium._id,
        year,
        month,
        amountDue: rate.amount,
        amountPaid: 0,
        fieldsCount: rate.fieldsCount,
        ratePerField: rate.ratePerField,
        currency: rate.currency,
        status: 'owed',
        agreement: rate.agreementId || undefined,
      });
      created += 1;

      // Check auto-deduction if enabled
      if (stadium.subscriptionAutoDeduct) {
        await tryAutoDeductSubscription(stadium, period);
      }
    }
  }
  return { enabled: true, created };
}

async function listSubscriptions(query = {}) {
  const filter = {};
  if (query.stadiumId) filter.stadium = query.stadiumId;
  if (query.status) filter.status = query.status;
  if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
  if (query.year) filter.year = Number(query.year);
  if (query.month) filter.month = Number(query.month);
  const rows = await StadiumSubscriptionPeriod.find(filter)
    .sort({ year: -1, month: -1 })
    .limit(1000)
    .populate('stadium', 'name owner')
    .lean();
  return rows.map((r) => ({
    id: r._id,
    scope: 'stadium',
    stadiumId: r.stadium?._id || r.stadium,
    stadiumName: r.stadium?.name,
    ownerId: r.stadium?.owner,
    year: r.year,
    month: r.month,
    fieldsCount: r.fieldsCount || 1,
    ratePerField: r.ratePerField || 7,
    amountDue: r.amountDue,
    amountPaid: r.amountPaid,
    currency: r.currency,
    status: r.status,
    approvalStatus: r.approvalStatus || 'none',
    approvalSubmittedAt: r.approvalSubmittedAt,
    approvalNotes: r.approvalNotes,
    paymentReference: r.paymentReference,
    payMethod: r.payMethod,
    paidAt: r.paidAt,
    notes: r.notes,
  }));
}

async function markPeriod(periodId, actorId, patch) {
  const row = await StadiumSubscriptionPeriod.findById(periodId);
  if (!row) throw ApiError.notFound('Stadium subscription period not found');
  if (patch.amountPaid != null) row.amountPaid = moneyRound(patch.amountPaid);
  if (patch.amountDue != null) row.amountDue = moneyRound(patch.amountDue);
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.status === 'waived') row.status = 'waived';
  else if (patch.status) row.status = deriveStatus(row.amountDue, row.amountPaid, patch.status);
  else row.status = deriveStatus(row.amountDue, row.amountPaid, row.status);
  if (row.status === 'paid' || Number(row.amountPaid) > 0) {
    row.paidAt = patch.paidAt ? new Date(patch.paidAt) : row.paidAt || new Date();
  }
  row.markedBy = actorId;
  await row.save();
  return row;
}

async function aggregateSubscriptionRevenue(from, to, { stadiumIds } = {}) {
  const biz = getBusiness();
  const months = listYearMonths(from, to);
  const empty = {
    enabled: stadiumSubEnabled(biz),
    owedCents: 0,
    paidCents: 0,
    waivedCents: 0,
    byStadium: {},
    byField: {},
    byMonth: {},
    rate: moneyRound(biz.stadiumSubscriptionAmount ?? 7),
    currency: biz.stadiumSubscriptionCurrency || 'USD',
  };
  if (!months.length) return empty;
  if (stadiumSubEnabled(biz)) {
    await ensurePeriodsForRange(from, to);
  }
  const filter = { $or: months.map(({ year, month }) => ({ year, month })) };
  if (stadiumIds?.length) filter.stadium = { $in: stadiumIds };
  const rows = await StadiumSubscriptionPeriod.find(filter).populate('stadium', 'name').lean();

  let owedCents = 0;
  let paidCents = 0;
  let waivedCents = 0;
  const byStadium = {};
  const byMonth = {};
  for (const r of rows) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const dueC = Math.round(Number(r.amountDue || 0) * 100);
    const paidC = Math.round(Number(r.amountPaid || 0) * 100);
    if (r.status === 'waived') waivedCents += dueC;
    else {
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
  }
  return { ...empty, owedCents, paidCents, waivedCents, byStadium, byMonth };
}

async function checkStadiumSubscriptionStatus(stadiumId, now = new Date()) {
  const biz = getBusiness();
  const defaultRes = {
    isLocked: false,
    isGracePeriod: false,
    graceDaysLeft: 0,
    owedAmount: 0,
    currency: biz.stadiumSubscriptionCurrency || 'USD',
    reason: null,
    messageSo: null,
    messageEn: null,
  };

  if (!biz.stadiumSubscriptionEnabled && !stadiumSubEnabled(biz)) {
    return defaultRes;
  }

  const eat = new Date(now.getTime() + 3 * 3600 * 1000);
  const curY = eat.getUTCFullYear();
  const curM = eat.getUTCMonth() + 1;
  const dayOfMonth = eat.getUTCDate();

  const from = new Date(Date.UTC(curY, curM - 2, 1));
  const to = new Date(Date.UTC(curY, curM, 1));
  await ensurePeriodsForRange(from, to);

  const periods = await StadiumSubscriptionPeriod.find({
    stadium: stadiumId,
    $or: [{ year: { $lt: curY } }, { year: curY, month: { $lte: curM } }],
  })
    .sort({ year: 1, month: 1 })
    .lean();

  if (!periods.length) return defaultRes;

  const pastUnpaid = periods.filter(
    (p) =>
      (p.year < curY || (p.year === curY && p.month < curM)) &&
      (p.status === 'owed' || p.status === 'partial')
  );

  if (pastUnpaid.length > 0) {
    // If pending approval, do not lock
    const pendingApproval = pastUnpaid.some((p) => p.approvalStatus === 'pending_approval');
    const totalOwed = moneyRound(
      pastUnpaid.reduce((sum, p) => sum + (Number(p.amountDue || 0) - Number(p.amountPaid || 0)), 0)
    );
    const locked = !pendingApproval && biz.subscriptionAutoLockEnabled !== false;
    return {
      isLocked: locked,
      isGracePeriod: false,
      graceDaysLeft: 0,
      owedAmount: totalOwed,
      fieldsCount: pastUnpaid[0].fieldsCount || 1,
      ratePerField: pastUnpaid[0].ratePerField || 7,
      periodId: pastUnpaid[0]._id,
      approvalStatus: pastUnpaid[0].approvalStatus || 'none',
      currency: pastUnpaid[0].currency || 'USD',
      reason: 'PAST_MONTH_OVERDUE',
      messageSo: pendingApproval
        ? `Caddeyntaada lacag bixinta ($${totalOwed}) waxay sugaysaa xaqiijinta Super Admin-ka.`
        : `Garoonku wuu xidhan yahay maadaama subscription-kii bilaha hore ($${totalOwed}) aan la bixin.`,
      messageEn: `Stadium is locked because past monthly subscription ($${totalOwed}) is overdue and unpaid.`,
    };
  }

  const curPeriod = periods.find((p) => p.year === curY && p.month === curM);
  if (curPeriod && (curPeriod.status === 'owed' || curPeriod.status === 'partial')) {
    const due = moneyRound(Number(curPeriod.amountDue || 0) - Number(curPeriod.amountPaid || 0));
    const graceDays = Math.max(0, Number(biz.subscriptionGraceDays ?? 4));

    if (dayOfMonth <= graceDays) {
      const graceDaysLeft = graceDays - dayOfMonth + 1;
      return {
        isLocked: false,
        isGracePeriod: true,
        graceDaysLeft,
        owedAmount: due,
        fieldsCount: curPeriod.fieldsCount || 1,
        ratePerField: curPeriod.ratePerField || 7,
        periodId: curPeriod._id,
        approvalStatus: curPeriod.approvalStatus || 'none',
        currency: curPeriod.currency || 'USD',
        reason: 'GRACE_PERIOD',
        messageSo: `Digniin: Waxaa kuu hadhay ${graceDaysLeft} maalmood oo bilaash ah (Grace Period) inaad bixiso subscription-ka $${due} ee bishan (${curPeriod.fieldsCount || 1} garoon x $${curPeriod.ratePerField || 7}).`,
        messageEn: `Notice: You have ${graceDaysLeft} day(s) left in your grace period to pay the $${due} subscription for this month.`,
      };
    }

    const pendingApproval = curPeriod.approvalStatus === 'pending_approval';
    const locked = !pendingApproval && biz.subscriptionAutoLockEnabled !== false;
    return {
      isLocked: locked,
      isGracePeriod: false,
      graceDaysLeft: 0,
      owedAmount: due,
      fieldsCount: curPeriod.fieldsCount || 1,
      ratePerField: curPeriod.ratePerField || 7,
      periodId: curPeriod._id,
      approvalStatus: curPeriod.approvalStatus || 'none',
      currency: curPeriod.currency || 'USD',
      reason: 'GRACE_EXPIRED',
      messageSo: pendingApproval
        ? `Caddeyntaada lacag bixinta ($${due}) waxay sugaysaa xaqiijinta Super Admin-ka si garoonka dib loogu furo.`
        : `Garoonku wuu xidhan yahay maadaama subscription-ka bishan ($${due}) aan la bixin kadib xilligii bilaashka ahaa (${graceDays} maalmood).`,
      messageEn: `Stadium is locked because monthly subscription ($${due}) was not paid within the ${graceDays}-day grace period.`,
    };
  }

  return defaultRes;
}

async function checkOwnerSubscriptionLockout(userId) {
  const biz = getBusiness();
  if (!biz.stadiumSubscriptionEnabled || biz.subscriptionBlockOwnerLogin === false) {
    return { locked: false };
  }
  const stadiums = await Stadium.find({ owner: userId }).select('_id name');
  if (!stadiums.length) return { locked: false };

  for (const st of stadiums) {
    const status = await checkStadiumSubscriptionStatus(st._id);
    if (status.isLocked) {
      const rate = biz.sllPerUsd || 8500;
      return {
        locked: true,
        stadiumId: st._id,
        stadiumName: st.name,
        fieldsCount: status.fieldsCount || 1,
        ratePerField: status.ratePerField || 7,
        amountDueUsd: status.owedAmount,
        amountDueSll: Math.round(Number(status.owedAmount) * rate),
        sllPerUsd: rate,
        currency: status.currency || 'USD',
        reason: status.reason,
        periodId: status.periodId,
        approvalStatus: status.approvalStatus || 'none',
        messageSo: status.messageSo,
        messageEn: status.messageEn,
      };
    }
  }
  return { locked: false };
}

async function paySubscriptionViaMobileMoney({ periodId, operator, phone, payCurrency, actorId }) {
  const period = await StadiumSubscriptionPeriod.findById(periodId).populate('stadium', 'name owner');
  if (!period) throw ApiError.notFound('Subscription period not found');
  if (period.status === 'paid' || period.status === 'waived') {
    throw ApiError.badRequest('Subscription is already paid or waived');
  }

  const biz = getBusiness();
  const rate = biz.sllPerUsd || 8500;
  const isSll = payCurrency === 'SLL';
  const amountUsd = moneyRound(period.amountDue - period.amountPaid);
  const amountSll = Math.round(amountUsd * rate);
  const chargeAmount = isSll ? amountSll : amountUsd;
  const currency = isSll ? 'SLL' : 'USD';

  const { getPaymentProvider } = require('../providers/payment');
  const provider = getPaymentProvider(undefined, { operator });

  const intent = await provider.initiate({
    amount: chargeAmount,
    currency,
    phone,
    operator,
    metadata: {
      type: 'stadium_subscription',
      periodId: period._id.toString(),
      stadiumId: period.stadium._id.toString(),
      amountUsd,
      amountSll,
    },
  });

  period.amountPaid = period.amountDue;
  period.paidAmountUsd = amountUsd;
  period.paidAmountSll = amountSll;
  period.payCurrency = currency;
  period.status = 'paid';
  period.payMethod = 'mobile_money';
  period.paidAt = new Date();
  period.paymentReference = intent.providerReference || `sub-${Date.now()}`;
  period.approvalStatus = 'approved';
  period.notes = `Kaga bixiyey ${operator} (${chargeAmount} ${currency}) - Ref: ${period.paymentReference}`;
  await period.save();

  return {
    success: true,
    period,
    intent,
    messageSo: `Lacag-bixintii subscription-ka ($${amountUsd} USD / ${amountSll} SlSh) waa lagu guuleystay. Garoonku hadda waa furan yahay!`,
  };
}

async function submitSubscriptionProof({ periodId, paymentReference, notes, actorId }) {
  const period = await StadiumSubscriptionPeriod.findById(periodId).populate('stadium', 'name');
  if (!period) throw ApiError.notFound('Subscription period not found');

  period.approvalStatus = 'pending_approval';
  period.approvalSubmittedAt = new Date();
  period.paymentReference = paymentReference;
  period.approvalNotes = notes || 'Mulkiilaha ayaa soo gudbiyey caddeyn lacag bixin';
  period.payMethod = 'manual';
  await period.save();

  return {
    success: true,
    period,
    messageSo: 'Caddeyntaada lacag bixinta waa la gudbiyey. Super Admin-ka ayaa xaqiijin doona si garoonkaagu dib ugu furmo.',
  };
}

async function approveSubscriptionBySuperAdmin({ periodId, adminId, notes }) {
  const period = await StadiumSubscriptionPeriod.findById(periodId).populate('stadium', 'name');
  if (!period) throw ApiError.notFound('Subscription period not found');

  period.amountPaid = period.amountDue;
  period.status = 'paid';
  period.approvalStatus = 'approved';
  period.markedBy = adminId;
  period.paidAt = new Date();
  if (notes) period.notes = notes;
  await period.save();

  return {
    success: true,
    period,
    messageSo: `Subscription-ka garoonka "${period.stadium?.name}" waa la aqbalay, garoonkiina dib ayaa loo furay.`,
  };
}

async function assertStadiumSubscriptionActive(stadiumId, now = new Date()) {
  const status = await checkStadiumSubscriptionStatus(stadiumId, now);
  if (status.isLocked) {
    throw ApiError.conflict(status.messageSo || 'Garoonkan wuu xidhan yahay subscription darted', {
      code: 'STADIUM_SUBSCRIPTION_LOCKED',
      ...status,
    });
  }
  return status;
}

module.exports = {
  ensurePeriodsForRange,
  listSubscriptions,
  markPeriod,
  aggregateSubscriptionRevenue,
  listYearMonths,
  moneyRound,
  rateForStadium,
  checkStadiumSubscriptionStatus,
  assertStadiumSubscriptionActive,
  checkOwnerSubscriptionLockout,
  paySubscriptionViaMobileMoney,
  submitSubscriptionProof,
  approveSubscriptionBySuperAdmin,
  tryAutoDeductSubscription,
};
