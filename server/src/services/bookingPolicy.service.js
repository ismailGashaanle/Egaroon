const Booking = require('../models/Booking');
const Stadium = require('../models/Stadium');
const Field = require('../models/Field');
const BookingChangeRequest = require('../models/BookingChangeRequest');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { recordAudit } = require('./auditLog.service');
const { notifyUser } = require('./notification.service');
const { emitFieldUpdate } = require('../sockets');

const VENUE_TIMEZONE = 'Africa/Mogadishu'; // East Africa Time (UTC+3)

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function defaultPolicy() {
  return {
    policyStatus: 'PUBLISHED',
    policyVersion: 1,
    publishedAt: new Date(),
    venueTimeZone: VENUE_TIMEZONE,

    // 01 Booking & Availability
    slotDurationMinutes: 60,
    minBookingNoticeMinutes: 30,
    maxBookingAdvanceDays: 30,
    slotBufferMinutes: 0,
    prepTimeMinutes: 0,
    maxSpectators: 50,
    autoConfirm: true,
    manualApproval: false,

    // 02 Pricing & Fees
    depositRequired: false,
    depositPercent: 0,
    depositFixedAmount: 0,
    damageDepositRequired: false,
    damageDepositAmount: 0,
    currency: 'USD',

    // 03 Team Cancellation & Refunds
    cancellationAllowed: true,
    cancelRefundWindowHours: 24,
    cancelRefundPercent: 100,
    cancelRefundTiers: [
      { hoursBefore: 24, refundPercent: 100, label: '> 24 saacadood' },
      { hoursBefore: 12, refundPercent: 75, label: '12 – 24 saacadood' },
      { hoursBefore: 3, refundPercent: 50, label: '3 – 12 saacadood' },
      { hoursBefore: 0, refundPercent: 0, label: '< 3 saacadood' },
    ],
    ownerCancelPenaltyPercent: 100,

    // 04 Rescheduling
    rescheduleAllowed: true,
    freeRescheduleWindowHours: 24,
    rescheduleFee: 0,
    rescheduleFeeCurrency: 'USD',
    maxReschedulesPerBooking: 1,
    minRescheduleNoticeHours: 6,
    ownerRescheduleNoticeHours: 12,

    // 05 Late Arrival & No-Show
    lateArrivalGraceMinutes: 15,
    lateArrivalConsequence: 'time_lost_no_extension',
    lateCheckInRequired: true,
    noShowWaitMinutes: 15,
    noShowRefundPercent: 0,
    noShowReliabilityWarning: true,

    // 06 Owner Cancellation & Service Failure
    ownerServiceFailureRefundPercent: 100,
    ownerCompensateAlternativeSlot: true,
    ownerCancellationNoticeMinHours: 4,

    // 07 Weather & Emergencies
    weatherPolicyType: 'full_refund_or_reschedule',
    weatherRefundPercent: 100,
    emergencyClosureNoticeHours: 1,

    // 08 Damage & Conduct
    pitchDamageEvidenceRequired: true,
    litterCleanFee: 0,
    prohibitedItemsPolicy: 'Sigaarka, hubka, iyo qashinka waa mamnuuc garoonka.',
    bannedFootwearPolicy: 'Kaba biraha leh waa mamnuuc; kaliya kuwa caagga/turf-ka ah ayaa la oggol yahay.',

    // 09 Roster & Team Rules
    minPlayersPerTeam: 5,
    maxPlayersPerTeam: 15,
    substitutesAllowed: true,
    captainChangeAllowed: true,

    // 10 Overtime & Extensions
    overtimeAllowed: true,
    overtimeRequiresNextSlotFree: true,
    overtimeNoticeMinutes: 10,
    overtimeChargePer15Min: 5,

    // 11 Complaints & Disputes
    disputeWindowHours: 24,
    disputeResolutionDays: 3,
    ownerResponseWindowHours: 24,

    // Localized Notices
    policyNoticeSo: 'Beddelka wakhtiga waa bilaash 24 saac ka hor. Wax ka yar 6 saac lama oggola. Kansalashada > 24h waxay leedahay 100% lacag celin.',
    policyNoticeEn: 'Free rescheduling up to 24h before match. Under 6h notice not permitted. Cancellation > 24h eligible for 100% refund.',
    draftPolicy: null,
    policyHistory: [],
  };
}

