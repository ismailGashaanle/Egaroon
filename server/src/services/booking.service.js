const Booking = require('../models/Booking');
const Field = require('../models/Field');
const User = require('../models/User');
const Team = require('../models/Team');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const ApiError = require('../utils/ApiError');
const { setNxEx, del: redisDel } = require('../config/redis');
const { calculatePriceForSlot, splitBetweenTeams, playersPerSide } = require('./pricing.service');
const { BOOKING_STATUS, BOOKING_TRANSITIONS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const { emitFieldUpdate } = require('../sockets');
const env = require('../config/env');
const { getOrCreateDefaultTeam } = require('./team.service');
const { notifyUser } = require('./notification.service');
const { normalizeSomaliPhone, phoneLookupVariants, detectCarrier, formatDisplay } = require('../utils/somaliPhone');
const {
  generateBookingCode,
  slotTimeState,
  formatLocal,
  buildQrPayload,
} = require('../utils/bookingPass');
const managerService = require('./manager.service');
const { ROLES } = require('../constants/roles');
const { haversineKm } = require('../utils/geo');
const Stadium = require('../models/Stadium');
const { getBusiness, ownerCanSeeCommission } = require('./platformSettings.service');
const { isSlotStartPast } = require('../utils/venueClock');

const SLOT_PAST_DETAILS = {
  code: 'SLOT_PAST',
  messageEn: 'Cannot book a slot in the past',
  messageSo: 'Waqtigani wuu dhacay — dooro saacad mustaqbal ah',
};

function lockKey(fieldId, startTime) {
  return `slot-lock:${fieldId}:${new Date(startTime).toISOString()}`;
}

/** Hide platform commission amount/% on owner-facing booking payloads (BR-009d). */
function redactCommissionOnBooking(booking) {
  if (!booking) return booking;
  const obj = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  obj.commissionAmount = null;
  obj.commissionPercent = null;
  return obj;
}

function bookingForOwner(user, booking) {
  return ownerCanSeeCommission(user) ? booking : redactCommissionOnBooking(booking);
}

function contactKulansiiyeHint() {
  const support = getBusiness().support || {};
  const phone = support.phone || '0610000000';
  const email = support.email || 'support@egaroon.com';
  return `Fadlan la xiriir kooxda E-Garoon: ${phone} ama ${email}`;
}

function normPlace(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Team B must be local enough vs the match stadium (GPS and/or city/region).
 */
async function assertInviteDistanceOk({ booking, teamBCaptainId, teamBId }) {
  const stadium = await Stadium.findById(booking.stadium).select('city region area latLng name');
  if (!stadium) return;

  const captain = await User.findById(teamBCaptainId).select('city region area latLng name');
  const team = await Team.findById(teamBId).select('city region name');

  const sCity = normPlace(stadium.city);
  const sRegion = normPlace(stadium.region);
  const bCity = normPlace(captain?.city || team?.city);
  const bRegion = normPlace(captain?.region || team?.region);

  const maxKm = Number(getBusiness().maxMatchDistanceKm) || 30;
  const sLat = stadium.latLng?.lat;
  const sLng = stadium.latLng?.lng;
  const bLat = captain?.latLng?.lat;
  const bLng = captain?.latLng?.lng;

  if (sLat != null && sLng != null && bLat != null && bLng != null) {
    const km = haversineKm(sLat, sLng, bLat, bLng);
    if (km > maxKm) {
      throw ApiError.badRequest(
        `Kooxaha aad u fog yihiin (~${km.toFixed(0)} km > ${maxKm} km). Lama isku ciyaari karo. ${contactKulansiiyeHint()}`,
        { code: 'MATCH_TOO_FAR', distanceKm: km, maxKm, contact: getBusiness().support }
      );
    }
    return;
  }

  // No GPS: block clearly different city+region
  if (sCity && bCity && sCity !== bCity) {
    const sameRegion = sRegion && bRegion && sRegion === bRegion;
    if (!sameRegion) {
      throw ApiError.badRequest(
        `Kooxda kale waa magaalad/gobol kale (${bCity || 'unknown'} ≠ ${sCity}). Lama isku ciyaari karo. ${contactKulansiiyeHint()}`,
        { code: 'MATCH_DIFFERENT_CITY', contact: getBusiness().support }
      );
    }
  }
}

const LIVE_HOLD_STATUSES = [BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING];

const LIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.PAYMENT_PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
];

const BOOKED_LOCKED_STATUSES = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
];

/** Same due fields as slot.service classifyBookingSlot (selectedUntil). */
function resolveHoldDue(booking) {
  return (
    booking.teamBPaymentDueAt ||
    booking.holdExpiresAt ||
    booking.teamB?.paymentDeadline ||
    booking.teamA?.paymentDeadline ||
    null
  );
}

/**
 * HELD / PAYMENT_PENDING past deadline (or orphan with no deadline past hold window).
 * Matches slot grid "available" for expired soft-locks so createHold can reclaim.
 * Team A–paid opponent windows are NOT soft-expired here — demand evaluation owns release.
 */
function isSoftExpiredHold(booking) {
  if (!LIVE_HOLD_STATUSES.includes(booking.status)) return false;

  const { isSidePaid } = require('./payment.service');
  const teamAPaid = isSidePaid(booking.teamA) || Boolean(booking.teamAPaidAt);
  if (teamAPaid && !booking.coveredFullMatch && (!booking.teamB || !isSidePaid(booking.teamB))) {
    // Demand-based window — never soft-expire purely by clock; evaluateOpponentWindow releases.
    return false;
  }

  const now = Date.now();
  const due = resolveHoldDue(booking);
  if (due) return new Date(due).getTime() <= now;
  // Stuck live hold with no deadline — free after configured hold minutes from createdAt.
  const holdMs = (getBusiness().bookingHoldMinutes || 10) * 60 * 1000;
  const created = booking.createdAt ? new Date(booking.createdAt).getTime() : 0;
  return created > 0 && created + holdMs <= now;
}

function conflictForOverlap(booking, captainId = null, extra = {}) {
  let messageEn = 'This slot is already booked';
  let messageSo = 'Slot-kan waa la kiraystay — dooro waqti kale';
  let code = 'SLOT_BOOKED';

  if (
    captainId &&
    booking?.teamA?.captain &&
    String(booking.teamA.captain) === String(captainId) &&
    BOOKED_LOCKED_STATUSES.includes(booking.status)
  ) {
    messageEn =
      'You already booked this slot (confirmed/paid). Pick another time or open My Bookings.';
    messageSo =
      'Adiga ayaa hore u kiraystay slot-kan. Dooro waqti kale ama fur My Bookings.';
    code = 'SLOT_OWNED';
  } else if (BOOKED_LOCKED_STATUSES.includes(booking.status)) {
    messageEn = 'This slot is already booked';
    messageSo = 'Slot-kan waa la kiraystay (la doortay oo la bixiyay) — dooro waqti kale';
    code = 'SLOT_BOOKED';
  } else if (LIVE_HOLD_STATUSES.includes(booking.status)) {
    const { isSidePaid } = require('./payment.service');
    const waitingOpp =
      (isSidePaid(booking.teamA) || booking.teamAPaidAt) &&
      !booking.coveredFullMatch &&
      (!booking.teamB || !isSidePaid(booking.teamB));
    if (waitingOpp) {
      messageEn =
        'This slot is held while Team B pays (Match Code window). Your book attempt was recorded as demand.';
      messageSo =
        'Slot-kan waa la hayaa — Team B lacag bixinayo (Match Code). Isku daygaaga waa demand.';
      code = 'SLOT_OPPONENT_WINDOW';
    } else {
      messageEn =
        'This slot is currently on hold by another captain. Try again when the hold expires, or pick another time.';
      messageSo =
        'Slot-kan waa la doortay (hold) — sug waqtiga uu dhaco ama dooro waqti kale';
      code = 'SLOT_HELD';
    }
  }

  return ApiError.conflict(messageEn, {
    code,
    messageEn,
    messageSo,
    ...extra,
  });
}

/** @deprecated prefer conflictForOverlap — kept for any external string callers */
function conflictMessageForOverlap(booking, captainId = null) {
  return conflictForOverlap(booking, captainId).message;
}

function logBookingConflict(context, booking, extra = {}) {
  if (!booking) {
    console.warn(`[${context}] conflict with no document`, extra);
    return;
  }
  console.warn(`[${context}] conflicting booking`, {
    id: String(booking._id),
    status: booking.status,
    start: booking.startTime,
    end: booking.endTime,
    holdExpiresAt: booking.holdExpiresAt,
    teamBPaymentDueAt: booking.teamBPaymentDueAt,
    teamADeadline: booking.teamA?.paymentDeadline,
    partialPaymentTimeoutAt: booking.partialPaymentTimeoutAt,
    captain: booking.teamA?.captain ? String(booking.teamA.captain) : null,
    ...extra,
  });
}

/** Legacy Atlas index `bookingId_1` (unique, non-sparse) — missing field counts as null. */
function isOrphanBookingIdDup(err) {
  if (!err || err.code !== 11000) return false;
  if (err.keyPattern && Object.prototype.hasOwnProperty.call(err.keyPattern, 'bookingId')) {
    return true;
  }
  if (err.keyValue && Object.prototype.hasOwnProperty.call(err.keyValue, 'bookingId')) {
    return true;
  }
  const msg = String(err.message || '');
  return /index:\s*bookingId_1\b/i.test(msg) || /dup key:.*bookingId/i.test(msg);
}

function isSlotUniqueDup(err) {
  if (!err || err.code !== 11000 || !err.keyPattern) return false;
  const keys = Object.keys(err.keyPattern);
  return keys.includes('field') && keys.includes('startTime') && keys.includes('endTime');
}

function isBookingCodeDup(err) {
  if (!err || err.code !== 11000) return false;
  if (err.keyPattern && err.keyPattern.bookingCode) return true;
  if (err.keyValue && Object.prototype.hasOwnProperty.call(err.keyValue, 'bookingCode')) return true;
  return /index:\s*bookingCode_1\b/i.test(String(err.message || ''));
}

