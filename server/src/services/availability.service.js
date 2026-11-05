const Field = require('../models/Field');
const Stadium = require('../models/Stadium');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const managerService = require('./manager.service');

const BLOCK_TYPES = [
  'maintenance',
  'weather',
  'holiday',
  'private_event',
  'tournament',
  'owner_block',
];

const LIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.PAYMENT_PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
];

async function assertFieldAccess(fieldId, user) {
  const field = await Field.findById(fieldId).populate('stadium');
  if (!field) throw ApiError.notFound('Field not found');
  await managerService.assertStadiumAccess(field.stadium._id.toString(), user);
  return field;
}

function parseDate(value, label) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
  return date;
}

function assertValidRange(startsAt, endsAt) {
  if (!(startsAt instanceof Date) || !(endsAt instanceof Date)) {
    throw ApiError.badRequest('startsAt and endsAt are required');
  }
  if (endsAt <= startsAt) {
    throw ApiError.badRequest('endsAt must be after startsAt');
  }
}

async function assertNoLiveBookingOverlap(fieldIds, startsAt, endsAt) {
  const ids = Array.isArray(fieldIds) ? fieldIds : [fieldIds];
  const overlapping = await Booking.findOne({
    field: { $in: ids },
    startTime: { $lt: endsAt },
    endTime: { $gt: startsAt },
    status: { $in: LIVE_BOOKING_STATUSES },
  });
  if (overlapping) {
    throw ApiError.conflict('There is already an active booking in this time range');
  }
}

/**
 * Blocks that make a field unbookable: its own field blocks + stadium-wide locks.
 */
function overlappingBlockFilter(fieldId, stadiumId, startsAt, endsAt) {
  const time = {
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  };
  const or = [{ field: fieldId }];
  if (stadiumId) {
    or.push({ scope: 'stadium', stadium: stadiumId });
  }
  return { ...time, $or: or };
}

async function findOverlappingBlock(fieldId, stadiumId, startsAt, endsAt) {
  return AvailabilityBlock.findOne(overlappingBlockFilter(fieldId, stadiumId, startsAt, endsAt));
}

async function listOverlappingBlocks(fieldId, stadiumId, startsAt, endsAt) {
  return AvailabilityBlock.find(overlappingBlockFilter(fieldId, stadiumId, startsAt, endsAt));
}

async function createBlock(user, payload) {
  const {
    fieldId,
    stadiumId,
    scope = 'field',
    type,
    startsAt: startsRaw,
    endsAt: endsRaw,
    reason,
    tournamentId,
  } = payload;

  if (!BLOCK_TYPES.includes(type)) {
    throw ApiError.badRequest(`type must be one of: ${BLOCK_TYPES.join(', ')}`);
  }

  const startsAt = parseDate(startsRaw, 'startsAt');
  const endsAt = parseDate(endsRaw, 'endsAt');
  assertValidRange(startsAt, endsAt);

  if (scope === 'stadium' || (!fieldId && stadiumId)) {
    return createStadiumLock(user, {
      stadiumId: stadiumId || payload.stadiumId,
      type,
      startsAt,
      endsAt,
      reason,
      tournamentId,
    });
  }

  if (!fieldId) throw ApiError.badRequest('fieldId is required');

  const field = await assertFieldAccess(fieldId, user);
  const stadium = field.stadium?._id || field.stadium;
  await assertNoLiveBookingOverlap(fieldId, startsAt, endsAt);

  return AvailabilityBlock.create({
    scope: 'field',
    stadium,
    field: fieldId,
    type,
    startsAt,
    endsAt,
    reason,
    tournament: tournamentId,
    createdBy: user.id,
  });
}

/** Lock every field in the stadium for [startsAt, endsAt). */
async function createStadiumLock(user, payload) {
  const { stadiumId, type, startsAt, endsAt, reason, tournamentId } = payload;
  if (!stadiumId) throw ApiError.badRequest('stadiumId is required');
  if (!BLOCK_TYPES.includes(type)) {
    throw ApiError.badRequest(`type must be one of: ${BLOCK_TYPES.join(', ')}`);
  }

  await managerService.assertStadiumAccess(stadiumId, user);
  const stadium = await Stadium.findById(stadiumId).select('_id name');
  if (!stadium) throw ApiError.notFound('Stadium not found');

  const rangeStart = startsAt instanceof Date ? startsAt : parseDate(startsAt, 'startsAt');
  const rangeEnd = endsAt instanceof Date ? endsAt : parseDate(endsAt, 'endsAt');
  assertValidRange(rangeStart, rangeEnd);

  const fields = await Field.find({ stadium: stadiumId }).select('_id');
  const fieldIds = fields.map((f) => f._id);
  if (fieldIds.length) {
    await assertNoLiveBookingOverlap(fieldIds, rangeStart, rangeEnd);
  }

  const existing = await AvailabilityBlock.findOne({
    scope: 'stadium',
    stadium: stadiumId,
    startsAt: { $lt: rangeEnd },
    endsAt: { $gt: rangeStart },
  });
  if (existing) {
    throw ApiError.conflict('Stadium is already locked for overlapping times');
  }

  return AvailabilityBlock.create({
    scope: 'stadium',
    stadium: stadiumId,
    type,
    startsAt: rangeStart,
    endsAt: rangeEnd,
    reason: reason || 'Whole stadium locked',
    tournament: tournamentId,
    createdBy: user.id,
  });
}

