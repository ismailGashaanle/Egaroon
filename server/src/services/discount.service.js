const Discount = require('../models/Discount');
const Field = require('../models/Field');
const ApiError = require('../utils/ApiError');
const managerService = require('./manager.service');

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min, minutes: h * 60 + min, label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
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

function normalizeDaysOfWeek(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const days = [...new Set(raw.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))];
  return days;
}

/**
 * Validate create/update payload. Returns normalized fields for Discount.create/update.
 */
function validateDiscountInput(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw ApiError.badRequest('Discount name is required');
    out.name = name;
  }

  if (!partial || body.percentOff !== undefined || body.amountOff !== undefined) {
    const hasPercent = body.percentOff !== undefined && body.percentOff !== null && body.percentOff !== '';
    const hasAmount = body.amountOff !== undefined && body.amountOff !== null && body.amountOff !== '';

    if (!partial && !hasPercent && !hasAmount) {
      throw ApiError.badRequest('Provide percentOff (1–100) or amountOff');
    }

    if (hasPercent && hasAmount) {
      throw ApiError.badRequest('Use either percentOff or amountOff, not both');
    }

    if (hasPercent) {
      const p = Number(body.percentOff);
      if (!Number.isFinite(p) || p < 1 || p > 100) {
        throw ApiError.badRequest('percentOff must be between 1 and 100');
      }
      out.percentOff = p;
      out.amountOff = undefined;
    } else if (hasAmount) {
      const a = Number(body.amountOff);
      if (!Number.isFinite(a) || a < 0) {
        throw ApiError.badRequest('amountOff must be a non-negative number');
      }
      out.amountOff = Math.round(a * 100) / 100;
      out.percentOff = undefined;
    }
  }

  if (!partial || body.applyToAllSlots !== undefined) {
    out.applyToAllSlots = Boolean(body.applyToAllSlots);
  }

  if (!partial || body.daysOfWeek !== undefined) {
    out.daysOfWeek = normalizeDaysOfWeek(body.daysOfWeek);
  }

  if (!partial || body.startTimeLocal !== undefined || body.endTimeLocal !== undefined) {
    const start = body.startTimeLocal != null && body.startTimeLocal !== '' ? parseHHMM(body.startTimeLocal) : null;
    const end = body.endTimeLocal != null && body.endTimeLocal !== '' ? parseHHMM(body.endTimeLocal) : null;

    if (body.startTimeLocal && !start) throw ApiError.badRequest('Invalid startTimeLocal (HH:MM)');
    if (body.endTimeLocal && !end) throw ApiError.badRequest('Invalid endTimeLocal (HH:MM)');

    if (start && end && end.minutes <= start.minutes) {
      throw ApiError.badRequest('endTimeLocal must be after startTimeLocal');
    }

    if (!partial || body.startTimeLocal !== undefined) {
      out.startTimeLocal = start ? start.label : null;
    }
    if (!partial || body.endTimeLocal !== undefined) {
      out.endTimeLocal = end ? end.label : null;
    }
  }

  if (!partial || body.validFrom !== undefined) {
    out.validFrom = parseOptionalDate(body.validFrom);
  }
  if (!partial || body.validUntil !== undefined) {
    out.validUntil = parseOptionalDate(body.validUntil);
  }

  if (out.validFrom && out.validUntil && out.validUntil < out.validFrom) {
    throw ApiError.badRequest('End date must be on or after start date');
  }

  if (!partial || body.status !== undefined) {
    if (body.status != null && !['active', 'inactive'].includes(body.status)) {
      throw ApiError.badRequest('status must be active or inactive');
    }
    if (body.status) out.status = body.status;
  }

  return out;
}

async function resolveFieldId(stadiumId, fieldId) {
  if (fieldId == null || fieldId === '') return null;
  const field = await Field.findById(fieldId).select('stadium');
  if (!field) throw ApiError.notFound('Field not found');
  if (String(field.stadium) !== String(stadiumId)) {
    throw ApiError.badRequest('Field does not belong to this stadium');
  }
  return field._id;
}

async function createDiscount(user, body) {
  const { stadium } = await managerService.assertStadiumAccess(body.stadiumId, user, {
    ownerOnly: true,
  });
  const fields = validateDiscountInput(body);
  const fieldId = await resolveFieldId(stadium._id, body.fieldId);

  const discount = await Discount.create({
    stadium: stadium._id,
    field: fieldId,
    owner: user.id,
    ...fields,
    status: fields.status || 'active',
  });
  return discount;
}