async function withSlotLock(fieldId, startTime, fn) {
  const key = lockKey(fieldId, startTime);
  // Redis when available; otherwise in-memory Map (dev / REDIS_ENABLED=false).
  const acquired = await setNxEx(key, 15, '1');
  if (!acquired) {
    throw ApiError.conflict('This slot is currently being booked by someone else, please try again');
  }
  try {
    return await fn();
  } finally {
    await redisDel(key);
  }
}

async function maybeRecordCompetingDemand(holdBooking, captainId, teamId) {
  if (!holdBooking || !captainId || !teamId) return null;
  try {
    const slotDemand = require('./slotDemand.service');
    if (!slotDemand.isWaitingForOpponent(holdBooking)) return null;
    return await slotDemand.onCompetingBookAttempt({
      competingCaptainId: captainId,
      competingTeamId: teamId,
      holdBooking,
    });
  } catch (err) {
    console.warn('[demand] record failed', err.message);
    return null;
  }
}

async function throwOverlapWithDemand(holdBooking, captainId, teamId) {
  const demandResult = await maybeRecordCompetingDemand(holdBooking, captainId, teamId);
  if (demandResult?.released) {
    throw ApiError.conflict(
      demandResult.toast?.messageEn ||
        'This slot was released after competing demand. Try booking again as a new Team A.',
      {
        code: demandResult.toast?.code || 'SLOT_TAKEN_DEMAND',
        messageEn: demandResult.toast?.messageEn,
        messageSo: demandResult.toast?.messageSo,
        demand: true,
      }
    );
  }
  throw conflictForOverlap(holdBooking, captainId, {
    demandRecorded: Boolean(demandResult?.recorded),
    competingAttemptCount: demandResult?.alertLevel,
    toast: demandResult?.toast,
  });
}

async function assertSlotIsFree(fieldId, startTime, endTime, { captainId = null, teamId = null } = {}) {
  if (isSlotStartPast(startTime)) {
    throw ApiError.badRequest('Cannot book a slot in the past', SLOT_PAST_DETAILS);
  }

  const fieldMeta = await Field.findById(fieldId).select('stadium').lean();
  const stadiumId = fieldMeta?.stadium || null;
  const { findOverlappingBlock } = require('./availability.service');
  const overlappingBlock = await findOverlappingBlock(fieldId, stadiumId, startTime, endTime);
  if (overlappingBlock) {
    const label =
      overlappingBlock.scope === 'stadium'
        ? 'stadium locked'
        : overlappingBlock.type || 'blocked';
    throw ApiError.conflict(
      `Slot is blocked (${label}): ${overlappingBlock.reason || ''}`.trim()
    );
  }

  const { findOverlappingRecurring, teamDisplayName } = require('./recurring.service');
  const overlappingRecurring = await findOverlappingRecurring(fieldId, startTime, endTime);
  if (overlappingRecurring) {
    const team = teamDisplayName(overlappingRecurring);
    throw ApiError.conflict(`Slot is reserved for weekly team (${team})`, {
      code: 'RECURRING_SLOT',
      teamName: overlappingRecurring.teamName || team,
      messageSo: `Waqtiga waxaa haysta koox toddobaadle ah (${team})`,
    });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  const findOverlap = () =>
    Booking.findOne({
      field: fieldId,
      startTime: { $lt: end },
      endTime: { $gt: start },
      status: { $in: LIVE_BOOKING_STATUSES },
    });

  // Expire every soft-stale overlap (slot UI may already show green available).
  // Loop covers stacked / stuck holds Atlas didn't expire yet.
  // CANCELLED / EXPIRED are excluded from LIVE_BOOKING_STATUSES and the partial unique index.
  for (let i = 0; i < 5; i += 1) {
    const overlappingBooking = await findOverlap();
    if (!overlappingBooking) return;
    if (!isSoftExpiredHold(overlappingBooking)) {
      logBookingConflict('assertSlotIsFree', overlappingBooking, { fieldId: String(fieldId) });
      await throwOverlapWithDemand(overlappingBooking, captainId, teamId);
    }
    const expired = await expireBookingHoldNow(overlappingBooking);
    if (!expired) {
      // Could not claim — still live → hard conflict (may be demand-protected window)
      const again = await findOverlap();
      if (again) {
        logBookingConflict('assertSlotIsFree', again, { fieldId: String(fieldId), reclaimFailed: true });
        await throwOverlapWithDemand(again, captainId, teamId);
      }
      return;
    }
  }

  const leftover = await findOverlap();
  if (leftover) {
    logBookingConflict('assertSlotIsFree', leftover, { fieldId: String(fieldId), leftover: true });
    await throwOverlapWithDemand(leftover, captainId, teamId);
  }
}

/** Force-expire one hold when its deadline has passed (used when another captain books). */
async function expireBookingHoldNow(booking) {
  const { isBookingFullyPaid, isSidePaid, refundTeamAPaymentsForBooking } = require('./payment.service');
  if (isBookingFullyPaid(booking) || booking.status === BOOKING_STATUS.CONFIRMED) return null;

  const teamAWasPaid = isSidePaid(booking.teamA) || Boolean(booking.teamAPaidAt);
  const waitingOnTeamB =
    teamAWasPaid && !booking.coveredFullMatch && (!booking.teamB || !isSidePaid(booking.teamB));

  // Demand-based: do not hard-expire — evaluate (may extend / final grace / release)
  if (waitingOnTeamB) {
    const opponentWindow = require('./opponentWindow.service');
    const result = await opponentWindow.evaluateOpponentWindow(booking);
    if (result?.released) return result.booking;
    return null;
  }

  const autoRefund = getBusiness().autoRefundTeamAOnTeamBTimeout !== false;
  const now = new Date();

  // Do not require partialPaymentTimeoutAt unset — stuck docs with that flag but still HELD
  // must still be reclaimable. Use $unset so Atlas clears deadline fields (undefined in $set is a no-op).
  const claimed = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: { $in: LIVE_HOLD_STATUSES },
    },
    {
      $set: {
        status: BOOKING_STATUS.EXPIRED,
        partialPaymentTimeoutAt: now,
        cancelReason: waitingOnTeamB ? 'team_b_payment_timeout' : 'hold_expired',
      },
      $unset: {
        holdExpiresAt: 1,
        teamBPaymentDueAt: 1,
      },
    },
    { returnDocument: 'after' }
  );
  if (!claimed) return null;

  if (autoRefund && teamAWasPaid && !claimed.coveredFullMatch) {
    try {
      await refundTeamAPaymentsForBooking(claimed._id);
    } catch (err) {
      console.warn('[expire-now] Team A refund failed', claimed._id.toString(), err.message);
    }
  }

  emitFieldUpdate(claimed.field.toString(), 'booking:updated', {
    bookingId: claimed._id,
    status: claimed.status,
  });
  return claimed;
}

/** Active hold for this captain on the exact slot — return for idempotent re-hold. */
async function findCaptainActiveHold({ fieldId, startTime, endTime, captainId }) {
  return Booking.findOne({
    field: fieldId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: { $in: LIVE_HOLD_STATUSES },
    'teamA.captain': captainId,
  });
}

async function resolveTeamForCaptain({ captainId, teamId, teamName }) {
  if (teamId) {
    const team = await Team.findById(teamId);
    if (!team) throw ApiError.notFound('Team not found');
    if (team.captain.toString() !== captainId) {
      throw ApiError.forbidden('Only the team captain can act on behalf of this team');
    }
    return team;
  }
  return getOrCreateDefaultTeam(captainId, teamName);
}