/** Public / captain-facing list of blocks for a field (includes stadium locks). */
async function listBlocksForField(fieldId, { upcoming = false, from, to } = {}) {
  const field = await Field.findById(fieldId).select('_id stadium');
  if (!field) throw ApiError.notFound('Field not found');

  const filter = {
    $or: [{ field: fieldId }, { scope: 'stadium', stadium: field.stadium }],
  };
  applyTimeFilter(filter, { upcoming, from, to });

  return AvailabilityBlock.find(filter).sort({ startsAt: 1 });
}

/** Owner/manager list of blocks across a stadium (field + stadium-wide). */
async function listBlocksForStadium(stadiumId, user, { fieldId, upcoming = true, from, to } = {}) {
  await managerService.assertStadiumAccess(stadiumId, user);

  const fields = await Field.find({ stadium: stadiumId }).select('_id name');
  const fieldIds = fields.map((f) => f._id);

  if (fieldId) {
    const belongs = fieldIds.some((id) => id.toString() === String(fieldId));
    if (!belongs) throw ApiError.badRequest('Field does not belong to this stadium');
  }

  const filter = fieldId
    ? {
        $or: [{ field: fieldId }, { scope: 'stadium', stadium: stadiumId }],
      }
    : {
        $or: [{ field: { $in: fieldIds } }, { scope: 'stadium', stadium: stadiumId }],
      };

  applyTimeFilter(filter, { upcoming, from, to });

  return AvailabilityBlock.find(filter)
    .populate('field', 'name type')
    .populate('stadium', 'name')
    .populate('createdBy', 'name email')
    .sort({ startsAt: 1 });
}

function applyTimeFilter(filter, { upcoming, from, to }) {
  const fromDate = from ? parseDate(from, 'from') : null;
  const toDate = to ? parseDate(to, 'to') : null;

  if (fromDate || toDate) {
    if (fromDate) filter.endsAt = { ...(filter.endsAt || {}), $gt: fromDate };
    if (toDate) filter.startsAt = { ...(filter.startsAt || {}), $lt: toDate };
    return;
  }

  if (upcoming === true || upcoming === '1' || upcoming === 'true') {
    filter.endsAt = { $gte: new Date() };
  }
}

async function updateBlock(blockId, user, payload) {
  const block = await AvailabilityBlock.findById(blockId);
  if (!block) throw ApiError.notFound('Block not found');

  if (block.scope === 'stadium') {
    await managerService.assertStadiumAccess(block.stadium.toString(), user);
  } else {
    await assertFieldAccess(block.field.toString(), user);
  }

  const nextType = payload.type !== undefined ? payload.type : block.type;
  if (!BLOCK_TYPES.includes(nextType)) {
    throw ApiError.badRequest(`type must be one of: ${BLOCK_TYPES.join(', ')}`);
  }

  const startsAt =
    payload.startsAt !== undefined ? parseDate(payload.startsAt, 'startsAt') : block.startsAt;
  const endsAt = payload.endsAt !== undefined ? parseDate(payload.endsAt, 'endsAt') : block.endsAt;
  assertValidRange(startsAt, endsAt);

  const timesChanged =
    startsAt.getTime() !== new Date(block.startsAt).getTime() ||
    endsAt.getTime() !== new Date(block.endsAt).getTime();

  if (timesChanged) {
    if (block.scope === 'stadium') {
      const fields = await Field.find({ stadium: block.stadium }).select('_id');
      await assertNoLiveBookingOverlap(
        fields.map((f) => f._id),
        startsAt,
        endsAt
      );
    } else {
      if (payload.fieldId && String(payload.fieldId) !== String(block.field)) {
        throw ApiError.badRequest('Cannot move a block to another field — delete and recreate');
      }
      await assertNoLiveBookingOverlap(block.field, startsAt, endsAt);
    }
  }

  block.type = nextType;
  block.startsAt = startsAt;
  block.endsAt = endsAt;
  if (payload.reason !== undefined) block.reason = payload.reason;

  await block.save();
  await block.populate([
    { path: 'field', select: 'name type' },
    { path: 'stadium', select: 'name' },
    { path: 'createdBy', select: 'name email' },
  ]);
  return block;
}

async function deleteBlock(blockId, user) {
  const block = await AvailabilityBlock.findById(blockId);
  if (!block) throw ApiError.notFound('Block not found');
  if (block.scope === 'stadium') {
    await managerService.assertStadiumAccess(block.stadium.toString(), user);
  } else {
    await assertFieldAccess(block.field.toString(), user);
  }
  await block.deleteOne();
  return { message: 'Block removed' };
}

module.exports = {
  BLOCK_TYPES,
  assertFieldAccess,
  createBlock,
  createStadiumLock,
  listBlocksForField,
  listBlocksForStadium,
  updateBlock,
  deleteBlock,
  findOverlappingBlock,
  listOverlappingBlocks,
};