async function updateDiscount(discountId, user, body) {
  const discount = await Discount.findById(discountId);
  if (!discount) throw ApiError.notFound('Discount not found');
  await managerService.assertStadiumAccess(discount.stadium, user, { ownerOnly: true });

  const fields = validateDiscountInput(body, { partial: true });

  if (body.fieldId !== undefined) {
    discount.field = await resolveFieldId(discount.stadium, body.fieldId);
  }

  if (fields.name !== undefined) discount.name = fields.name;
  if (fields.applyToAllSlots !== undefined) discount.applyToAllSlots = fields.applyToAllSlots;
  if (fields.daysOfWeek !== undefined) discount.daysOfWeek = fields.daysOfWeek;
  if (fields.startTimeLocal !== undefined) discount.startTimeLocal = fields.startTimeLocal;
  if (fields.endTimeLocal !== undefined) discount.endTimeLocal = fields.endTimeLocal;
  if (fields.validFrom !== undefined) discount.validFrom = fields.validFrom;
  if (fields.validUntil !== undefined) discount.validUntil = fields.validUntil;
  if (fields.status !== undefined) discount.status = fields.status;

  if (fields.percentOff != null) {
    discount.percentOff = fields.percentOff;
    discount.amountOff = undefined;
    discount.set('amountOff', undefined);
  } else if (fields.amountOff != null) {
    discount.amountOff = fields.amountOff;
    discount.percentOff = undefined;
    discount.set('percentOff', undefined);
  }

  if (discount.percentOff == null && discount.amountOff == null) {
    throw ApiError.badRequest('Discount must have percentOff or amountOff');
  }

  await discount.save();
  return discount;
}

async function deleteDiscount(discountId, user) {
  const discount = await Discount.findById(discountId);
  if (!discount) throw ApiError.notFound('Discount not found');
  await managerService.assertStadiumAccess(discount.stadium, user, { ownerOnly: true });
  await discount.deleteOne();
  return { deleted: true };
}

async function accessibleStadiumIds(user) {
  const { ROLES } = require('../constants/roles');
  const Stadium = require('../models/Stadium');
  if (user.role === ROLES.STADIUM_MANAGER) {
    return managerService.getManagedStadiumIds(user.id);
  }
  const owned = await Stadium.find({ owner: user.id }).select('_id');
  const managed = await managerService.getManagedStadiumIds(user.id);
  return [...owned.map((s) => s._id), ...managed];
}

async function listDiscountsForUser(user, { stadiumId } = {}) {
  if (stadiumId) {
    await managerService.assertStadiumAccess(stadiumId, user);
    return Discount.find({ stadium: stadiumId }).sort({ createdAt: -1 });
  }
  const ids = await accessibleStadiumIds(user);
  return Discount.find({ stadium: { $in: ids } }).sort({ createdAt: -1 });
}

/**
 * Active discounts that could apply to a field (stadium-wide or field-specific).
 */
async function loadActiveDiscountsForField(field) {
  return Discount.find({
    stadium: field.stadium,
    status: 'active',
    $or: [{ field: null }, { field: { $exists: false } }, { field: field._id }],
  }).lean();
}

/**
 * Slot matching — same wall-clock convention as slots (UTC hours = local HH:MM).
 */
function discountMatchesSlot(discount, { fieldId, stadiumId, startTime }) {
  if (!discount || discount.status === 'inactive') return false;
  if (String(discount.stadium) !== String(stadiumId)) return false;
  if (discount.field && String(discount.field) !== String(fieldId)) return false;

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return false;

  const slotDay = startOfUtcDay(start);
  if (discount.validFrom && slotDay < startOfUtcDay(discount.validFrom)) return false;
  if (discount.validUntil && slotDay > startOfUtcDay(discount.validUntil)) return false;

  if (discount.applyToAllSlots) return true;

  const days = discount.daysOfWeek || [];
  if (days.length > 0 && !days.includes(start.getUTCDay())) return false;

  const slotMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const winStart = parseHHMM(discount.startTimeLocal);
  const winEnd = parseHHMM(discount.endTimeLocal);
  if (winStart && slotMinutes < winStart.minutes) return false;
  if (winEnd && slotMinutes >= winEnd.minutes) return false;

  return true;
}

function computeDiscountAmount(baseTotal, discount) {
  const base = Number(baseTotal) || 0;
  if (discount.percentOff != null && discount.percentOff > 0) {
    return Math.round(((base * Number(discount.percentOff)) / 100) * 100) / 100;
  }
  if (discount.amountOff != null && discount.amountOff > 0) {
    return Math.round(Number(discount.amountOff) * 100) / 100;
  }
  return 0;
}

/**
 * Among matching discounts, pick the one that saves the most on baseTotal.
 */
function pickBestDiscount(discounts, ctx, baseTotal) {
  let best = null;
  let bestSave = 0;
  for (const d of discounts || []) {
    if (!discountMatchesSlot(d, ctx)) continue;
    const save = computeDiscountAmount(baseTotal, d);
    if (save > bestSave) {
      bestSave = save;
      best = d;
    }
  }
  return best ? { discount: best, discountAmount: Math.min(bestSave, Number(baseTotal) || 0) } : null;
}

module.exports = {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  listDiscountsForUser,
  loadActiveDiscountsForField,
  discountMatchesSlot,
  computeDiscountAmount,
  pickBestDiscount,
  validateDiscountInput,
};