async function createHold({ fieldId, stadiumId, captainId, teamId, teamName, playersCount, startTime, endTime }) {
  if (!fieldId) {
    throw ApiError.badRequest('fieldId is required');
  }
  if (!startTime || !endTime) {
    throw ApiError.badRequest('startTime and endTime are required (ISO datetimes)');
  }
  if (new Date(startTime) >= new Date(endTime)) {
    throw ApiError.badRequest('startTime must be before endTime');
  }
  if (isSlotStartPast(startTime)) {
    throw ApiError.badRequest('Cannot book a slot in the past', SLOT_PAST_DETAILS);
  }

  const field = await Field.findById(fieldId);
  if (!field || field.status !== 'active') {
    throw ApiError.notFound('Field not found or inactive');
  }

  // Field owns stadium — client stadiumId is optional (ignored if mismatched).
  const resolvedStadiumId = field.stadium;

  const stadiumDoc = await Stadium.findById(resolvedStadiumId);
  if (!stadiumDoc || stadiumDoc.status !== 'approved') {
    throw ApiError.notFound('Stadium not found or not yet available');
  }
  const { assertStadiumAndFieldBookable } = require('../utils/fieldAvailability');
  assertStadiumAndFieldBookable(stadiumDoc, field);
  const { assertStadiumSubscriptionActive } = require('./stadiumSubscription.service');
  await assertStadiumSubscriptionActive(resolvedStadiumId);

  const team = await resolveTeamForCaptain({ captainId, teamId, teamName });
  // Always full field size (7v7 → 7 per side). Client cannot underfill for a cheaper price.
  const perSide = playersPerSide(field);

  const start = new Date(startTime);
  const end = new Date(endTime);

  return withSlotLock(fieldId, start, async () => {
    // Idempotent: same captain re-holding the same slot returns the existing live hold
    // (double-tap / back-then-retry) instead of a confusing "already booked".
    const mine = await findCaptainActiveHold({
      fieldId,
      startTime: start,
      endTime: end,
      captainId,
    });
    if (mine) {
      if (isSoftExpiredHold(mine)) {
        await expireBookingHoldNow(mine);
      } else {
        // Ensure active finance snapshot and platform fee dues are synchronized on existing hold
        try {
          const bookingFinance = require('./bookingFinance.service');
          const price = await calculatePriceForSlot({ field, startTime: start });
          const finance = await bookingFinance.buildForStadium(resolvedStadiumId, {
            rentTotal: price.totalPrice,
            teamShare: price.teamShare,
          });
          let changed = false;
          if (
            !mine.financialSnapshot ||
            !mine.pricing?.payableTeamShare ||
            !mine.pricing?.platformFee ||
            mine.teamA?.amountDue !== finance.dues.teamADue
          ) {
            mine.financialSnapshot = finance.snapshot;
            mine.pricing = {
              ...(mine.pricing?.toObject ? mine.pricing.toObject() : mine.pricing),
              stadiumRentTotal: price.totalPrice,
              payableTeamShare: finance.dues.payableTeamShare,
              payableFullMatch: finance.dues.payableFullMatch,
              platformFee: finance.dues.platformFeeTeamA,
              platformFeeFullMatch: finance.dues.platformFeeFullMatch,
            };
            if (mine.teamA && mine.teamA.paymentStatus === PAYMENT_STATUS.PENDING) {
              mine.teamA.amountDue = finance.dues.teamADue;
            }
            changed = true;
          }
          if (changed) {
            await mine.save();
          }
        } catch (syncErr) {
          console.warn('[createHold] sync existing hold finance failed:', syncErr.message);
        }
        return mine;
      }
    }

    await assertSlotIsFree(fieldId, start, end, { captainId, teamId: team._id });

    const price = await calculatePriceForSlot({ field, startTime: start });
    const teamShare = price.teamShare;
    // Team A owes their half by default; they can also "pay full match" at checkout.
    const { teamAShare } = splitBetweenTeams(price.totalPrice, true, teamShare);
    const bookingFinance = require('./bookingFinance.service');
    const finance = await bookingFinance.buildForStadium(resolvedStadiumId, {
      rentTotal: price.totalPrice,
      teamShare,
    });

    const holdExpiresAt = new Date(Date.now() + getBusiness().bookingHoldMinutes * 60 * 1000);

    const createDoc = () =>
      Booking.create({
        field: fieldId,
        stadium: resolvedStadiumId,
        startTime: start,
        endTime: end,
        status: BOOKING_STATUS.HELD,
        pricing: {
          mode: price.mode,
          unitPrice: price.unitPrice,
          totalPrice: price.totalPrice,
          teamShare,
          baseTotalPrice: price.baseTotalPrice ?? price.totalPrice,
          discountAmount: price.discountAmount || 0,
          discountPercent: price.discountPercent ?? undefined,
          discountId: price.discountId || undefined,
          discountName: price.discountName || undefined,
          currency: price.currency,
          stadiumRentTotal: price.totalPrice,
          payableTeamShare: finance.dues.payableTeamShare,
          payableFullMatch: finance.dues.payableFullMatch,
          platformFee: finance.dues.platformFeeTeamA,
          platformFeeFullMatch: finance.dues.platformFeeFullMatch,
        },
        financialSnapshot: finance.snapshot,
        commissionPercent: finance.snapshot.commissionEnabled ? finance.snapshot.commissionPercent : 0,
        bookingCode: generateBookingCode(),
        teamA: {
          team: team._id,
          captain: captainId,
          playersCount: perSide,
          amountDue: finance.dues.teamADue,
          paymentStatus: PAYMENT_STATUS.PENDING,
          paymentDeadline: holdExpiresAt,
        },
        holdExpiresAt,
      });

    async function resolveDuplicateKey(err) {
      console.warn('[createHold] E11000', {
        keyPattern: err.keyPattern,
        keyValue: err.keyValue,
        fieldId: String(fieldId),
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (isOrphanBookingIdDup(err)) {
        // Startup should drop bookingId_1; if still present, fail loudly (not "slot booked").
        const { dropOrphanBookingIndexes } = require('../config/mongoIndexes');
        await dropOrphanBookingIndexes();
        try {
          return await createDoc();
        } catch (retryErr) {
          if (isOrphanBookingIdDup(retryErr)) {
            throw ApiError.internal(
              'Booking store has a legacy unique index (bookingId). Restart the server or run: node scripts/drop-orphan-booking-indexes.js'
            );
          }
          throw retryErr;
        }
      }

      if (isBookingCodeDup(err)) {
        // Extremely rare code collision — retry once with a fresh code.
        return createDoc();
      }

      if (!isSlotUniqueDup(err)) {
        // Never misreport unrelated unique indexes as "slot already booked".
        throw ApiError.conflict(
          `Could not create booking (duplicate key ${JSON.stringify(err.keyPattern || err.keyValue || {})}). Try again.`
        );
      }

      // Unique partial index race: reclaim soft-expired clash or return own hold.
      const clash = await Booking.findOne({
        field: fieldId,
        startTime: start,
        endTime: end,
        status: { $in: LIVE_BOOKING_STATUSES },
      });
      logBookingConflict('createHold-11000', clash, {
        fieldId: String(fieldId),
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (!clash) {
        // Diagnose EXPIRED/CANCELLED exact-time docs (should NOT hit partial unique index).
        const anyExact = await Booking.findOne({
          field: fieldId,
          startTime: start,
          endTime: end,
        }).select('status startTime endTime holdExpiresAt');
        logBookingConflict('createHold-11000-anyExact', anyExact, {
          fieldId: String(fieldId),
          note: 'no live clash — check unique index partial filter',
        });
        throw ApiError.conflict(
          'This slot could not be reserved due to a database conflict. If this persists, run maintenance expire/force-clear holds and restart the API.'
        );
      }
      if (String(clash.teamA?.captain) === String(captainId) && !isSoftExpiredHold(clash)) {
        return clash;
      }
      if (isSoftExpiredHold(clash)) {
        await expireBookingHoldNow(clash);
        return createDoc();
      }
      await throwOverlapWithDemand(clash, captainId, team._id);
    }

    try {
      let booking;
      try {
        booking = await createDoc();
      } catch (err) {
        if (err.code !== 11000) throw err;
        booking = await resolveDuplicateKey(err);
      }

      emitFieldUpdate(fieldId.toString(), 'booking:updated', {
        bookingId: booking._id,
        status: booking.status,
        startTime: start,
        endTime: end,
      });
      try {
        const Stadium = require('../models/Stadium');
        const stadium = await Stadium.findById(resolvedStadiumId).select('name');
        const { notifyStadiumStaff } = require('./notification.service');
        await notifyStadiumStaff({
          stadiumId: resolvedStadiumId,
          type: 'BOOKING_HELD',
          title: 'Ballan cusub (hold)',
          body: `${stadium?.name || 'Garoon'}: slot waa la haystay — $${Number(price.totalPrice).toFixed(2)}.`,
          bookingId: booking._id,
          eventKey: `booking_held:${booking._id}`,
          socketEvent: 'booking:created',
          meta: { totalPrice: price.totalPrice, status: booking.status },
        });
      } catch (err) {
        console.warn('[hold] stadium notify failed', err.message);
      }
      return booking;
    } catch (err) {
      if (err.isApiError) throw err;
      if (err.code === 11000) {
        console.warn('[createHold] outer E11000', { keyPattern: err.keyPattern, keyValue: err.keyValue });
        if (isOrphanBookingIdDup(err)) {
          throw ApiError.internal(
            'Booking store has a legacy unique index (bookingId). Restart the server or run: node scripts/drop-orphan-booking-indexes.js'
          );
        }
        if (isBookingCodeDup(err)) {
          throw ApiError.conflict('Could not allocate a booking code — please try again');
        }
        // Last resort: still avoid the misleading "already booked" when we have no clash doc.
        throw ApiError.conflict(
          `Could not reserve this slot (duplicate ${JSON.stringify(err.keyPattern || {})}). Try again or pick another time.`
        );
      }
      throw err;
    }
  });
}

function assertTransition(booking, nextStatus) {
  const allowed = BOOKING_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.conflict(`Cannot move booking from ${booking.status} to ${nextStatus}`);
  }
}

async function findCaptainByPhone(rawPhone) {
  const normalized = normalizeSomaliPhone(rawPhone);
  if (!normalized) {
    throw ApiError.badRequest(
      'Invalid Somali mobile. Use Hormuud 061, Telesom 063, Somtel 065, or Golis 090 (e.g. 061XXXXXXX)'
    );
  }

  const variants = phoneLookupVariants(normalized);
  const captain = await User.findOne({
    phone: { $in: variants },
    role: ROLES.TEAM_CAPTAIN,
  });

  if (!captain) {
    const all = await User.find({ role: ROLES.TEAM_CAPTAIN, phone: { $exists: true, $ne: '' } }).select(
      'phone name email'
    );
    const match = all.find((u) => {
      const n = normalizeSomaliPhone(u.phone);
      return n && n === normalized;
    });
    if (match) return { captain: match, normalized, carrier: detectCarrier(normalized) };
    throw ApiError.notFound(
      `No team captain registered with ${formatDisplay(normalized)}. They must sign up with this unique phone first.`
    );
  }

  return { captain, normalized, carrier: detectCarrier(normalized) };
}

async function inviteTeamB({ bookingId, requesterId, teamBId, teamBCaptainId, playersCount }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.teamA.captain.toString() !== requesterId) {
    throw ApiError.forbidden('Only the booking creator (Team A captain) can invite Team B');
  }
  if (booking.teamB) {
    throw ApiError.conflict('Team B has already been invited to this booking');
  }
  if (teamBCaptainId === requesterId) {
    throw ApiError.badRequest('You cannot invite yourself as Team B');
  }

  await assertInviteDistanceOk({ booking, teamBCaptainId, teamBId });

  const aPaid =
    booking.teamA.paymentStatus === PAYMENT_STATUS.HELD ||
    booking.teamA.paymentStatus === PAYMENT_STATUS.SUCCESS ||
    booking.coveredFullMatch;
  if (!aPaid) {
    throw ApiError.badRequest('Pay your team share (or pay full match) before inviting Team B');
  }

  const field = await Field.findById(booking.field);
  const perSide = playersPerSide(field);
  // Re-apply slot discounts from server rules — never trust client prices.
  const fresh = await calculatePriceForSlot({ field, startTime: booking.startTime });
  const { teamBShare, teamAShare } = splitBetweenTeams(fresh.totalPrice, true, fresh.teamShare);

  booking.pricing.totalPrice = fresh.totalPrice;
  booking.pricing.unitPrice = fresh.unitPrice;
  booking.pricing.teamShare = fresh.teamShare;
  booking.pricing.baseTotalPrice = fresh.baseTotalPrice ?? fresh.totalPrice;
  booking.pricing.discountAmount = fresh.discountAmount || 0;
  booking.pricing.discountPercent = fresh.discountPercent ?? undefined;
  booking.pricing.discountId = fresh.discountId || undefined;
  booking.pricing.discountName = fresh.discountName || undefined;

  const teamBMinutes = Number(getBusiness().teamBPriorityMinutes ?? getBusiness().teamBPaymentDeadlineMinutes) || 12;
  const paymentDeadline = new Date(Date.now() + teamBMinutes * 60 * 1000);

  const bookingFinance = require('./bookingFinance.service');
  const bDues = bookingFinance.applyDues(booking.financialSnapshot, {
    teamAShare,
    teamBShare,
  });

  if (booking.coveredFullMatch) {
    booking.teamA.amountDue = bDues.payableFullMatch || fresh.totalPrice;
    booking.teamA.playersCount = perSide;
    booking.teamB = {
      team: teamBId,
      captain: teamBCaptainId,
      playersCount: perSide,
      amountDue: 0,
      paymentStatus: PAYMENT_STATUS.HELD,
      invitedAt: new Date(),
      paymentDeadline,
    };
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.holdExpiresAt = undefined;
    booking.teamBPaymentDueAt = undefined;
  } else {
    booking.teamA.amountDue = bDues.teamADue;
    booking.teamA.playersCount = perSide;
    // Keep existing demand-based deadline if Match Code window already open
    const existingDue =
      booking.teamBPaymentDueAt ||
      booking.holdExpiresAt ||
      booking.opponentWindow?.finalGraceEndsAt ||
      booking.opponentWindow?.priorityEndsAt;
    const deadline = existingDue && new Date(existingDue) > new Date() ? new Date(existingDue) : paymentDeadline;

    booking.teamB = {
      team: teamBId,
      captain: teamBCaptainId,
      playersCount: perSide,
      amountDue: bDues.teamBDue,
      paymentStatus: PAYMENT_STATUS.PENDING,
      invitedAt: new Date(),
      paymentDeadline: deadline,
    };
    if (!booking.matchCode || !booking.opponentWindow?.phase) {
      const opponentWindow = require('./opponentWindow.service');
      await opponentWindow.startOpponentWindow(booking, booking.teamAPaidAt || new Date());
    } else {
      booking.teamBPaymentDueAt = deadline;
      booking.holdExpiresAt = deadline;
    }
    if (booking.teamA.paymentStatus === PAYMENT_STATUS.HELD || booking.teamA.paymentStatus === PAYMENT_STATUS.SUCCESS) {
      booking.status = BOOKING_STATUS.PAYMENT_PENDING;
    }
  }

  await booking.save();

  const notifyAmount = booking.coveredFullMatch ? 0 : (booking.teamB?.amountDue || teamBShare);
  const dueLabel = booking.teamBPaymentDueAt || paymentDeadline;
  await notifyUser({
    userId: teamBCaptainId,
    type: 'TEAM_B_INVITE',
    title: 'You were invited to a match',
    body: booking.coveredFullMatch
      ? 'Team A paid the full match. Open Bookings for your match pass.'
      : `Pay your share. Match Code: ${booking.matchCode || '—'}. Deadline: ${new Date(dueLabel).toLocaleString()}.`,
    bookingId: booking._id,
    meta: { amountDue: notifyAmount, matchCode: booking.matchCode, deadlineMinutes: teamBMinutes },
    dedupeKey: `team_b_invite:${booking._id}`,
  });
  if (!booking.coveredFullMatch) {
    await notifyUser({
      userId: teamBCaptainId,
      type: 'PAYMENT_DUE',
      title: 'Payment due for match invite',
      body: `Pay $${Number(notifyAmount).toFixed(2)}. Code: ${booking.matchCode || '—'}.`,
      bookingId: booking._id,
      dedupeKey: `payment_due:${booking._id}:teamB`,
    });
  }

  emitFieldUpdate(booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
  });
  return booking;
}

/**
 * Invite opponent by unique Somali phone (Hormuud/Telesom/Somtel/Golis).
 * Looks up registered TEAM_CAPTAIN and attaches their default team.
 */
async function inviteTeamBByPhone({ bookingId, requesterId, phone, playersCount }) {
  const { captain, normalized, carrier } = await findCaptainByPhone(phone);
  if (captain._id.toString() === requesterId) {
    throw ApiError.badRequest('You cannot invite your own phone number');
  }

  const teamB = await getOrCreateDefaultTeam(captain._id.toString());

  const booking = await inviteTeamB({
    bookingId,
    requesterId,
    teamBId: teamB._id,
    teamBCaptainId: captain._id.toString(),
    playersCount,
  });

  // Lock invite phone for Match Code join anti-scam (if window already open)
  try {
    if (booking.matchCode && !booking.invitePhone) {
      booking.invitePhone = normalized;
      await booking.save();
    }
  } catch (err) {
    console.warn('[inviteTeamBByPhone] invitePhone lock', err.message);
  }

  return {
    booking,
    invitedCaptain: {
      id: captain._id,
      name: captain.name,
      phone: formatDisplay(normalized),
      carrier: carrier ? carrier.label : null,
    },
  };
}

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  zaad: 'Zaad',
  edahab: 'eDahab',
  hormuud: 'Hormuud',
  telesom: 'Telesom / Zaad',
  somtel: 'Somtel / eDahab',
  walk_in: 'Walk-in',
  goolis: 'Goolis',
  golis: 'Golis',
};

