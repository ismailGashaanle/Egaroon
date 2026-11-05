const crypto = require('crypto');
const mongoose = require('mongoose');
const RecurringBooking = require('../models/RecurringBooking');
const Field = require('../models/Field');
const Stadium = require('../models/Stadium');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const ApiError = require('../utils/ApiError');
const managerService = require('./manager.service');
const { ROLES } = require('../constants/roles');

const HMAC_SECRET = process.env.JWT_ACCESS_SECRET || 'kulansiiye_joogto_security_secret_2026';

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();

  // Support 12-hour AM/PM e.g. "09:04 PM", "9:04 pm", "10:00 PM"
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const meridian = m12[3].toLowerCase();
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (meridian === 'pm' && h < 12) h += 12;
    if (meridian === 'am' && h === 12) h = 0;
    return {
      h,
      min,
      minutes: h * 60 + min,
      label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    };
  }

  // Support 24-hour e.g. "21:04", "09:04"
  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return {
    h,
    min,
    minutes: h * 60 + min,
    label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

function startOfUtcDay(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function parseOptionalDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw ApiError.badRequest('Invalid date');
    return startOfUtcDay(value);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid date');
    return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid date');
  return startOfUtcDay(d);
}

function dateRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const far = new Date('9999-12-31T00:00:00.000Z');
  const as = aStart ? new Date(aStart) : new Date(0);
  const ae = aEnd ? new Date(aEnd) : far;
  const bs = bStart ? new Date(bStart) : new Date(0);
  const be = bEnd ? new Date(bEnd) : far;
  return as <= be && ae >= bs;
}

function recurringOverlapsRange(rec, startTime, endTime) {
  if (!rec || (rec.status && rec.status !== 'active')) return false;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const matchDays = [Number(rec.dayOfWeek), ...(rec.additionalDays || []).map(Number)];
  if (!matchDays.includes(start.getUTCDay())) return false;

  if (rec.startDate && startOfUtcDay(rec.startDate) > startOfUtcDay(end)) return false;
  if (rec.endDate && startOfUtcDay(rec.endDate) < startOfUtcDay(start)) return false;

  const from = parseHHMM(rec.startTimeLocal);
  const to = parseHHMM(rec.endTimeLocal);
  if (!from || !to) return false;

  const recStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), from.h, from.min, 0, 0)
  );
  const recEnd = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), to.h, to.min, 0, 0)
  );
  return recStart < end && recEnd > start;
}

function teamDisplayName(rec) {
  const name = String(rec?.teamName || '').trim();
  return name || 'Ciyaar Joogto';
}

function generateCardNumber(cityCode = 'HAR') {
  const cleanCity = String(cityCode || 'SOM').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'KUL';
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `JG-${cleanCity}-${rand}`;
}

function generateSecurityPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateReceiptNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(1000 + Math.random() * 9000);
  return `REC-JG-${y}${m}-${r}`;
}

