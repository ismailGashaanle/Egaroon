const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Stadium = require('../models/Stadium');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const managerService = require('./manager.service');
const { notifyStadiumStaff } = require('./notification.service');
const { ROLES } = require('../constants/roles');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');

const ACCEPT_MODES = Object.freeze({ AUTO: 'auto', MANUAL: 'manual' });

function isSidePaid(party) {
  if (!party) return false;
  return (
    party.paymentStatus === PAYMENT_STATUS.SUCCESS ||
    party.paymentStatus === PAYMENT_STATUS.HELD ||
    party.paymentStatus === PAYMENT_STATUS.SETTLED
  );
}

function isBookingFullyPaid(booking) {
  if (booking.coveredFullMatch) return true;
  if (!isSidePaid(booking.teamA)) return false;
  if (!booking.teamB) return false;
  return isSidePaid(booking.teamB);
}

function assertObjectId(id, label = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
}

/**
 * After booking is fully paid and status → CONFIRMED:
 * auto → stamp ownerAcceptedAt; manual → flag needsOwnerAccept.
 * Idempotent if already applied.
 */
async function applyAcceptanceOnFullyPaid(booking) {
  if (!booking || booking.status !== BOOKING_STATUS.CONFIRMED) return booking;
  if (booking.ownerAcceptedAt || booking.needsOwnerAccept) return booking;

  const stadium = await Stadium.findById(booking.stadium).select('bookingAcceptMode name');
  if (!stadium) return booking;

  const mode = stadium.bookingAcceptMode === ACCEPT_MODES.MANUAL ? ACCEPT_MODES.MANUAL : ACCEPT_MODES.AUTO;

  if (mode === ACCEPT_MODES.AUTO) {
    booking.ownerAcceptedAt = new Date();
    booking.needsOwnerAccept = false;
    booking.ownerAcceptedBy = null;
  } else {
    booking.needsOwnerAccept = true;
    booking.ownerAcceptedAt = undefined;
    booking.ownerAcceptedBy = undefined;
  }

  await booking.save();

  if (mode === ACCEPT_MODES.MANUAL) {
    await notifyStadiumStaff({
      stadiumId: booking.stadium,
      type: 'AWAITING_ACCEPTANCE',
      title: 'Sugaya aqbal',
      body: `${stadium.name || 'Garoon'}: ballan la bixiyay — aqbal liiska.`,
      bookingId: booking._id,
      eventKey: `awaiting_accept:${booking._id}`,
      meta: { totalPrice: booking.pricing?.totalPrice },
    });
  }

  return booking;
}

async function listPendingAccepts(user, { stadiumId } = {}) {
  const stadiumIds = await resolveScopedStadiumIds(user, stadiumId);
  if (stadiumIds.length === 0) return [];

  const manualStadiums = await Stadium.find({
    _id: { $in: stadiumIds },
    bookingAcceptMode: ACCEPT_MODES.MANUAL,
  }).select('_id');
  const manualIds = manualStadiums.map((s) => s._id);
  if (manualIds.length === 0) return [];

  return Booking.find({
    stadium: { $in: manualIds },
    needsOwnerAccept: true,
    status: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.CHECKED_IN,
        BOOKING_STATUS.IN_PROGRESS,
      ],
    },
  })
    .populate('field', 'name type')
    .populate('stadium', 'name bookingAcceptMode')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .populate('teamA.captain', 'name phone')
    .populate('teamB.captain', 'name phone')
    .sort({ startTime: 1 })
    .limit(100);
}

async function acceptBooking({ bookingId, user }) {
  assertObjectId(bookingId, 'bookingId');
  const booking = await Booking.findById(bookingId)
    .populate('stadium', 'name bookingAcceptMode owner')
    .populate('field', 'name');
  if (!booking) throw ApiError.notFound('Booking not found');

  await managerService.assertStadiumAccess(booking.stadium._id || booking.stadium, user);

  if (!isBookingFullyPaid(booking) && booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw ApiError.conflict('Both teams must pay before acceptance');
  }

  // Idempotent — already accepted
  if (booking.ownerAcceptedAt && !booking.needsOwnerAccept) {
    return { booking, alreadyAccepted: true };
  }

  booking.ownerAcceptedAt = new Date();
  booking.ownerAcceptedBy = user.id;
  booking.needsOwnerAccept = false;
  await booking.save();

  return { booking, alreadyAccepted: false };
}

async function countPendingAccepts(user) {
  const list = await listPendingAccepts(user);
  return list.length;
}

async function resolveScopedStadiumIds(user, stadiumId) {
  if (stadiumId) {
    assertObjectId(stadiumId, 'stadiumId');
    await managerService.assertStadiumAccess(stadiumId, user);
    return [stadiumId];
  }
  if (user.role === ROLES.STADIUM_MANAGER) {
    return managerService.getManagedStadiumIds(user.id);
  }
  const owned = await Stadium.find({ owner: user.id }).select('_id');
  const managed = await managerService.getManagedStadiumIds(user.id);
  return [...owned.map((s) => s._id), ...managed];
}

module.exports = {
  ACCEPT_MODES,
  applyAcceptanceOnFullyPaid,
  listPendingAccepts,
  acceptBooking,
  countPendingAccepts,
  resolveScopedStadiumIds,
  assertObjectId,
};