const LOCK_MSG = {
  notScanned: {
    en: 'QR not verified yet — scan the match pass before starting.',
    so: 'Weli QR lama hubin — scan ka hor intaadan bilowin ciyaarta.',
  },
  tooEarly: {
    en: 'Too early / wrong slot — you cannot start outside the booked time.',
    so: 'Ma bilaabi kartid — maaha wakhtigan. Sug ilaa wakhtiga booking-ka.',
  },
  expired: {
    en: 'Time slot expired — you cannot start outside the booked hour.',
    so: 'Wakhtigii booking-ku wuu dhacay — ma bilaabi kartid dibadda wakhtiga.',
  },
  wrongStadium: {
    en: 'Wrong stadium for this booking.',
    so: 'Garoonka qalad — booking-kan ma aha garoonkan.',
  },
};

function paymentMethodLabel(method) {
  if (!method) return null;
  const key = String(method).toLowerCase();
  return PAYMENT_METHOD_LABELS[key] || method;
}

function isWalkInPayment(p) {
  if (!p) return false;
  if (p.provider === 'cash' && String(p.operator || '').toLowerCase() === 'cash') return true;
  if (String(p.providerReference || '').toUpperCase().startsWith('WALKIN-')) return true;
  if (String(p.idempotencyKey || '').toLowerCase().startsWith('walkin-')) return true;
  return false;
}

function resolveStartLock({ qrVerified, timeState, canStart, messageEn, messageSo }) {
  if (!qrVerified) {
    return {
      lockReason: 'not_scanned',
      lockMessageEn: LOCK_MSG.notScanned.en,
      lockMessageSo: LOCK_MSG.notScanned.so,
    };
  }
  if (timeState === 'too_early' || (!canStart && timeState !== 'expired' && timeState !== 'late')) {
    return {
      lockReason: 'too_early',
      lockMessageEn: messageEn || LOCK_MSG.tooEarly.en,
      lockMessageSo: messageSo || LOCK_MSG.tooEarly.so,
    };
  }
  if (timeState === 'expired' || !canStart) {
    return {
      lockReason: 'expired',
      lockMessageEn: messageEn || LOCK_MSG.expired.en,
      lockMessageSo: messageSo || LOCK_MSG.expired.so,
    };
  }
  return { lockReason: null, lockMessageEn: null, lockMessageSo: null };
}

/**
 * Rich owner/manager booking card (faafaahin) — list + detail + walk-in success.
 */
function buildOwnerDetailCard(booking, payments = [], timeOverride = null) {
  const graceMinutes = getBusiness().noShowGraceMinutes ?? 15;
  const earlyStartMinutes = getBusiness().earlyStartMinutes ?? 10;
  const time =
    timeOverride ||
    slotTimeState(booking, new Date(), graceMinutes, earlyStartMinutes);

  const captain = booking.teamA?.captain;
  const captainPhone = captain?.phone || null;
  const carrierInfo = captainPhone ? detectCarrier(captainPhone) : null;
  const primaryPay = payments[0] || null;
  const walkIn = payments.some(isWalkInPayment);
  let paymentMethod = primaryPay?.operator || null;
  if (!paymentMethod && walkIn) paymentMethod = 'cash';
  if (walkIn && paymentMethod === 'cash') {
    /* keep cash; surface walkIn flag separately */
  }

  const amountPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const paidAt = primaryPay?.paidAt || primaryPay?.createdAt || booking.teamAPaidAt || null;
  const reference =
    primaryPay?.providerReference ||
    booking.bookingCode ||
    null;

  const qrVerified = Boolean(booking.gateCheckedInAt);
  const lock = resolveStartLock({
    qrVerified,
    timeState: time.timeState,
    canStart: time.canStart,
    messageEn: time.messageEn,
    messageSo: time.messageSo,
  });
  // Detail/list: match start needs both QR gate check-in history OR session scan + time.
  // Persistently, qrVerified === gateCheckedInAt; session scan is client-side until start.
  const canStartMatch = qrVerified && Boolean(time.canStart);

  const qrPayload =
    booking.bookingCode && booking._id ? buildQrPayload(booking) : null;

  return {
    bookingId: String(booking._id),
    bookingCode: booking.bookingCode || null,
    status: booking.status,
    stadiumId: String(booking.stadium?._id || booking.stadium || ''),
    stadiumName: booking.stadium?.name || null,
    fieldName: booking.field?.name || null,
    captainName: captain?.name || null,
    captainPhone,
    carrier: carrierInfo
      ? { id: carrierInfo.id, label: carrierInfo.label }
      : null,
    bookedAt: booking.createdAt || null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    paymentMethod,
    paymentMethodLabel: paymentMethodLabel(paymentMethod),
    walkIn,
    paidAt,
    amountPaid: payments.length ? amountPaid : booking.pricing?.totalPrice ?? null,
    currency: booking.pricing?.currency || 'USD',
    reference,
    tixraac: reference,
    qrPayload,
    qrCode: booking.bookingCode || null,
    qrVerified,
    gateCheckedInAt: booking.gateCheckedInAt || null,
    timeState: time.timeState,
    canStart: time.canStart,
    canStartMatch,
    startsAt: time.startsAt,
    endsAt: time.endsAt,
    secondsUntilStart: time.secondsUntilStart,
    secondsUntilEnd: time.secondsUntilEnd,
    messageEn: time.messageEn,
    messageSo: time.messageSo,
    ...lock,
  };
}