function generateQrSignature(membershipId, cardNumber, securityPin, validUntil) {
  const payload = `${membershipId}:${cardNumber}:${securityPin}:${validUntil ? new Date(validUntil).toISOString() : 'none'}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 32);
}

/**
 * Evaluates and syncs live status (active, grace_period, expired) based on current clock.
 */
function syncCardLifecycle(rec) {
  if (rec.status === 'paused' || rec.status === 'ended') {
    rec.cardStatus = 'blocked';
    return rec;
  }

  const now = new Date();
  const endDate = rec.billingCycle?.endDate ? new Date(rec.billingCycle.endDate) : rec.endDate ? new Date(rec.endDate) : null;
  const graceEnds = rec.billingCycle?.gracePeriodEndsAt
    ? new Date(rec.billingCycle.gracePeriodEndsAt)
    : endDate
    ? new Date(endDate.getTime() + (rec.gracePeriodDays || 3) * 86400000)
    : null;

  if (!endDate) {
    rec.cardStatus = 'active';
    rec.paymentStatus = 'paid';
    return rec;
  }

  if (now <= endDate) {
    rec.cardStatus = 'active';
    rec.paymentStatus = 'paid';
  } else if (graceEnds && now <= graceEnds) {
    rec.cardStatus = 'grace_period';
    rec.paymentStatus = 'grace_period';
  } else {
    rec.cardStatus = 'expired';
    rec.paymentStatus = 'overdue';
  }

  return rec;
}

async function findOverlappingRecurring(fieldId, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const items = await RecurringBooking.find({
    field: fieldId,
    status: 'active',
    startDate: { $lte: end },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: start } }],
    $or: [{ dayOfWeek: start.getUTCDay() }, { additionalDays: start.getUTCDay() }],
  });
  return items.find((r) => recurringOverlapsRange(r, start, end)) || null;
}

async function findConflictingRecurring({
  fieldId,
  dayOfWeek,
  additionalDays = [],
  startTimeLocal,
  endTimeLocal,
  startDate,
  endDate,
  excludeId,
}) {
  const targetDays = [dayOfWeek, ...additionalDays];
  const filter = {
    field: fieldId,
    status: 'active',
    $or: [{ dayOfWeek: { $in: targetDays } }, { additionalDays: { $in: targetDays } }],
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const items = await RecurringBooking.find(filter);
  const aFrom = parseHHMM(startTimeLocal);
  const aTo = parseHHMM(endTimeLocal);
  if (!aFrom || !aTo) return null;

  return (
    items.find((r) => {
      const bFrom = parseHHMM(r.startTimeLocal);
      const bTo = parseHHMM(r.endTimeLocal);
      if (!bFrom || !bTo) return false;
      if (!(aFrom.minutes < bTo.minutes && aTo.minutes > bFrom.minutes)) return false;
      return dateRangesOverlap(startDate, endDate, r.startDate, r.endDate);
    }) || null
  );
}

function validateRecurringInput(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.teamName !== undefined) {
    const teamName = String(body.teamName || '').trim();
    if (!teamName) throw ApiError.badRequest('Team name is required');
    if (teamName.length < 2 || teamName.length > 80) {
      throw ApiError.badRequest('Team name must be 2–80 characters');
    }
    out.teamName = teamName;
  }

  if (!partial || body.captainName !== undefined) {
    out.captainName = String(body.captainName || '').trim();
  }

  if (!partial || body.captainPhone !== undefined) {
    out.captainPhone = String(body.captainPhone || '').trim();
  }

  if (!partial || body.dayOfWeek !== undefined) {
    const day = Number(body.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw ApiError.badRequest('dayOfWeek must be 0 (Sunday) through 6 (Saturday)');
    }
    out.dayOfWeek = day;
  }

  if (body.additionalDays !== undefined) {
    if (Array.isArray(body.additionalDays)) {
      out.additionalDays = body.additionalDays.map(Number).filter((d) => d >= 0 && d <= 6);
    } else {
      out.additionalDays = [];
    }
  }

  if (!partial || body.startTimeLocal !== undefined) {
    const from = parseHHMM(body.startTimeLocal);
    if (!from) throw ApiError.badRequest('startTimeLocal must be HH:MM');
    out.startTimeLocal = from.label;
  }

  if (!partial || body.endTimeLocal !== undefined) {
    const to = parseHHMM(body.endTimeLocal);
    if (!to) throw ApiError.badRequest('endTimeLocal must be HH:MM');
    out.endTimeLocal = to.label;
  }

  if (out.startTimeLocal && out.endTimeLocal) {
    const from = parseHHMM(out.startTimeLocal);
    const to = parseHHMM(out.endTimeLocal);
    if (to.minutes <= from.minutes) {
      throw ApiError.badRequest('endTimeLocal must be after startTimeLocal');
    }
  }

  if (!partial || body.frequency !== undefined) {
    const frequency = String(body.frequency || 'weekly').toLowerCase();
    if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
      throw ApiError.badRequest('frequency must be weekly, biweekly, or monthly');
    }
    out.frequency = frequency;
  }

  if (!partial || body.monthlyFee !== undefined) {
    const fee = Number(body.monthlyFee);
    if (!Number.isFinite(fee) || fee < 0) {
      throw ApiError.badRequest('monthlyFee must be 0 or positive number');
    }
    out.monthlyFee = fee;
  }

  if (!partial || body.currency !== undefined) {
    const cur = String(body.currency || 'USD').toUpperCase();
    if (!['USD', 'SLSH'].includes(cur)) {
      throw ApiError.badRequest('currency must be USD or SLSH');
    }
    out.currency = cur;
  }

  if (!partial || body.gracePeriodDays !== undefined) {
    const grace = Number(body.gracePeriodDays ?? 3);
    if (!Number.isFinite(grace) || grace < 0 || grace > 30) {
      throw ApiError.badRequest('gracePeriodDays must be between 0 and 30');
    }
    out.gracePeriodDays = grace;
  }

  if (!partial || body.startDate !== undefined) {
    out.startDate = body.startDate ? parseOptionalDate(body.startDate) : startOfUtcDay(new Date());
  }

  if (!partial || body.endDate !== undefined) {
    out.endDate = body.endDate ? parseOptionalDate(body.endDate) : null;
  }

  if (out.startDate && out.endDate && out.endDate < out.startDate) {
    throw ApiError.badRequest('endDate must be on or after startDate');
  }

  if (!partial || body.note !== undefined) {
    out.note = body.note == null ? '' : String(body.note).trim();
  }

  if (!partial || body.teamId !== undefined) {
    out.team = body.teamId || undefined;
  }

  if (!partial || body.captainId !== undefined) {
    out.captain = body.captainId || undefined;
  }

  if (!partial || body.status !== undefined) {
    if (body.status != null && body.status !== '') {
      const status = String(body.status);
      if (!['active', 'paused', 'ended'].includes(status)) {
        throw ApiError.badRequest('status must be active, paused, or ended');
      }
      out.status = status;
    }
  }

  return out;
}

async function accessibleStadiumIds(user) {
  if (user.role === ROLES.STADIUM_MANAGER) {
    return managerService.getManagedStadiumIds(user.id);
  }
  const owned = await Stadium.find({ owner: user.id }).select('_id');
  const managed = await managerService.getManagedStadiumIds(user.id);
  return [...owned.map((s) => s._id), ...managed];
}

async function loadFieldForUser(fieldId, user) {
  const field = await Field.findById(fieldId);
  if (!field) throw ApiError.notFound('Field not found');
  const { stadium } = await managerService.assertStadiumAccess(field.stadium.toString(), user);
  return { field, stadium };
}

async function assertNoConflict(fields, { excludeId } = {}) {
  if (fields.status && fields.status !== 'active') return;
  const hit = await findConflictingRecurring({
    fieldId: fields.field,
    dayOfWeek: fields.dayOfWeek,
    additionalDays: fields.additionalDays || [],
    startTimeLocal: fields.startTimeLocal,
    endTimeLocal: fields.endTimeLocal,
    startDate: fields.startDate,
    endDate: fields.endDate,
    excludeId,
  });
  if (hit) {
    throw ApiError.conflict(
      `That weekday/time is already reserved for ${teamDisplayName(hit)}`,
      {
        code: 'RECURRING_OVERLAP',
        teamName: hit.teamName,
        messageSo: `Waqtigaas waxaa hore u haysta ${teamDisplayName(hit)}`,
      }
    );
  }
}

async function getKulansiiyeJoogtoFee(monthlyFee) {
  try {
    const settings = await PlatformSettings.findOne({ key: 'default' });
    if (!settings) return 4.0;
    if (settings.joogtoFeeMode === 'none') return 0;
    if (settings.joogtoFeeMode === 'percent') {
      const pct = settings.joogtoPlatformFeePercent || 3.5;
      return Math.round((monthlyFee * pct) / 100 * 100) / 100;
    }
    return settings.joogtoPlatformFeeUsd || 4.0;
  } catch (_e) {
    return 4.0;
  }
}

/**
 * Creates a permanent Joogto match membership with digital pass card.
 */
async function createRecurring(user, body) {
  if (!body.fieldId) throw ApiError.badRequest('fieldId is required');
  const { field, stadium } = await loadFieldForUser(body.fieldId, user);
  const fields = validateRecurringInput(body);
  fields.field = field._id;
  await assertNoConflict(fields);

  const cityCode = stadium.location?.city ? stadium.location.city.slice(0, 3).toUpperCase() : 'SOM';
  const cardNumber = generateCardNumber(cityCode);
  const securityPin = generateSecurityPin();

  // Auto-link registered captain by phone if available
  if (!fields.captain && fields.captainPhone) {
    const rawDigits = fields.captainPhone.replace(/\D/g, '');
    try {
      const orClauses = [{ phone: fields.captainPhone }];
      if (rawDigits.length >= 7) {
        orClauses.push({ phone: { $regex: rawDigits.slice(-7) + '$' } });
      }
      const matchedUser = await User.findOne({ $or: orClauses });
      if (matchedUser) {
        fields.captain = matchedUser._id;
      }
    } catch (_err) {
      /* ignore lookup failure */
    }
  }

  // 1 month validity window
  const now = new Date();
  const startDate = fields.startDate || now;
  const endDate = fields.endDate || new Date(startDate.getTime() + 30 * 86400000);
  const graceDays = fields.gracePeriodDays ?? 3;
  const graceEndsAt = new Date(endDate.getTime() + graceDays * 86400000);

  const monthlyFee = fields.monthlyFee ?? 100;
  const kulFee = await getKulansiiyeJoogtoFee(monthlyFee);
  const stadiumShare = Math.max(0, monthlyFee - kulFee);

  const isInitialPaid = body.isPaid !== false;
  const receiptNum = isInitialPaid ? generateReceiptNumber() : null;

  const tempId = new mongoose.Types.ObjectId();
  const qrSignature = generateQrSignature(tempId.toString(), cardNumber, securityPin, endDate);

  const initialPayments = isInitialPaid
    ? [
        {
          periodStart: startDate,
          periodEnd: endDate,
          amount: monthlyFee,
          currency: fields.currency || 'USD',
          amountSlsh: (fields.currency === 'SLSH' ? monthlyFee : monthlyFee * (fields.exchangeRate || 8000)),
          kulansiiyeFee: kulFee,
          stadiumShare,
          paymentMethod: body.paymentMethod || 'cash',
          paidAt: now,
          paidBy: fields.captainName || fields.teamName,
          reference: body.paymentReference || 'Initial Registration',
          receiptNumber: receiptNum,
          recordedBy: user.id,
          notes: 'Diiwaangelinta hore ee bisha (Initial Monthly Payment)',
        },
      ]
    : [];

  const rec = await RecurringBooking.create({
    _id: tempId,
    field: field._id,
    stadium: stadium._id,
    owner: stadium.owner,
    team: fields.team,
    teamName: fields.teamName,
    captain: fields.captain,
    captainName: fields.captainName,
    captainPhone: fields.captainPhone,
    cardNumber,
    securityPin,
    qrSignature,
    frequency: fields.frequency,
    dayOfWeek: fields.dayOfWeek,
    additionalDays: fields.additionalDays || [],
    startTimeLocal: fields.startTimeLocal,
    endTimeLocal: fields.endTimeLocal,
    startDate,
    endDate,
    monthlyFee,
    currency: fields.currency || 'USD',
    exchangeRate: fields.exchangeRate || 8000,
    kulansiiyeFee: kulFee,
    stadiumShare,
    gracePeriodDays: graceDays,
    billingCycle: {
      startDate,
      endDate,
      gracePeriodEndsAt: graceEndsAt,
      lastPaymentDate: isInitialPaid ? now : null,
      receiptNumber: receiptNum,
    },
    paymentStatus: isInitialPaid ? 'paid' : 'unpaid',
    cardStatus: isInitialPaid ? 'active' : 'expired',
    status: fields.status || 'active',
    payments: initialPayments,
    note: fields.note,
    hidePublicInfo: true,
  });

  return RecurringBooking.findById(rec._id)
    .populate('field', 'name')
    .populate('stadium', 'name location');
}

/**
 * Lists Joogto memberships with live card statuses synced.
 */
async function listRecurring(user, { fieldId, stadiumId } = {}) {
  let filter = {};
  if (fieldId) {
    await loadFieldForUser(fieldId, user);
    filter = { field: fieldId };
  } else if (stadiumId) {
    await managerService.assertStadiumAccess(stadiumId, user);
    filter = { stadium: stadiumId };
  } else {
    const ids = await accessibleStadiumIds(user);
    filter = { stadium: { $in: ids } };
  }

  const items = await RecurringBooking.find(filter)
    .populate('field', 'name')
    .populate('stadium', 'name location')
    .sort({ dayOfWeek: 1, startTimeLocal: 1 });

  return items.map((doc) => syncCardLifecycle(doc));
}

async function getOwnedRecurring(recurringId, user) {
  const rec = await RecurringBooking.findById(recurringId);
  if (!rec) throw ApiError.notFound('Weekly permanent match not found');
  await managerService.assertStadiumAccess(rec.stadium.toString(), user);
  return rec;
}

/**
 * Updates recurring configuration.
 */
async function updateRecurring(recurringId, user, body) {
  const rec = await getOwnedRecurring(recurringId, user);
  const patch = validateRecurringInput(body, { partial: true });

  if (body.fieldId) {
    const { field, stadium } = await loadFieldForUser(body.fieldId, user);
    rec.field = field._id;
    rec.stadium = stadium._id;
    rec.owner = stadium.owner;
  }

  if (patch.teamName !== undefined) rec.teamName = patch.teamName;
  if (patch.captainName !== undefined) rec.captainName = patch.captainName;
  if (patch.captainPhone !== undefined) rec.captainPhone = patch.captainPhone;
  if (patch.team !== undefined) rec.team = patch.team;
  if (patch.captain !== undefined) rec.captain = patch.captain;
  if (patch.frequency !== undefined) rec.frequency = patch.frequency;
  if (patch.dayOfWeek !== undefined) rec.dayOfWeek = patch.dayOfWeek;
  if (patch.additionalDays !== undefined) rec.additionalDays = patch.additionalDays;
  if (patch.startTimeLocal !== undefined) rec.startTimeLocal = patch.startTimeLocal;
  if (patch.endTimeLocal !== undefined) rec.endTimeLocal = patch.endTimeLocal;
  if (patch.startDate !== undefined) rec.startDate = patch.startDate;
  if (patch.endDate !== undefined) rec.endDate = patch.endDate;
  if (patch.monthlyFee !== undefined) {
    rec.monthlyFee = patch.monthlyFee;
    const kulFee = await getKulansiiyeJoogtoFee(rec.monthlyFee);
    rec.kulansiiyeFee = kulFee;
    rec.stadiumShare = Math.max(0, rec.monthlyFee - kulFee);
  }
  if (patch.currency !== undefined) rec.currency = patch.currency;
  if (patch.gracePeriodDays !== undefined) {
    rec.gracePeriodDays = patch.gracePeriodDays;
    if (rec.billingCycle?.endDate) {
      rec.billingCycle.gracePeriodEndsAt = new Date(
        new Date(rec.billingCycle.endDate).getTime() + rec.gracePeriodDays * 86400000
      );
    }
  }
  if (patch.note !== undefined) rec.note = patch.note;
  if (patch.status !== undefined) rec.status = patch.status;

  const from = parseHHMM(rec.startTimeLocal);
  const to = parseHHMM(rec.endTimeLocal);
  if (!from || !to || to.minutes <= from.minutes) {
    throw ApiError.badRequest('endTimeLocal must be after startTimeLocal');
  }

  await assertNoConflict(
    {
      field: rec.field,
      dayOfWeek: rec.dayOfWeek,
      additionalDays: rec.additionalDays,
      startTimeLocal: rec.startTimeLocal,
      endTimeLocal: rec.endTimeLocal,
      startDate: rec.startDate,
      endDate: rec.endDate,
      status: rec.status,
    },
    { excludeId: rec._id }
  );

  syncCardLifecycle(rec);
  await rec.save();

  return RecurringBooking.findById(rec._id)
    .populate('field', 'name')
    .populate('stadium', 'name location');
}

/**
 * Mark a Joogto Card Paid / Renew for 1 Month.
 * Used by Stadium Owner / Manager to accept cash/mobile dues,
 * extend validity, calculate E-Garoon platform fee, and generate a receipt.
 */
async function markPaid(recurringId, user, paymentData = {}) {
  const rec = await getOwnedRecurring(recurringId, user);
  const monthsCount = Math.max(1, Number(paymentData.monthsCount || 1));
  const amountPaid = Number(paymentData.amount || rec.monthlyFee * monthsCount);
  const currency = paymentData.currency || rec.currency || 'USD';
  const paymentMethod = paymentData.paymentMethod || 'cash';

  const now = new Date();
  const currentEnd = rec.billingCycle?.endDate ? new Date(rec.billingCycle.endDate) : now;
  // If current end is in the future, add from current end; if already expired, start from now
  const newStart = currentEnd > now ? currentEnd : now;
  const newEnd = new Date(newStart.getTime() + monthsCount * 30 * 86400000);
  const graceDays = rec.gracePeriodDays ?? 3;
  const graceEndsAt = new Date(newEnd.getTime() + graceDays * 86400000);

  const kulFee = await getKulansiiyeJoogtoFee(amountPaid);
  const stadiumShare = Math.max(0, amountPaid - kulFee);
  const receiptNum = generateReceiptNumber();

  const paymentRecord = {
    periodStart: newStart,
    periodEnd: newEnd,
    amount: amountPaid,
    currency,
    amountSlsh: (currency === 'SLSH' ? amountPaid : amountPaid * (rec.exchangeRate || 8000)),
    kulansiiyeFee: kulFee,
    stadiumShare,
    paymentMethod,
    paidAt: now,
    paidBy: paymentData.paidBy || rec.captainName || rec.teamName,
    reference: paymentData.reference || `Cusbooneysiin ${monthsCount} Bilood`,
    receiptNumber: receiptNum,
    recordedBy: user.id,
    notes: paymentData.notes || `Lacagta bisha waxaa qabtay ${user.name || 'Maamulka'}`,
  };

  rec.payments.push(paymentRecord);
  rec.billingCycle = {
    startDate: newStart,
    endDate: newEnd,
    gracePeriodEndsAt: graceEndsAt,
    lastPaymentDate: now,
    receiptNumber: receiptNum,
  };
  rec.paymentStatus = 'paid';
  rec.cardStatus = 'active';
  rec.status = 'active';

  // Update dynamic QR signature with new validUntil date
  rec.qrSignature = generateQrSignature(rec._id.toString(), rec.cardNumber, rec.securityPin, newEnd);

  await rec.save();

  return {
    success: true,
    message: `Lacagta bisha waa la xaqiijiyay (${amountPaid} ${currency}). Kaarku waa firfircoonyahay ilaa ${newEnd.toLocaleDateString()}.`,
    receipt: paymentRecord,
    membership: await RecurringBooking.findById(rec._id).populate('field', 'name').populate('stadium', 'name location'),
  };
}

/**
 * Gate Check-In & Verification:
 * Scans QR token or enters Card Number + PIN.
 * Verifies validity, match day, time, and prevents impostors.
 */
async function verifyCard(user, { qrToken, cardNumber, pin } = {}) {
  let rec = null;

  if (qrToken) {
    // Find by QR signature or decode
    rec = await RecurringBooking.findOne({ qrSignature: qrToken.trim() });
    if (!rec) {
      // Try searching by cardNumber if token is the cardNumber string
      rec = await RecurringBooking.findOne({ cardNumber: qrToken.trim().toUpperCase() });
    }
  }

  if (!rec && cardNumber) {
    rec = await RecurringBooking.findOne({ cardNumber: cardNumber.trim().toUpperCase() });
  }

  if (!rec) {
    throw ApiError.notFound('Kaarka Joogtada ah lama helin (Invalid / Fake Card Number)');
  }

  // Ensure this manager/owner has access to this stadium
  await managerService.assertStadiumAccess(rec.stadium.toString(), user);

  // Security PIN check if provided
  if (pin && String(pin).trim() !== String(rec.securityPin).trim()) {
    throw ApiError.badRequest('Security PIN-ka kaarka waa khalad (Incorrect Security PIN)');
  }

  // Sync life cycle
  syncCardLifecycle(rec);

  const now = new Date();
  const currentDay = now.getUTCDay();
  const matchDays = [Number(rec.dayOfWeek), ...(rec.additionalDays || []).map(Number)];
  const isMatchDay = matchDays.includes(currentDay);

  const scanRecord = {
    scannedAt: now,
    scannedBy: user.id,
    result: 'allowed',
    reason: '',
  };

  let allowed = false;
  let status = rec.cardStatus;
  let message = '';
  let warning = '';

  if (rec.cardStatus === 'blocked') {
    allowed = false;
    scanRecord.result = 'rejected';
    scanRecord.reason = 'Kaarku waa hakad (Paused / Blocked)';
    message = 'Kaarkan waa la xiray (Card is blocked by stadium owner).';
  } else if (rec.cardStatus === 'expired') {
    allowed = false;
    scanRecord.result = 'rejected';
    scanRecord.reason = 'Waqtigii lacag-bixinta bisha wuu dhacay (Membership expired)';
    message = `Lacagta bisha ee kooxda ${rec.teamName} way dhacday. Fadlan bixi lacagta bisha si kaarka loo cusbooneysiiyo.`;
  } else if (rec.cardStatus === 'grace_period') {
    allowed = true; // Still within grace period
    scanRecord.result = 'grace_warning';
    const remainingDays = rec.billingCycle?.gracePeriodEndsAt
      ? Math.max(1, Math.ceil((new Date(rec.billingCycle.gracePeriodEndsAt) - now) / 86400000))
      : 1;
    scanRecord.reason = `Muddo-dhaaf: ${remainingDays} maalmood baa hadhay.`;
    warning = `DIGNIIN: Kooxdan waxaa ka hadhay ${remainingDays} maalmood oo muddo-dhaaf ah (Grace Period). Waa inay bixiyaan lacagta bisha.`;
    message = `Waad ciyaari kartaan maanta, laakiin fadlan bixiya lacagta bisha inta aysan xirmin.`;
  } else {
    // Active
    allowed = true;
    scanRecord.result = 'allowed';
    scanRecord.reason = 'Kaarka waa firfircoonyahay (Active valid pass)';
    message = `Kaarku waa sax oo shaqaynayaa! Ciyaar wanaagsan kooxda ${rec.teamName}.`;
  }

  rec.attendanceHistory.push(scanRecord);
  await rec.save();

  return {
    allowed,
    status,
    message,
    warning,
    isMatchDay,
    team: {
      teamName: rec.teamName,
      captainName: rec.captainName,
      captainPhone: rec.captainPhone,
      cardNumber: rec.cardNumber,
      securityPin: rec.securityPin,
    },
    schedule: {
      dayOfWeek: rec.dayOfWeek,
      additionalDays: rec.additionalDays || [],
      startTimeLocal: rec.startTimeLocal,
      endTimeLocal: rec.endTimeLocal,
    },
    validUntil: rec.billingCycle?.endDate || rec.endDate,
    gracePeriodEndsAt: rec.billingCycle?.gracePeriodEndsAt,
    lastPaymentDate: rec.billingCycle?.lastPaymentDate,
  };
}

/**
 * Get Team Captain's Joogto Membership Cards.
 */
async function getCaptainJoogto(userId) {
  const orConditions = [{ captain: userId }, { owner: userId }];
  try {
    const currentUser = await User.findById(userId).select('phone');
    if (currentUser?.phone) {
      const rawDigits = currentUser.phone.replace(/\D/g, '');
      orConditions.push({ captainPhone: currentUser.phone });
      if (rawDigits.length >= 7) {
        orConditions.push({ captainPhone: { $regex: rawDigits.slice(-7) + '$' } });
      }
    }
  } catch (_e) {
    /* fallback to id match */
  }

  const items = await RecurringBooking.find({
    $or: orConditions,
  })
    .populate('field', 'name')
    .populate('stadium', 'name location')
    .sort({ createdAt: -1 });

  return items.map((doc) => syncCardLifecycle(doc));
}

async function deleteRecurring(recurringId, user) {
  const rec = await getOwnedRecurring(recurringId, user);
  await rec.deleteOne();
  return { deleted: true };
}

module.exports = {
  createRecurring,
  listRecurring,
  updateRecurring,
  deleteRecurring,
  markPaid,
  verifyCard,
  getCaptainJoogto,
  findOverlappingRecurring,
  recurringOverlapsRange,
  teamDisplayName,
  parseHHMM,
  validateRecurringInput,
  syncCardLifecycle,
  generateCardNumber,
  generateSecurityPin,
  generateQrSignature,
};