function validatePolicyBoundaries(policy = {}) {
  if (policy.rescheduleFee != null && Number(policy.rescheduleFee) > 20) {
    throw ApiError.badRequest('Reschedule fee cannot exceed $20.00 (Super Admin boundary)');
  }
  if (policy.ownerCancelPenaltyPercent != null && Number(policy.ownerCancelPenaltyPercent) < 100) {
    throw ApiError.badRequest('Owner cancellation penalty must be at least 100% full refund');
  }
  if (policy.ownerServiceFailureRefundPercent != null && Number(policy.ownerServiceFailureRefundPercent) < 100) {
    throw ApiError.badRequest('Owner service failure must guarantee 100% refund to customer');
  }
  if (policy.minRescheduleNoticeHours != null && Number(policy.minRescheduleNoticeHours) < 1) {
    throw ApiError.badRequest('Minimum reschedule notice cannot be less than 1 hour');
  }
  if (
    policy.lateArrivalGraceMinutes != null &&
    (Number(policy.lateArrivalGraceMinutes) < 5 || Number(policy.lateArrivalGraceMinutes) > 60)
  ) {
    throw ApiError.badRequest('Late arrival grace minutes must be between 5 and 60 minutes');
  }
}

async function getStadiumPolicy(stadiumId) {
  const stadium = await Stadium.findById(stadiumId).select('bookingPolicy name owner city');
  if (!stadium) throw ApiError.notFound('Stadium not found');
  return {
    ...defaultPolicy(),
    ...(stadium.bookingPolicy ? stadium.bookingPolicy.toObject?.() || stadium.bookingPolicy : {}),
  };
}

async function updateStadiumPolicy(stadiumId, user, patch = {}) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');

  // Verify owner or admin
  const isOwner = String(stadium.owner) === String(user.id);
  const isAdmin = ['admin', 'super_admin'].includes(user.role);
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Only the stadium owner can update booking policies');
  }

  validatePolicyBoundaries(patch);

  const current = stadium.bookingPolicy?.toObject?.() || defaultPolicy();
  const updated = { ...current, ...patch };

  stadium.bookingPolicy = updated;
  await stadium.save();

  await recordAudit({
    actorId: user.id,
    action: 'stadium.policy_update',
    entityType: 'Stadium',
    entityId: stadium._id,
    after: updated,
  });

  return updated;
}

async function saveDraftPolicy(stadiumId, user, draft = {}) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');

  const isOwner = String(stadium.owner) === String(user.id);
  const isAdmin = ['admin', 'super_admin'].includes(user.role);
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Only the stadium owner can save draft policies');
  }

  validatePolicyBoundaries(draft);

  const current = stadium.bookingPolicy?.toObject?.() || defaultPolicy();
  current.draftPolicy = {
    ...draft,
    savedAt: new Date(),
    savedBy: user.id,
  };
  current.policyStatus = 'DRAFT';

  stadium.bookingPolicy = current;
  await stadium.save();

  return current;
}

async function publishPolicy(stadiumId, user, patch = {}) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');

  const isOwner = String(stadium.owner) === String(user.id);
  const isAdmin = ['admin', 'super_admin'].includes(user.role);
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Only the stadium owner can publish policies');
  }

  const current = stadium.bookingPolicy?.toObject?.() || defaultPolicy();
  const draft = current.draftPolicy || {};
  const merged = { ...current, ...draft, ...patch };

  validatePolicyBoundaries(merged);

  const nextVersion = (Number(current.policyVersion) || 1) + 1;
  const historyEntry = {
    version: nextVersion,
    publishedAt: new Date(),
    publishedBy: user.id,
    snapshot: merged,
  };

  merged.policyVersion = nextVersion;
  merged.policyStatus = 'PUBLISHED';
  merged.publishedAt = new Date();
  merged.draftPolicy = null;
  merged.policyHistory = [...(current.policyHistory || []), historyEntry];

  stadium.bookingPolicy = merged;
  await stadium.save();

  await recordAudit({
    actorId: user.id,
    action: 'stadium.policy_publish',
    entityType: 'Stadium',
    entityId: stadium._id,
    after: { version: nextVersion, status: 'PUBLISHED' },
  });

  return merged;
}