async function loadPaidPaymentsForBooking(bookingId) {
  const Payment = require('../models/Payment');
  const paidStatuses = [
    PAYMENT_STATUS.SUCCESS,
    PAYMENT_STATUS.HELD,
    PAYMENT_STATUS.SETTLEMENT_PENDING,
    PAYMENT_STATUS.SETTLED,
  ];
  return Payment.find({
    booking: bookingId,
    status: { $in: paidStatuses },
  })
    .select(
      'side amount payerPhone providerReference paidAt coverFullMatch status operator provider idempotencyKey createdAt'
    )
    .sort({ paidAt: 1, createdAt: 1 })
    .lean();
}

/**
 * Captain match-pass card payload (CONFIRMED+): both sides, payment meta, shared gate QR.
 * Same `qrPayload` / bookingCode used by owner/manager ScanScreen check-in.
 */
async function buildMatchPassCard(booking) {
  if (!booking?._id || !booking.bookingCode) return null;

  const payments = await loadPaidPaymentsForBooking(booking._id);

  const pickPay = (side) => {
    const list = payments.filter((p) => p.side === side);
    if (!list.length) return null;
    return list[list.length - 1];
  };

  const phoneMeta = (raw) => {
    if (!raw) return { payerPhone: null, payerPhoneDisplay: null };
    try {
      return {
        payerPhone: normalizeSomaliPhone(raw) || raw,
        payerPhoneDisplay: formatDisplay(raw) || String(raw),
      };
    } catch {
      return { payerPhone: String(raw), payerPhoneDisplay: String(raw) };
    }
  };

  const sideCard = (key) => {
    const party = booking[key];
    if (!party) return null;

    const pay = pickPay(key);
    const captain = party.captain;
    let payerRaw =
      pay?.payerPhone ||
      (key === 'teamA' ? booking.teamAPayerPhone : null) ||
      captain?.phone ||
      null;

    // Covered full match: Team B may have no payment — note cover on Team A only
    const method =
      pay?.operator ||
      (pay && isWalkInPayment(pay) ? 'cash' : null) ||
      null;
    const paidAt =
      pay?.paidAt ||
      pay?.createdAt ||
      (key === 'teamA' ? booking.teamAPaidAt : null) ||
      null;
    const phones = phoneMeta(payerRaw);
    const captainPhone = captain?.phone || null;
    let captainPhoneDisplay = null;
    if (captainPhone) {
      try {
        captainPhoneDisplay = formatDisplay(captainPhone) || captainPhone;
      } catch {
        captainPhoneDisplay = captainPhone;
      }
    }

    return {
      side: key,
      teamName: party.team?.name || (key === 'teamA' ? 'Team A' : 'Team B'),
      captainName: captain?.name || null,
      captainPhone,
      captainPhoneDisplay,
      ...phones,
      paidAt,
      paymentMethod: method,
      paymentMethodLabel: paymentMethodLabel(method),
      amountPaid: pay?.amount != null ? Number(pay.amount) : Number(party.amountDue || 0),
      currency: pay?.currency || pay?.payCurrency || booking.pricing?.currency || 'USD',
      amountUsd: pay?.amountUsd ?? (pay?.currency === 'SLL' && pay?.exchangeRate ? pay.amount / pay.exchangeRate : pay?.amount ?? party.amountDue),
      amountSll: pay?.amountSll ?? (pay?.currency === 'SLL' ? pay.amount : null),
      exchangeRate: pay?.exchangeRate ?? booking.financialSnapshot?.sllPerUsd ?? null,
      reference: pay?.providerReference || booking.bookingCode || null,
      paymentStatus: party.paymentStatus || null,
      coveredByTeamA: Boolean(booking.coveredFullMatch && key === 'teamB' && !pay),
    };
  };

  return {
    bookingId: String(booking._id),
    bookingCode: booking.bookingCode,
    matchCode: booking.matchCode || null,
    qrPayload: buildQrPayload(booking),
    bookedAt: booking.createdAt || null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    stadiumName: booking.stadium?.name || null,
    fieldName: booking.field?.name || null,
    coveredFullMatch: Boolean(booking.coveredFullMatch),
    status: booking.status,
    currency: booking.pricing?.currency || 'USD',
    totalPrice: booking.pricing?.totalPrice ?? null,
    teamA: sideCard('teamA'),
    teamB: sideCard('teamB'),
  };
}

/**
 * Gate card payload for owner/manager scan UI (teams, captains, paid refs, time state).
 * timeState compares now vs booked hour (startTime–endTime):
 * too_early | ok | late | expired. Late (past no-show grace) still allows start until end.
 */
async function buildGateSummary(booking, { qrVerifiedSession = null } = {}) {
  const graceMinutes = getBusiness().noShowGraceMinutes ?? 15;
  const earlyStartMinutes = getBusiness().earlyStartMinutes ?? 10;
  const time = slotTimeState(booking, new Date(), graceMinutes, earlyStartMinutes);
  const isLate = time.timeState === 'late';

  const payments = await loadPaidPaymentsForBooking(booking._id);

  const sideInfo = (key) => {
    const party = booking[key];
    if (!party) return null;
    const captain = party.captain;
    return {
      teamName: party.team?.name || key,
      captainName: captain?.name || null,
      captainPhone: captain?.phone || null,
      captainEmail: captain?.email || null,
      paymentStatus: party.paymentStatus,
      amountDue: party.amountDue,
      paymentDeadline: party.paymentDeadline || null,
    };
  };

  const biz = getBusiness();
  const waitingUntil =
    booking.teamBPaymentDueAt ||
    booking.holdExpiresAt ||
    booking.teamB?.paymentDeadline ||
    booking.teamA?.paymentDeadline ||
    null;
  const waitingTeamB =
    !booking.coveredFullMatch &&
    Boolean(booking.teamAPaidAt || booking.teamA?.paymentStatus === PAYMENT_STATUS.SUCCESS) &&
    booking.teamB &&
    booking.teamB.paymentStatus !== PAYMENT_STATUS.SUCCESS &&
    booking.teamB.paymentStatus !== PAYMENT_STATUS.HELD;

  const detailCard = buildOwnerDetailCard(booking, payments, time);
  // Session scan (validateOnly success) counts as QR verified for Bilow until start commits.
  const qrVerified =
    qrVerifiedSession != null
      ? Boolean(qrVerifiedSession)
      : Boolean(booking.gateCheckedInAt);
  const lock = resolveStartLock({
    qrVerified,
    timeState: time.timeState,
    canStart: time.canStart,
    messageEn: time.messageEn,
    messageSo: time.messageSo,
  });
  const canStartMatch = qrVerified && Boolean(time.canStart);

  return {
    bookingCode: booking.bookingCode,
    status: booking.status,
    coveredFullMatch: Boolean(booking.coveredFullMatch),
    stadiumName: booking.stadium?.name || null,
    fieldName: booking.field?.name || null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    gateCheckedInAt: booking.gateCheckedInAt || null,
    pricing: booking.pricing,
    teamA: sideInfo('teamA'),
    teamB: sideInfo('teamB'),
    payments: payments.map((p) => ({
      side: p.side,
      amount: p.amount,
      payerPhone: p.payerPhone || null,
      tixraac: p.providerReference || null,
      paidAt: p.paidAt || p.createdAt,
      coverFullMatch: Boolean(p.coverFullMatch),
      operator: p.operator || null,
      paymentMethod: p.operator || null,
      paymentMethodLabel: paymentMethodLabel(p.operator),
      carrier: p.payerPhone
        ? (() => {
            const c = detectCarrier(p.payerPhone);
            return c ? { id: c.id, label: c.label } : null;
          })()
        : null,
      walkIn: isWalkInPayment(p),
      status: p.status,
    })),
    detailCard: {
      ...detailCard,
      qrVerified,
      canStartMatch,
      ...lock,
    },
    paymentPolicy: {
      bookingHoldMinutes: biz.bookingHoldMinutes ?? 10,
      teamBPaymentDeadlineMinutes: biz.teamBPaymentDeadlineMinutes ?? 10,
      releaseSlotOnPartialPaymentTimeout: biz.releaseSlotOnPartialPaymentTimeout !== false,
      waitingUntil: waitingUntil ? new Date(waitingUntil).toISOString() : null,
      waitingTeamB: Boolean(waitingTeamB),
      labelSo: waitingTeamB
        ? `Sugaya Team B · ${biz.teamBPaymentDeadlineMinutes ?? 10} daqiiqo — haddii aan la bixin slot wuxuu noqonayaa banaan`
        : booking.status === BOOKING_STATUS.HELD
          ? `Hold · ${biz.bookingHoldMinutes ?? 10} daqiiqo — kadib banaan`
          : null,
    },
    timeState: time.timeState,
    canStart: time.canStart,
    qrVerified,
    canStartMatch,
    lockReason: lock.lockReason,
    lockMessageEn: lock.lockMessageEn,
    lockMessageSo: lock.lockMessageSo,
    startsAt: time.startsAt,
    endsAt: time.endsAt,
    secondsUntilStart: time.secondsUntilStart,
    secondsUntilEnd: time.secondsUntilEnd,
    messageEn: time.messageEn,
    messageSo: time.messageSo,
    late: {
      isLate,
      minutesLate: time.minutesLate,
      graceMinutes: time.graceMinutes,
      canStartUntilSlotEnd: time.canStart && time.timeState !== 'expired',
    },
  };
}

async function loadBookingForGate(normalizedCode) {
  return Booking.findOne({ bookingCode: normalizedCode })
    .populate('field', 'name')
    .populate('stadium', 'name owner')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .populate('teamA.captain', 'name phone email')
    .populate('teamB.captain', 'name phone email');
}

/**
 * Stadium owner/manager scans match-pass QR at the gate.
 * Start only when now is within earlyStartMinutes before start → endTime,
 * and booking belongs to the stadium being scanned (`stadiumId` required).
 * `validateOnly: true` returns gateSummary + timeState without mutating.
 */
