const SlotDemand = require('../models/SlotDemand');
const Booking = require('../models/Booking');
const { getBusiness } = require('./platformSettings.service');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const ApiError = require('../utils/ApiError');

function isSidePaid(party) {
  if (!party) return false;
  return (
    party.paymentStatus === PAYMENT_STATUS.SUCCESS ||
    party.paymentStatus === PAYMENT_STATUS.HELD ||
    party.paymentStatus === PAYMENT_STATUS.SETTLED
  );
}

/** Booking waiting for Team B after Team A split pay (open match code window). */
function isWaitingForOpponent(booking) {
  if (!booking) return false;
  if (booking.coveredFullMatch) return false;
  if (![BOOKING_STATUS.PAYMENT_PENDING, BOOKING_STATUS.HELD].includes(booking.status)) return false;
  if (!isSidePaid(booking.teamA) && !booking.teamAPaidAt) return false;
  if (booking.teamB && isSidePaid(booking.teamB)) return false;
  return Boolean(booking.matchCode || booking.opponentWindow?.phase);
}

async function expireStaleDemands(now = new Date()) {
  await SlotDemand.updateMany(
    { status: 'ACTIVE', expiresAt: { $lt: now } },
    { $set: { status: 'EXPIRED' } }
  );
}

/**
 * Count ACTIVE (non-expired) demands for a field+startTime, excluding Team A captain.
 */
async function countActiveDemands({ fieldId, startTime, excludeUserId }) {
  await expireStaleDemands();
  const filter = {
    field: fieldId,
    startTime: new Date(startTime),
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() },
  };
  if (excludeUserId) {
    filter.user = { $ne: excludeUserId };
  }
  return SlotDemand.countDocuments(filter);
}

/**
 * Idempotent: double-click Book → same ACTIVE demand id.
 * Rate-limit at route layer; also soft-cap per user/slot via upsert.
 */
async function recordDemand({
  userId,
  teamId,
  fieldId,
  startTime,
  endTime,
  targetBookingId,
}) {
  if (!userId || !teamId || !fieldId || !startTime) {
    throw ApiError.badRequest('Demand requires auth captain, team, field, startTime');
  }

  const ttlSec = Number(getBusiness().slotDemandTtlSeconds) || 180;
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);

  // Refresh existing ACTIVE demand (idempotent)
  const existing = await SlotDemand.findOne({
    user: userId,
    field: fieldId,
    startTime: start,
    status: 'ACTIVE',
  });
  if (existing) {
    existing.expiresAt = expiresAt;
    if (targetBookingId) existing.targetBooking = targetBookingId;
    if (endTime) existing.endTime = end;
    await existing.save();
    return { demand: existing, created: false };
  }

  try {
    const demand = await SlotDemand.create({
      user: userId,
      team: teamId,
      field: fieldId,
      startTime: start,
      endTime: end,
      targetBooking: targetBookingId || undefined,
      status: 'ACTIVE',
      expiresAt,
    });
    return { demand, created: true };
  } catch (err) {
    if (err.code === 11000) {
      const again = await SlotDemand.findOne({
        user: userId,
        field: fieldId,
        startTime: start,
        status: 'ACTIVE',
      });
      if (again) {
        again.expiresAt = expiresAt;
        await again.save();
        return { demand: again, created: false };
      }
    }
    throw err;
  }
}

/**
 * When another captain's createHold hits a waiting-for-Team-B booking:
 * record demand + escalate opponent window (does NOT release on search).
 */
async function onCompetingBookAttempt({ competingCaptainId, competingTeamId, holdBooking }) {
  if (!holdBooking || !isWaitingForOpponent(holdBooking)) {
    return { recorded: false };
  }
  // Don't count Team A re-hold as demand
  if (String(holdBooking.teamA?.captain) === String(competingCaptainId)) {
    return { recorded: false, reason: 'own_booking' };
  }
  // Don't count already-joined Team B
  if (holdBooking.teamB && String(holdBooking.teamB.captain) === String(competingCaptainId)) {
    return { recorded: false, reason: 'already_team_b' };
  }

  const { demand, created } = await recordDemand({
    userId: competingCaptainId,
    teamId: competingTeamId,
    fieldId: holdBooking.field,
    startTime: holdBooking.startTime,
    endTime: holdBooking.endTime,
    targetBookingId: holdBooking._id,
  });

  const opponentWindow = require('./opponentWindow.service');
  const result = await opponentWindow.onCompetingDemand({
    bookingId: holdBooking._id,
    demandUserId: competingCaptainId,
    isNewDemand: created,
  });

  return { recorded: true, demand, created, ...result };
}

async function findWaitingBookingForSlot(fieldId, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const booking = await Booking.findOne({
    field: fieldId,
    startTime: start,
    endTime: end,
    status: { $in: [BOOKING_STATUS.PAYMENT_PENDING, BOOKING_STATUS.HELD] },
    matchCode: { $exists: true, $ne: null },
    coveredFullMatch: { $ne: true },
  });
  if (!booking || !isWaitingForOpponent(booking)) return null;
  return booking;
}

module.exports = {
  recordDemand,
  countActiveDemands,
  expireStaleDemands,
  onCompetingBookAttempt,
  findWaitingBookingForSlot,
  isWaitingForOpponent,
  isSidePaid,
};