/** Check if a target slot has collisions with existing active bookings */
async function checkSlotAvailable(fieldId, startTime, endTime, excludeBookingId = null) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const query = {
    field: fieldId,
    status: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.HELD,
        BOOKING_STATUS.PAYMENT_PENDING,
        BOOKING_STATUS.CHECKED_IN,
      ],
    },
    // Overlap condition: start < existing.endTime && end > existing.startTime
    startTime: { $lt: end },
    endTime: { $gt: start },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const collision = await Booking.findOne(query).select('_id startTime endTime status');
  return !collision;
}

/** Create a reschedule request (Owner proposes or Captain requests) */
async function createRescheduleRequest({
  bookingId,
  user,
  proposedDate,
  proposedStartTime,
  proposedEndTime,
  proposedFieldId,
  reason,
}) {
  const booking = await Booking.findById(bookingId).populate('stadium', 'name owner bookingPolicy');
  if (!booking) throw ApiError.notFound('Booking not found');

  if (
    ![
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.HELD,
      BOOKING_STATUS.PAYMENT_PENDING,
    ].includes(booking.status)
  ) {
    throw ApiError.badRequest('Can only reschedule live or confirmed bookings');
  }

  const isCaptain =
    String(booking.teamA.captain) === String(user.id) ||
    (booking.teamB && String(booking.teamB.captain) === String(user.id));
  const isOwner =
    String(booking.stadium.owner) === String(user.id) ||
    ['stadium_manager', 'admin', 'super_admin'].includes(user.role);

  if (!isCaptain && !isOwner) {
    throw ApiError.forbidden('You are not authorized to reschedule this booking');
  }

  const targetField = proposedFieldId || booking.field;

  let targetStart;
  let targetEnd;

  // Support both full ISO timestamp strings and date + HH:mm strings
  if (proposedDate && proposedStartTime && /^\d{1,2}:\d{2}$/.test(String(proposedStartTime).trim())) {
    const [h, m] = String(proposedStartTime).trim().split(':').map(Number);
    targetStart = new Date(`${proposedDate}T00:00:00.000Z`);
    targetStart.setUTCHours(h, m || 0, 0, 0);

    if (proposedEndTime && /^\d{1,2}:\d{2}$/.test(String(proposedEndTime).trim())) {
      const [eh, em] = String(proposedEndTime).trim().split(':').map(Number);
      targetEnd = new Date(`${proposedDate}T00:00:00.000Z`);
      targetEnd.setUTCHours(eh, em || 0, 0, 0);
    } else {
      targetEnd = new Date(targetStart.getTime() + 60 * 60 * 1000);
    }
  } else {
    targetStart = new Date(proposedStartTime);
    targetEnd = new Date(proposedEndTime || new Date(targetStart.getTime() + 60 * 60 * 1000));
  }

  if (Number.isNaN(targetStart.getTime()) || Number.isNaN(targetEnd.getTime())) {
    throw ApiError.badRequest('Invalid proposed start or end time');
  }

  if (targetStart >= targetEnd) {
    throw ApiError.badRequest('Proposed start time must be before end time');
  }

  const { isSlotStartPast } = require('../utils/venueClock');
  if (isSlotStartPast(targetStart)) {
    throw ApiError.badRequest('Cannot reschedule to a past time (Ma dooran kartid waqti hore u dhacay)');
  }

  // Verify target slot is free
  const available = await checkSlotAvailable(targetField, targetStart, targetEnd, booking._id);
  if (!available) {
    throw ApiError.conflict('Waqtiga aad dooratay hore ayaa loo qabsaday (Proposed slot is already booked)');
  }

  const policy = await getStadiumPolicy(booking.stadium._id);
  const hoursUntilMatch = (new Date(booking.startTime) - Date.now()) / (3600 * 1000);

  let feeAmount = 0;
  const requestedBy = isOwner ? 'owner' : 'captain';

  if (requestedBy === 'captain') {
    if (!policy.rescheduleAllowed) {
      throw ApiError.forbidden('Garoonkani ma oggola beddelka wakhtiga (Rescheduling not allowed by stadium)');
    }
    if (hoursUntilMatch < policy.minRescheduleNoticeHours) {
      throw ApiError.badRequest(
        `Waqtiga aad codsatay aad buu ugu dhowyahay ciyaarta. Ugu yaraan ${policy.minRescheduleNoticeHours} saac ayaa loo baahan yahay ka hor inta aan la beddelin.`
      );
    }
    if (hoursUntilMatch < policy.freeRescheduleWindowHours) {
      feeAmount = roundMoney(policy.rescheduleFee || 0);
    }
  }

  // Cancel any existing pending change request for this booking
  await BookingChangeRequest.updateMany(
    { booking: booking._id, status: 'PENDING' },
    { $set: { status: 'CANCELLED' } }
  );

  const expiresAt = new Date(Math.min(targetStart.getTime(), Date.now() + 6 * 3600 * 1000));

  const changeRequest = await BookingChangeRequest.create({
    booking: booking._id,
    stadium: booking.stadium._id,
    type: 'reschedule',
    requestedBy,
    requester: user.id,
    currentSlot: {
      field: booking.field,
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
    proposedSlot: {
      field: targetField,
      startTime: targetStart,
      endTime: targetEnd,
    },
    reason: reason || (isOwner ? 'Isbeddel dhinaca garoonka ah' : 'Kooxda oo codsatay wakhti kale'),
    policySnapshot: {
      freeRescheduleWindowHours: policy.freeRescheduleWindowHours,
      rescheduleFee: policy.rescheduleFee,
      rescheduleFeeCurrency: policy.rescheduleFeeCurrency,
      minRescheduleNoticeHours: policy.minRescheduleNoticeHours,
      cancelRefundPercent: policy.cancelRefundPercent,
    },
    feeAmount,
    status: 'PENDING',
    expiresAt,
  });

  // Notify the other party
  if (requestedBy === 'owner') {
    // Notify Captain that Owner requested a change
    await notifyUser({
      userId: booking.teamA.captain,
      type: 'BOOKING_RESCHEDULE_PROPOSED',
      title: 'Codsi: Waqti cusub oo garoonka ah',
      body: `${booking.stadium.name}: Milkiiluhu wuxuu soo jeediyay in ciyaarta loo wareejiyo ${targetStart.toLocaleDateString()} ${targetStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Fadlan aqbal ama diid.`,
      bookingId: booking._id,
      meta: {
        changeRequestId: String(changeRequest._id),
        proposedStart: targetStart.toISOString(),
      },
    });
    if (booking.teamB?.captain) {
      await notifyUser({
        userId: booking.teamB.captain,
        type: 'BOOKING_RESCHEDULE_PROPOSED',
        title: 'Codsi: Waqti cusub oo garoonka ah',
        body: `${booking.stadium.name}: Milkiiluhu wuxuu soo jeediyay in ciyaarta loo wareejiyo ${targetStart.toLocaleDateString()}.`,
        bookingId: booking._id,
        meta: {
          changeRequestId: String(changeRequest._id),
          proposedStart: targetStart.toISOString(),
        },
      });
    }
  } else {
    // Notify Owner that Captain requested a change
    await notifyUser({
      userId: booking.stadium.owner,
      type: 'BOOKING_RESCHEDULE_REQUESTED',
      title: 'Kabtan ayaa codsaday beddel wakhti',
      body: `Kabtanka ayaa codsaday in ciyaarta loo wareejiyo ${targetStart.toLocaleDateString()} ${targetStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      bookingId: booking._id,
      meta: {
        changeRequestId: String(changeRequest._id),
        proposedStart: targetStart.toISOString(),
      },
    });
  }

  emitFieldUpdate(String(booking.field), 'booking:reschedule_requested', {
    bookingId: booking._id,
    changeRequestId: changeRequest._id,
  });

  return changeRequest;
}

/** Respond to a change request (Accept or Reject) */
async function respondToChangeRequest({ requestId, user, action, responseNote }) {
  const changeRequest = await BookingChangeRequest.findById(requestId);
  if (!changeRequest) throw ApiError.notFound('Change request not found');

  if (changeRequest.status !== 'PENDING') {
    throw ApiError.conflict(`This request has already been ${changeRequest.status.toLowerCase()}`);
  }

  if (changeRequest.expiresAt && changeRequest.expiresAt < new Date()) {
    changeRequest.status = 'EXPIRED';
    await changeRequest.save();
    throw ApiError.conflict('This change request has expired');
  }

  const booking = await Booking.findById(changeRequest.booking).populate('stadium', 'name owner');
  if (!booking) throw ApiError.notFound('Associated booking not found');

  const isCaptain =
    String(booking.teamA.captain) === String(user.id) ||
    (booking.teamB && String(booking.teamB.captain) === String(user.id));
  const isOwner =
    String(booking.stadium.owner) === String(user.id) ||
    ['stadium_manager', 'admin', 'super_admin'].includes(user.role);

  // If requested by Owner, only Captain can respond (or admin)
  if (changeRequest.requestedBy === 'owner' && !isCaptain && user.role !== 'super_admin') {
    throw ApiError.forbidden('Only the team captain can accept or reject an owner reschedule request');
  }

  // If requested by Captain, only Owner can respond (or admin)
  if (changeRequest.requestedBy === 'captain' && !isOwner && user.role !== 'super_admin') {
    throw ApiError.forbidden('Only the stadium owner can respond to a captain reschedule request');
  }

  if (action === 'REJECT') {
    changeRequest.status = 'REJECTED';
    changeRequest.respondedBy = user.id;
    changeRequest.respondedAt = new Date();
    changeRequest.responseNote = responseNote || 'Codsiga waa la diiday (Request rejected)';
    await changeRequest.save();

    await recordAudit({
      actorId: user.id,
      action: 'booking.reschedule_rejected',
      entityType: 'BookingChangeRequest',
      entityId: changeRequest._id,
      after: { status: 'REJECTED', responseNote },
    });

    return { changeRequest, booking, shifted: false };
  }

  if (action === 'ACCEPT') {
    // Re-verify slot availability atomically
    const available = await checkSlotAvailable(
      changeRequest.proposedSlot.field,
      changeRequest.proposedSlot.startTime,
      changeRequest.proposedSlot.endTime,
      booking._id
    );

    if (!available) {
      changeRequest.status = 'EXPIRED';
      changeRequest.responseNote = 'Slot is no longer available';
      await changeRequest.save();
      throw ApiError.conflict('Waqtiga la soo jeediyay hadda ma bannaana (Proposed slot is no longer available)');
    }

    // Atomically shift booking to the new slot
    const prevField = booking.field;
    booking.field = changeRequest.proposedSlot.field;
    booking.startTime = changeRequest.proposedSlot.startTime;
    booking.endTime = changeRequest.proposedSlot.endTime;
    await booking.save();

    changeRequest.status = 'ACCEPTED';
    changeRequest.respondedBy = user.id;
    changeRequest.respondedAt = new Date();
    changeRequest.responseNote = responseNote || 'Waa la aqbalay (Accepted)';
    await changeRequest.save();

    await recordAudit({
      actorId: user.id,
      action: 'booking.reschedule_accepted',
      entityType: 'Booking',
      entityId: booking._id,
      before: {
        field: prevField,
        startTime: changeRequest.currentSlot.startTime,
        endTime: changeRequest.currentSlot.endTime,
      },
      after: {
        field: booking.field,
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
    });

    // Notify both parties
    const startIso = changeRequest.proposedSlot.startTime.toLocaleString();
    await notifyUser({
      userId: booking.teamA.captain,
      type: 'BOOKING_RESCHEDULE_CONFIRMED',
      title: 'Waqtiga ciyaarta waa la beddelay',
      body: `${booking.stadium.name}: Ballanta cusub waa ${startIso}.`,
      bookingId: booking._id,
    });

    if (booking.teamB?.captain) {
      await notifyUser({
        userId: booking.teamB.captain,
        type: 'BOOKING_RESCHEDULE_CONFIRMED',
        title: 'Waqtiga ciyaarta waa la beddelay',
        body: `${booking.stadium.name}: Ballanta cusub waa ${startIso}.`,
        bookingId: booking._id,
      });
    }

    emitFieldUpdate(String(prevField), 'booking:updated', { bookingId: booking._id });
    emitFieldUpdate(String(booking.field), 'booking:updated', { bookingId: booking._id });

    return { changeRequest, booking, shifted: true };
  }

  throw ApiError.badRequest('Action must be ACCEPT or REJECT');
}

/** Cancel booking honoring stadium cancellation policy */
async function cancelBookingWithPolicy({ bookingId, user, reason }) {
  const booking = await Booking.findById(bookingId).populate('stadium', 'name owner bookingPolicy');
  if (!booking) throw ApiError.notFound('Booking not found');

  const isCaptain =
    String(booking.teamA.captain) === String(user.id) ||
    (booking.teamB && String(booking.teamB.captain) === String(user.id));
  const isOwner =
    String(booking.stadium.owner) === String(user.id) ||
    ['stadium_manager', 'admin', 'super_admin'].includes(user.role);

  if (!isCaptain && !isOwner) {
    throw ApiError.forbidden('Not authorized to cancel this booking');
  }

  const policy = await getStadiumPolicy(booking.stadium._id);
  const hoursUntilMatch = (new Date(booking.startTime) - Date.now()) / (3600 * 1000);

  let refundPercent = 0;
  let cancellationType = 'captain_initiated';

  if (isOwner) {
    // Owner breach: 100% full refund to Captain + credit note
    cancellationType = 'owner_initiated_breach';
    refundPercent = 100;
  } else {
    // Captain cancellation: governed by policy
    if (hoursUntilMatch >= policy.cancelRefundWindowHours) {
      refundPercent = policy.cancelRefundPercent || 100;
    } else {
      refundPercent = 0; // Late cancellation forfeits rent
    }
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledBy = user.id;
  booking.cancelReason = `${cancellationType}: ${reason || 'Cancelled'}`;
  await booking.save();

  await recordAudit({
    actorId: user.id,
    action: 'booking.cancel_with_policy',
    entityType: 'Booking',
    entityId: booking._id,
    after: {
      cancellationType,
      refundPercent,
      hoursUntilMatch: Math.round(hoursUntilMatch * 10) / 10,
    },
  });

  emitFieldUpdate(String(booking.field), 'booking:updated', {
    bookingId: booking._id,
    status: BOOKING_STATUS.CANCELLED,
  });

  return {
    booking,
    refundPercent,
    cancellationType,
  };
}

async function listChangeRequestsForBooking(bookingId) {
  return BookingChangeRequest.find({ booking: bookingId })
    .populate('requester', 'name phone')
    .populate('respondedBy', 'name phone')
    .populate('proposedSlot.field', 'name type')
    .populate('currentSlot.field', 'name type')
    .sort({ createdAt: -1 })
    .lean();
}

async function listOwnerChangeRequests(ownerId) {
  const stadiums = await Stadium.find({ owner: ownerId }).select('_id');
  const stadiumIds = stadiums.map((s) => s._id);

  return BookingChangeRequest.find({ stadium: { $in: stadiumIds } })
    .populate('booking', 'bookingCode matchCode startTime endTime pricing status')
    .populate('requester', 'name phone')
    .populate('proposedSlot.field', 'name type')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

module.exports = {
  VENUE_TIMEZONE,
  getStadiumPolicy,
  updateStadiumPolicy,
  saveDraftPolicy,
  publishPolicy,
  createRescheduleRequest,
  respondToChangeRequest,
  cancelBookingWithPolicy,
  listChangeRequestsForBooking,
  listOwnerChangeRequests,
};