async function managerGateCheckIn({
  actor,
  bookingCode,
  qrPayload,
  stadiumId,
  force = false,
  validateOnly = false,
}) {
  let code = bookingCode;
  if (!code && qrPayload) {
    try {
      const parsed = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
      code = parsed.code || parsed.bookingCode;
    } catch {
      code = String(qrPayload).trim();
    }
  }
  if (code && String(code).trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(code);
      code = parsed.code || parsed.bookingCode || code;
    } catch {
      /* keep as-is */
    }
  }
  if (!code) throw ApiError.badRequest('bookingCode or qrPayload is required');
  if (!stadiumId) {
    throw ApiError.badRequest('stadiumId is required — scan at the stadium where the match is booked');
  }

  await managerService.assertStadiumAccess(stadiumId, actor);

  const normalizedCode = String(code).trim().toUpperCase();
  let booking = await loadBookingForGate(normalizedCode);

  if (!booking) throw ApiError.notFound('No booking found for this QR / entry code');

  const bookingStadiumId = String(booking.stadium?._id || booking.stadium || '');
  if (bookingStadiumId !== String(stadiumId)) {
    throw ApiError.conflict(
      `Wrong stadium. This booking is for ${booking.stadium?.name || 'another venue'}, not the stadium you selected.`,
      {
        code: 'WRONG_STADIUM',
        bookingStadiumId,
        bookingStadiumName: booking.stadium?.name || null,
        scannedStadiumId: String(stadiumId),
        messageSo: 'Garoonka qalad — booking-kan ma aha garoonkan.',
      }
    );
  }

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)) {
    throw ApiError.conflict(`Booking must be CONFIRMED before gate check-in (now ${booking.status})`);
  }

  const graceMinutes = getBusiness().noShowGraceMinutes ?? 15;
  const earlyStartMinutes = getBusiness().earlyStartMinutes ?? 10;
  const time = slotTimeState(booking, new Date(), graceMinutes, earlyStartMinutes);
  const allowForce = force && env.nodeEnv !== 'production';
  let forcedOutsideWindow = false;

  if (!time.canStart) {
    if (!allowForce) {
      if (validateOnly) {
        const gateSummary = await buildGateSummary(booking, { qrVerifiedSession: true });
        return {
          booking,
          gateSummary,
          detailCard: gateSummary.detailCard,
          alreadyCheckedIn: Boolean(booking.gateCheckedInAt),
          forcedOutsideWindow: false,
          validateOnly: true,
          qrVerified: true,
          canStartMatch: false,
          lockReason: gateSummary.lockReason,
          lockMessageEn: gateSummary.lockMessageEn,
          lockMessageSo: gateSummary.lockMessageSo,
          timeState: time.timeState,
          canStart: false,
          startsAt: time.startsAt,
          endsAt: time.endsAt,
          secondsUntilStart: time.secondsUntilStart,
          secondsUntilEnd: time.secondsUntilEnd,
          messageEn: time.messageEn,
          messageSo: time.messageSo,
        };
      }
      const detail = {
        timeState: time.timeState,
        canStart: false,
        qrVerified: true,
        canStartMatch: false,
        startsAt: time.startsAt,
        endsAt: time.endsAt,
        secondsUntilStart: time.secondsUntilStart,
        secondsUntilEnd: time.secondsUntilEnd,
        messageEn: time.messageEn,
        messageSo: time.messageSo,
        lockReason: time.timeState === 'too_early' ? 'too_early' : 'expired',
        lockMessageEn:
          time.timeState === 'too_early'
            ? time.messageEn || LOCK_MSG.tooEarly.en
            : time.messageEn || LOCK_MSG.expired.en,
        lockMessageSo:
          time.timeState === 'too_early'
            ? time.messageSo || LOCK_MSG.tooEarly.so
            : time.messageSo || LOCK_MSG.expired.so,
      };
      if (time.timeState === 'too_early') {
        throw ApiError.conflict(
          `Too early / wrong slot. Slot starts ${formatLocal(time.startsAt)}. ${time.messageSo}`,
          detail
        );
      }
      throw ApiError.conflict(
        `Time slot expired (ended ${formatLocal(time.endsAt)}). ${time.messageSo}`,
        detail
      );
    }
    forcedOutsideWindow = true;
  }

  const gateSummary = await buildGateSummary(booking, { qrVerifiedSession: true });

  if (validateOnly) {
    return {
      booking,
      gateSummary,
      detailCard: gateSummary.detailCard,
      alreadyCheckedIn: Boolean(booking.gateCheckedInAt),
      forcedOutsideWindow,
      validateOnly: true,
      qrVerified: true,
      canStartMatch: gateSummary.canStartMatch || forcedOutsideWindow,
      lockReason: gateSummary.lockReason,
      lockMessageEn: gateSummary.lockMessageEn,
      lockMessageSo: gateSummary.lockMessageSo,
      timeState: gateSummary.timeState,
      canStart: gateSummary.canStart || forcedOutsideWindow,
      startsAt: gateSummary.startsAt,
      endsAt: gateSummary.endsAt,
      secondsUntilStart: gateSummary.secondsUntilStart,
      secondsUntilEnd: gateSummary.secondsUntilEnd,
      messageEn: gateSummary.messageEn,
      messageSo: gateSummary.messageSo,
    };
  }

  const alreadyIn =
    Boolean(booking.gateCheckedInAt) ||
    booking.status === BOOKING_STATUS.IN_PROGRESS ||
    booking.status === BOOKING_STATUS.CHECKED_IN;

  if (alreadyIn) {
    return {
      booking,
      gateSummary,
      detailCard: gateSummary.detailCard,
      alreadyCheckedIn: true,
      forcedOutsideWindow,
      qrVerified: true,
      canStartMatch: true,
      lockReason: null,
      lockMessageEn: null,
      lockMessageSo: 'Hore ayaa loo check-in gareeyay',
      messageEn: 'Already checked in',
      messageSo: 'Hore ayaa loo check-in gareeyay',
      timeState: gateSummary.timeState,
      canStart: true,
      startsAt: gateSummary.startsAt,
      endsAt: gateSummary.endsAt,
      secondsUntilStart: gateSummary.secondsUntilStart,
      secondsUntilEnd: gateSummary.secondsUntilEnd,
    };
  }

  booking.gateCheckedInAt = new Date();
  booking.gateCheckedInBy = actor.id;
  // Manager verify starts the match (gate check-in → in progress)
  booking.status = BOOKING_STATUS.IN_PROGRESS;
  try {
    await booking.save();
    // Release escrow to owner's available balance upon verified gate check-in
    try {
      const egaroonWalletService = require('./egaroonWallet.service');
      await egaroonWalletService.releaseBookingEscrow(booking, { source: 'checkin' });
    } catch (_escrowErr) {
      console.warn('[gateCheckIn] escrow release error:', _escrowErr.message);
    }
  } catch (err) {
    // Concurrent double-scan: reload and treat as idempotent success
    if (err.code === 11000 || err.name === 'VersionError') {
      booking = await loadBookingForGate(normalizedCode);
      if (
        booking &&
        (booking.gateCheckedInAt ||
          booking.status === BOOKING_STATUS.IN_PROGRESS ||
          booking.status === BOOKING_STATUS.CHECKED_IN)
      ) {
        const racedSummary = await buildGateSummary(booking, { qrVerifiedSession: true });
        return {
          booking,
          gateSummary: racedSummary,
          detailCard: racedSummary.detailCard,
          alreadyCheckedIn: true,
          forcedOutsideWindow,
          qrVerified: true,
          canStartMatch: true,
          lockReason: null,
          lockMessageEn: null,
          lockMessageSo: 'Hore ayaa loo check-in gareeyay',
          messageEn: 'Already checked in',
          messageSo: 'Hore ayaa loo check-in gareeyay',
          timeState: racedSummary.timeState,
          canStart: true,
          startsAt: racedSummary.startsAt,
          endsAt: racedSummary.endsAt,
          secondsUntilStart: racedSummary.secondsUntilStart,
          secondsUntilEnd: racedSummary.secondsUntilEnd,
        };
      }
    }
    throw err;
  }

  booking = await loadBookingForGate(normalizedCode);
  const startedSummary = await buildGateSummary(booking, { qrVerifiedSession: true });

  for (const side of ['teamA', 'teamB']) {
    const party = booking[side];
    if (party?.captain) {
      const captainId = party.captain._id || party.captain;
      await notifyUser({
        userId: captainId,
        type: 'GATE_CHECKED_IN',
        title: 'Stadium gate checked in',
        body: 'Manager verified your match pass. Enjoy the game!',
        bookingId: booking._id,
        dedupeKey: `gate_checked_in:${booking._id}:${captainId}`,
      });
    }
  }

  try {
    const { notifyMatchStarted } = require('./notification.service');
    await notifyMatchStarted({
      stadiumId: booking.stadium?._id || booking.stadium,
      bookingId: booking._id,
      stadiumName: booking.stadium?.name,
      fieldName: booking.field?.name,
    });
  } catch (err) {
    console.warn('[gate] stadium match-started notify failed', err.message);
  }

  emitFieldUpdate(booking.field._id?.toString() || booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
  });
  try {
    const { emitStadiumUpdate } = require('../sockets');
    emitStadiumUpdate(String(booking.stadium?._id || booking.stadium), 'match:started', {
      bookingId: booking._id,
      status: booking.status,
      stadiumId: String(booking.stadium?._id || booking.stadium),
    });
  } catch {
    /* optional */
  }

  return {
    booking,
    gateSummary: startedSummary,
    detailCard: startedSummary.detailCard,
    alreadyCheckedIn: false,
    forcedOutsideWindow,
    qrVerified: true,
    canStartMatch: true,
    lockReason: null,
    lockMessageEn: null,
    lockMessageSo: null,
    timeState: startedSummary.timeState,
    canStart: true,
    startsAt: startedSummary.startsAt,
    endsAt: startedSummary.endsAt,
    secondsUntilStart: startedSummary.secondsUntilStart,
    secondsUntilEnd: startedSummary.secondsUntilEnd,
    messageEn: startedSummary.messageEn,
    messageSo: startedSummary.messageSo,
  };
}

async function expireStaleHolds() {
  const now = new Date();
  const graceMs = getBusiness().bookingHoldGraceMinutes * 60 * 1000;
  const cutoff = new Date(now.getTime() - graceMs);
  const biz = getBusiness();
  const releaseSlot = biz.releaseSlotOnPartialPaymentTimeout !== false;
  const autoRefund = biz.autoRefundTeamAOnTeamBTimeout !== false;

  const { isBookingFullyPaid, isSidePaid, refundTeamAPaymentsForBooking } = require('./payment.service');
  const opponentWindow = require('./opponentWindow.service');
  const slotDemand = require('./slotDemand.service');

  await slotDemand.expireStaleDemands(now);

  // Demand-based: evaluate Team A–paid opponent windows (may extend, not hard-expire)
  let demandReleased = [];
  try {
    demandReleased = await opponentWindow.processStaleOpponentWindows();
  } catch (err) {
    console.warn('[expire] opponent window tick failed', err.message);
  }

  // Hold expiry for unpaid Team A holds OR orphan holds (NOT Team A paid waiting for B —
  // those go through demand-based processStaleOpponentWindows).
  const holdMs = (biz.bookingHoldMinutes || 10) * 60 * 1000;
  const orphanCreatedBefore = new Date(now.getTime() - holdMs - graceMs);

  const staleBookings = await Booking.find({
    status: { $in: [BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING] },
    $or: [
      { holdExpiresAt: { $lt: cutoff } },
      { teamBPaymentDueAt: { $lt: cutoff } },
      {
        holdExpiresAt: { $exists: false },
        teamBPaymentDueAt: { $exists: false },
        createdAt: { $lt: orphanCreatedBefore },
      },
    ],
  }).limit(100);

  const expired = [...demandReleased];
  for (const booking of staleBookings) {
    if (isBookingFullyPaid(booking) || booking.status === BOOKING_STATUS.CONFIRMED) {
      continue;
    }

    const teamAWasPaid = isSidePaid(booking.teamA) || Boolean(booking.teamAPaidAt);
    const waitingOnTeamB =
      teamAWasPaid &&
      !booking.coveredFullMatch &&
      (!booking.teamB || !isSidePaid(booking.teamB));

    // Team A paid → demand-based evaluation (already processed above; skip hard expire)
    if (waitingOnTeamB) {
      continue;
    }

    // Fair access: release slot by default so another captain can book.
    if (!releaseSlot && waitingOnTeamB) {
      continue;
    }

    // Atomic claim — do NOT require partialPaymentTimeoutAt unset (stuck live docs must reclaim).
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: { $in: LIVE_HOLD_STATUSES },
      },
      {
        $set: {
          status: BOOKING_STATUS.EXPIRED,
          partialPaymentTimeoutAt: now,
          cancelReason: waitingOnTeamB ? 'team_b_payment_timeout' : 'hold_expired',
        },
        $unset: {
          holdExpiresAt: 1,
          teamBPaymentDueAt: 1,
        },
      },
      { returnDocument: 'after' }
    );
    if (!claimed) continue;

    expired.push(claimed._id);

    if (autoRefund && teamAWasPaid && !claimed.coveredFullMatch) {
      try {
        await refundTeamAPaymentsForBooking(claimed._id);
      } catch (err) {
        console.warn('[expire] Team A refund failed', claimed._id.toString(), err.message);
      }
    }

    try {
      const aCaptain = claimed.teamA?.captain;
      if (aCaptain) {
        await notifyUser({
          userId: aCaptain,
          type: 'BOOKING_EXPIRED',
          title: waitingOnTeamB ? 'Team B did not pay — slot released' : 'Booking hold expired',
          body: waitingOnTeamB
            ? 'Team B ma bixin waqtigii. Boosku wuu furmay; lacagtaada waa la soo celiyay (haddii la bixiyay).'
            : 'Hold-kii wuu dhacay — boosku wuu furmay kabtan kale.',
          bookingId: claimed._id,
          dedupeKey: `booking_expired:${claimed._id}:teamA`,
        });
      }
      const bCaptain = claimed.teamB?.captain;
      if (bCaptain && waitingOnTeamB) {
        await notifyUser({
          userId: bCaptain,
          type: 'BOOKING_EXPIRED',
          title: 'Payment window closed',
          body: 'Waqtigii lacag-bixinta wuu dhacay. Ballanku waa la joojiyay; boosku wuu furmay.',
          bookingId: claimed._id,
          dedupeKey: `booking_expired:${claimed._id}:teamB`,
        });
      }
    } catch (err) {
      console.warn('[expire] notify failed', claimed._id.toString(), err.message);
    }

    emitFieldUpdate(claimed.field.toString(), 'booking:updated', {
      bookingId: claimed._id,
      status: claimed.status,
    });
  }
  return expired;
}

/**
 * Admin/dev: expire every HELD / PAYMENT_PENDING on a field (or all fields).
 * Use after stuck holds, or when soft-expire / scheduler lagged.
 */
async function forceClearHolds({ fieldId, includeActive = false } = {}) {
  const filter = {
    status: { $in: LIVE_HOLD_STATUSES },
  };
  if (fieldId) filter.field = fieldId;

  const holds = await Booking.find(filter).limit(500);
  const cleared = [];
  const skipped = [];

  for (const booking of holds) {
    if (!includeActive && !isSoftExpiredHold(booking)) {
      skipped.push({
        id: booking._id,
        status: booking.status,
        startTime: booking.startTime,
        holdExpiresAt: booking.holdExpiresAt,
        reason: 'still_within_hold_window',
      });
      continue;
    }
    const expired = await expireBookingHoldNow(booking);
    if (expired) {
      cleared.push(expired._id);
    } else {
      skipped.push({
        id: booking._id,
        status: booking.status,
        reason: 'claim_failed_or_paid',
      });
    }
  }

  return { clearedCount: cleared.length, cleared, skipped };
}

/**
 * Owner/manager walk-in: visitor at the stadium books a free slot.
 * paymentMethod: cash | zaad | edahab | hormuud
 * payMode: full | half_a | cash_full (cash_full implies full + cash)
 */
async function createWalkInBooking({
  actor,
  stadiumId,
  fieldId,
  startTime,
  endTime,
  captainName,
  captainPhone,
  teamName,
  payMode = 'full',
  paymentMethod = 'cash',
  payerPhone,
  payNow = true,
}) {
  if (!stadiumId || !fieldId) throw ApiError.badRequest('stadiumId and fieldId are required');
  if (!captainPhone) throw ApiError.badRequest('captainPhone is required');
  if (!['full', 'half_a', 'cash_full'].includes(payMode)) {
    throw ApiError.badRequest('payMode must be full, half_a, or cash_full');
  }

  const METHODS = ['cash', 'zaad', 'edahab', 'hormuud'];
  let method = String(paymentMethod || 'cash').toLowerCase();
  if (payMode === 'cash_full') method = 'cash';
  if (!METHODS.includes(method)) {
    throw ApiError.badRequest(`paymentMethod must be one of: ${METHODS.join(', ')}`);
  }

  await managerService.assertStadiumAccess(stadiumId, actor);

  const field = await Field.findById(fieldId);
  if (!field) throw ApiError.notFound('Field not found');
  if (String(field.stadium) !== String(stadiumId)) {
    throw ApiError.badRequest('Field does not belong to this stadium');
  }

  const stadiumDoc = await Stadium.findById(stadiumId);
  const { assertStadiumAndFieldBookable } = require('../utils/fieldAvailability');
  assertStadiumAndFieldBookable(stadiumDoc, field);

  const captain = await findOrCreateWalkInCaptain({
    name: captainName,
    phone: captainPhone,
  });

  // Idempotent walk-in: same captain + exact slot already live (incl. CONFIRMED)
  // — skip createHold so double-tap does not 409 SLOT_OWNED.
  let hold = await Booking.findOne({
    field: fieldId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    'teamA.captain': captain._id,
    status: { $in: LIVE_BOOKING_STATUSES },
  });
  if (hold && isSoftExpiredHold(hold)) {
    await expireBookingHoldNow(hold);
    hold = null;
  }
  if (!hold) {
    hold = await createHold({
      fieldId,
      stadiumId,
      captainId: captain._id,
      teamName: teamName || `${captain.name}'s Team`,
      startTime,
      endTime,
    });
  }

  const coverFullMatch = payMode === 'full' || payMode === 'cash_full';
  let payment = null;
  const paymentService = require('./payment.service');

  // Idempotent: prior walk-in already confirmed this hold (retry / double-tap).
  if (
    BOOKED_LOCKED_STATUSES.includes(hold.status) ||
    paymentService.isBookingFullyPaid(hold) ||
    (coverFullMatch && hold.coveredFullMatch)
  ) {
    const Payment = require('../models/Payment');
    payment = await Payment.findOne({
      booking: hold._id,
      idempotencyKey: { $regex: `^walkin-${hold._id}` },
    }).sort({ createdAt: -1 });
  } else if (payNow) {
    const phone = payerPhone || captainPhone;
    const amount = coverFullMatch
      ? Number(hold.pricing?.payableFullMatch || hold.pricing?.totalPrice)
      : Number(hold.teamA?.amountDue);

    const Payment = require('../models/Payment');
    let teamId = hold.teamA?.team;
    if (teamId && typeof teamId === 'object') teamId = teamId._id || teamId.id;
    if (!teamId) {
      const fresh = await Booking.findById(hold._id).select('teamA.team');
      teamId = fresh?.teamA?.team;
    }
    if (!teamId) {
      throw ApiError.badRequest('Walk-in hold is missing team — cannot record payment');
    }

    const idempotencyKey = `walkin-${hold._id}-${payMode}-${method}`;
    let paymentDoc = await Payment.findOne({ idempotencyKey });

    if (!paymentDoc) {
      try {
        paymentDoc = await Payment.create({
          booking: hold._id,
          team: teamId,
          payer: captain._id,
          side: 'teamA',
          amount,
          currency: hold.pricing?.currency || 'USD',
          status: PAYMENT_STATUS.PENDING,
          provider: method === 'cash' ? 'cash' : 'mock',
          operator: method,
          payerPhone: phone,
          coverFullMatch,
          idempotencyKey,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        paymentDoc = await Payment.findOne({ idempotencyKey });
        if (!paymentDoc) {
          throw ApiError.conflict(
            'Walk-in payment conflict — please retry.',
            {
              code: 'WALKIN_PAYMENT_DUP',
              messageEn: 'Walk-in payment conflict — please retry.',
              messageSo: 'Lacag-bixinta walk-in way isku dhacday — isku day mar kale.',
            }
          );
        }
      }
    }

    if (
      paymentDoc.status !== PAYMENT_STATUS.SUCCESS &&
      paymentDoc.status !== PAYMENT_STATUS.HELD &&
      paymentDoc.status !== PAYMENT_STATUS.SETTLED
    ) {
      await paymentService.confirmPaymentSuccess({
        paymentId: paymentDoc._id,
        providerReference: `WALKIN-${method.toUpperCase()}-${Date.now()}`,
        eventId: `walkin-${hold._id}-${payMode}-${method}`,
      });
    }
    payment = await Payment.findById(paymentDoc._id);
  }

  const booking = await Booking.findById(hold._id)
    .populate('field', 'name type')
    .populate('stadium', 'name')
    .populate('teamA.team', 'name')
    .populate('teamA.captain', 'name phone');

  const payments = payment ? [payment.toObject ? payment.toObject() : payment] : await loadPaidPaymentsForBooking(booking._id);
  const gateSummary = await buildGateSummary(booking);
  const detailCard = gateSummary.detailCard || buildOwnerDetailCard(booking, payments);

  const paymentOut =
    ownerCanSeeCommission(actor) || !payment
      ? payment
      : {
          ...(typeof payment.toObject === 'function' ? payment.toObject() : payment),
          commissionAmount: null,
          commissionPercent: null,
        };

  return {
    booking: bookingForOwner(actor, booking),
    payment: paymentOut,
    payMode,
    paymentMethod: method,
    walkIn: true,
    gateSummary,
    detailCard: { ...detailCard, walkIn: true, paymentMethod: method, paymentMethodLabel: paymentMethodLabel(method) },
    captain: captain.toSafeJSON
      ? captain.toSafeJSON()
      : { id: captain._id, name: captain.name, phone: captain.phone },
  };
}

/**
 * Resolve visitor captain for walk-in.
 * Must look up by phone across ALL roles — unique phone index means creating a
 * second user for an owner/manager phone throws E11000 → "Resource already exists".
 */
async function findOrCreateWalkInCaptain({ name, phone }) {
  const { normalizeSomaliPhone, formatDisplay, phoneLookupVariants } = require('../utils/somaliPhone');
  const normalized = normalizeSomaliPhone(phone);
  if (!normalized) {
    throw ApiError.badRequest('Invalid Somali phone number / Lambarka telefoon ma saxna');
  }

  const variants = phoneLookupVariants(normalized);
  let user = await User.findOne({ phone: { $in: variants } });

  if (user) {
    if (
      name &&
      name.trim() &&
      user.role === ROLES.TEAM_CAPTAIN &&
      (!user.name || user.name.startsWith('Walk-in'))
    ) {
      user.name = name.trim();
      await user.save();
    }
    return user;
  }

  const displayPhone = formatDisplay(normalized) || normalized;
  const emailLocal = String(normalized).replace(/\D/g, '');
  const email = `walkin.${emailLocal}@kulansiiye.local`;
  const existingEmail = await User.findOne({ email }).select('+passwordHash');
  if (existingEmail) {
    if (!existingEmail.passwordHash) {
      existingEmail.passwordHash = await User.hashPassword(`WalkIn${emailLocal.slice(-6)}!`);
      existingEmail.mustChangePassword = true;
      await existingEmail.save();
    }
    return existingEmail;
  }

  const passwordHash = await User.hashPassword(`WalkIn${emailLocal.slice(-6)}!`);
  try {
    return await User.create({
      name: (name && name.trim()) || `Walk-in ${displayPhone}`,
      email,
      phone: normalized,
      passwordHash,
      role: ROLES.TEAM_CAPTAIN,
      status: 'active',
      isPhoneVerified: true,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Race: another request created the same phone/email — reuse it.
    user = await User.findOne({
      $or: [{ phone: { $in: variants } }, { email }],
    });
    if (user) return user;
    throw ApiError.conflict(
      'This phone is already registered. Use the visitor captain number.',
      {
        code: 'PHONE_EXISTS',
        messageEn: 'This phone is already registered. Use the visitor captain number.',
        messageSo: 'Lambarkan waa hore u diiwaangashan — geli telefoonka captain-ka soo galay.',
        details: err.keyValue || err.keyPattern,
      }
    );
  }
}

async function getOwnerBooking(actor, bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate('field', 'name type capacity')
    .populate('stadium', 'name')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .populate('teamA.captain', 'name phone email')
    .populate('teamB.captain', 'name phone email');
  if (!booking) throw ApiError.notFound('Booking not found');
  await managerService.assertStadiumAccess(booking.stadium._id || booking.stadium, actor);
  const gateSummary = await buildGateSummary(booking);
  return {
    booking: bookingForOwner(actor, booking),
    gateSummary,
    detailCard: gateSummary.detailCard,
  };
}

/**
 * Owner/manager booking list with search filters.
 * Query: date (YYYY-MM-DD), time (HH:mm), from, to, name, phone, q, stadiumId, status, limit
 */
async function listOwnerBookings(actor, query = {}) {
  const stadiumIds = await accessibleStadiumIdsForActor(actor);
  if (!stadiumIds.length) return { bookings: [], cards: [], count: 0 };

  const filter = { stadium: { $in: stadiumIds } };

  if (query.stadiumId) {
    await managerService.assertStadiumAccess(query.stadiumId, actor);
    filter.stadium = query.stadiumId;
  }

  if (query.status) {
    filter.status = String(query.status).toUpperCase();
  }

  const dayStartEnd = (ymd) => {
    const start = new Date(`${ymd}T00:00:00`);
    const end = new Date(`${ymd}T23:59:59.999`);
    return { start, end };
  };

  if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    const { start, end } = dayStartEnd(query.date);
    filter.startTime = { $gte: start, $lte: end };
  } else if (query.from || query.to) {
    filter.startTime = {};
    if (query.from) filter.startTime.$gte = new Date(query.from);
    if (query.to) filter.startTime.$lte = new Date(query.to);
  }

  const nameQ = (query.name || '').trim();
  const phoneQ = (query.phone || '').trim();
  const freeQ = (query.q || query.search || '').trim();
  const codeQ = (query.bookingCode || '').trim().toUpperCase();

  if (codeQ) {
    filter.bookingCode = new RegExp(codeQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  // Resolve captain ids for name / phone / free-text search
  const captainOr = [];
  if (phoneQ || freeQ) {
    const phoneCandidates = [];
    if (phoneQ) phoneCandidates.push(...phoneLookupVariants(phoneQ));
    if (freeQ && /\d/.test(freeQ)) phoneCandidates.push(...phoneLookupVariants(freeQ));
    if (phoneCandidates.length) {
      const usersByPhone = await User.find({ phone: { $in: phoneCandidates } }).select('_id');
      if (usersByPhone.length) {
        const ids = usersByPhone.map((u) => u._id);
        captainOr.push({ 'teamA.captain': { $in: ids } }, { 'teamB.captain': { $in: ids } });
      } else if (phoneQ && !nameQ && !freeQ.replace(/\d/g, '').trim()) {
        // Explicit phone with no match → empty
        return { bookings: [], cards: [], count: 0 };
      }
    }
  }

  if (nameQ || (freeQ && /[a-zA-Z\u0600-\u06FF]/.test(freeQ))) {
    const nameTerm = nameQ || freeQ;
    const rx = new RegExp(nameTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const usersByName = await User.find({ name: rx }).select('_id').limit(50);
    if (usersByName.length) {
      const ids = usersByName.map((u) => u._id);
      captainOr.push({ 'teamA.captain': { $in: ids } }, { 'teamB.captain': { $in: ids } });
    }
    captainOr.push({ bookingCode: rx });
  }

  if (captainOr.length) {
    filter.$or = captainOr;
  }

  const limit = Math.min(Number(query.limit) || 100, 200);
  let bookings = await Booking.find(filter)
    .populate('field', 'name type')
    .populate('stadium', 'name')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .populate('teamA.captain', 'name phone email')
    .populate('teamB.captain', 'name phone email')
    .sort({ startTime: -1 })
    .limit(limit);

  // Optional HH:mm filter — slot whose local start matches or contains that time
  const timeQ = (query.time || '').trim();
  if (timeQ && /^\d{1,2}:\d{2}$/.test(timeQ)) {
    const [hh, mm] = timeQ.split(':').map(Number);
    const target = hh * 60 + mm;
    bookings = bookings.filter((b) => {
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      const startMins = s.getUTCHours() * 60 + s.getUTCMinutes();
      const endMins = e.getUTCHours() * 60 + e.getUTCMinutes();
      if (startMins === target) return true;
      if (endMins > startMins) return target >= startMins && target < endMins;
      // overnight slot
      return target >= startMins || target < endMins;
    });
  }

  const cards = [];
  for (const b of bookings) {
    const payments = await loadPaidPaymentsForBooking(b._id);
    cards.push(buildOwnerDetailCard(b, payments));
  }

  return {
    bookings: ownerCanSeeCommission(actor) ? bookings : bookings.map(redactCommissionOnBooking),
    cards,
    count: bookings.length,
  };
}

async function accessibleStadiumIdsForActor(user) {
  if (user.role === ROLES.STADIUM_MANAGER) {
    return managerService.getManagedStadiumIds(user.id);
  }
  const owned = await Stadium.find({ owner: user.id }).select('_id');
  const managed = await managerService.getManagedStadiumIds(user.id);
  return [...owned.map((s) => s._id), ...managed];
}

module.exports = {
  createHold,
  inviteTeamB,
  inviteTeamBByPhone,
  managerGateCheckIn,
  createWalkInBooking,
  getOwnerBooking,
  listOwnerBookings,
  buildGateSummary,
  buildOwnerDetailCard,
  buildMatchPassCard,
  assertTransition,
  expireStaleHolds,
  forceClearHolds,
  expireBookingHoldNow,
  assertSlotIsFree,
  resolveTeamForCaptain,
  isSoftExpiredHold,
};
