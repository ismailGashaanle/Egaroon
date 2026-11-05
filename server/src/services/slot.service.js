const Field = require('../models/Field');
const Booking = require('../models/Booking');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const RecurringBooking = require('../models/RecurringBooking');
const { recurringOverlapsRange, teamDisplayName } = require('./recurring.service');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { isBookingFullyPaid } = require('./payment.service');
const { calculatePrice, applyDiscountToPrice } = require('./pricing.service');
const { loadActiveDiscountsForField, pickBestDiscount } = require('./discount.service');
const { wallClockHHMM, venueNow, venueClockSnapshot } = require('../utils/venueClock');

const LIVE_STATUSES = [
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.PAYMENT_PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
];

/** Booking statuses that mean the match is fully paid / locked as rented. */
const BOOKED_STATUSES = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
];

function parseHHMM(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return fallback;
  return { h, m: Number.isNaN(m) ? 0 : m };
}

function resolveSelectedUntil(booking) {
  return (
    booking.teamBPaymentDueAt ||
    booking.holdExpiresAt ||
    booking.teamB?.paymentDeadline ||
    booking.teamA?.paymentDeadline ||
    null
  );
}

/**
 * Public slot state from a live booking.
 * - booked: both sides paid (or coverFullMatch) / CONFIRMED+
 * - selected (held): HELD or PAYMENT_PENDING with incomplete payment — temporary lock
 * - available: hold / Team B wait already past selectedUntil (even if EXPIRED write lags)
 */
function classifyBookingSlot(booking) {
  const fullyPaid =
    BOOKED_STATUSES.includes(booking.status) || isBookingFullyPaid(booking);

  if (fullyPaid) {
    return {
      state: 'booked',
      reason: booking.status,
      labelHint: 'BOOKED',
      holdExpiresAt: null,
      selectedUntil: null,
    };
  }

  // HELD / PAYMENT_PENDING (Team A only, or unpaid hold)
  const selectedUntil = resolveSelectedUntil(booking);

  // Hold window ended — unlock for listings immediately (scheduler will mark EXPIRED).
  if (selectedUntil && new Date(selectedUntil).getTime() <= Date.now()) {
    return {
      state: 'available',
      reason: 'HOLD_EXPIRED',
      labelHint: null,
      holdExpiresAt: null,
      selectedUntil: null,
    };
  }

  // Orphan live hold with no deadline: treat as available after configured hold window
  // so UI matches createHold reclaim logic (Atlas / memory redis lag).
  if (!selectedUntil && booking.createdAt) {
    const { getBusiness } = require('./platformSettings.service');
    const holdMs = (getBusiness().bookingHoldMinutes || 10) * 60 * 1000;
    if (new Date(booking.createdAt).getTime() + holdMs <= Date.now()) {
      return {
        state: 'available',
        reason: 'HOLD_EXPIRED',
        labelHint: null,
        holdExpiresAt: null,
        selectedUntil: null,
      };
    }
  }

  const waitingTeamB =
    booking.status === BOOKING_STATUS.PAYMENT_PENDING || Boolean(booking.teamAPaidAt);

  const { getBusiness } = require('./platformSettings.service');
  const biz = getBusiness();
  const policyMinutes = waitingTeamB
    ? biz.teamBPaymentDeadlineMinutes ?? 10
    : biz.bookingHoldMinutes ?? 10;

  return {
    state: 'selected',
    reason: booking.status,
    labelHint: waitingTeamB ? 'WAITING_TEAM_B' : 'HOLD',
    holdExpiresAt: selectedUntil,
    selectedUntil,
    policyMinutes,
    waitingTeamB,
    labelSo: waitingTeamB
      ? `La doortay · sugaya Team B (${policyMinutes} daq)`
      : `La doortay · hold (${policyMinutes} daq)`,
  };
}

/**
 * Build hourly slots for a field on a given calendar date (venue wall clock).
 * YYYY-MM-DD + openingTime HH:mm → UTC clock hours (no EAT offset).
 * Joogto `20:00` matches the 20:00–21:00 cell. See utils/venueClock.js.
 * Marks each slot: available | selected | booked | blocked | past
 * `past` = empty hour that already started (lost inventory). Occupied hours
 * stay booked / selected / joogto / blocked. Captains never receive `past`.
 */
async function getFieldSlots({ fieldId, date, includeLostSlots = false }) {
  const field = await Field.findById(fieldId);
  if (!field) throw ApiError.notFound('Field not found');

  const day = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    throw ApiError.badRequest('Invalid date — use YYYY-MM-DD');
  }

  const open = parseHHMM(field.openingTime || '06:00', { h: 6, m: 0 });
  const close = parseHHMM(field.closingTime || '23:00', { h: 23, m: 0 });

  const dayStart = new Date(day);
  dayStart.setUTCHours(open.h, open.m, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setUTCHours(close.h, close.m, 0, 0);

  const [bookings, blocks, recurring, discounts] = await Promise.all([
    Booking.find({
      field: fieldId,
      status: { $in: LIVE_STATUSES },
      startTime: { $lt: dayEnd },
      endTime: { $gt: dayStart },
    }).select(
      'startTime endTime status holdExpiresAt teamBPaymentDueAt teamAPaidAt coveredFullMatch createdAt teamA.paymentStatus teamA.paymentDeadline teamB.paymentStatus teamB.paymentDeadline'
    ),
    AvailabilityBlock.find({
      startsAt: { $lt: dayEnd },
      endsAt: { $gt: dayStart },
      $or: [
        { field: fieldId },
        { scope: 'stadium', stadium: field.stadium },
      ],
    }),
    RecurringBooking.find({
      field: fieldId,
      status: 'active',
      startDate: { $lte: dayEnd },
      $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: dayStart } }],
    }),
    loadActiveDiscountsForField(field),
  ]);

  const basePrice = calculatePrice(field);
  const bookingFinance = require('./bookingFinance.service');
  let feePerTeam = 0;
  let feeFullMatch = 0;
  try {
    const { snapshot } = await bookingFinance.buildForStadium(field.stadium, {
      rentTotal: basePrice.totalPrice,
      teamShare: basePrice.teamShare,
    });
    feePerTeam = bookingFinance.feesForSide(snapshot, 'teamA', { coverFullMatch: false });
    feeFullMatch = bookingFinance.feesForSide(snapshot, 'teamA', { coverFullMatch: true });
  } catch {
    feePerTeam = 0;
    feeFullMatch = 0;
  }

  const slots = [];
  const cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCHours(end.getUTCHours() + 1);
    if (end > dayEnd) break;

    let state = 'available';
    let reason = null;
    let bookingId = null;
    let holdExpiresAt = null;
    let selectedUntil = null;
    let labelHint = null;
    let labelSo = null;
    let teamName = null;
    let policyMinutes = null;
    let waitingTeamB = false;

    // Booked / held / blocked win over "past" so owners can tell history vs lost empty hours.
    const booking = bookings.find((b) => b.startTime < end && b.endTime > start);
    if (booking) {
      const classified = classifyBookingSlot(booking);
      if (classified.state !== 'available') {
        state = classified.state;
        reason = classified.reason;
        labelHint = classified.labelHint;
        holdExpiresAt = classified.holdExpiresAt;
        selectedUntil = classified.selectedUntil;
        bookingId = booking._id;
        labelSo = classified.labelSo || null;
        policyMinutes = classified.policyMinutes ?? null;
        waitingTeamB = Boolean(classified.waitingTeamB);
      }
    }

    if (state === 'available') {
      const block = blocks.find((b) => b.startsAt < end && b.endsAt > start);
      if (block) {
        state = 'blocked';
        reason =
          block.scope === 'stadium'
            ? `STADIUM_LOCK:${block.type || 'owner_block'}`
            : block.type || block.reason || 'BLOCKED';
        labelSo = 'Xiran';
      }
    }

    if (state === 'available') {
      const rec = recurring.find((r) => recurringOverlapsRange(r, start, end));
      if (rec) {
        // Privacy protection: hide public team name if hidePublicInfo is true (default)
        // to prevent impostors from showing up at the gate claiming to be this team.
        const shouldHide = rec.hidePublicInfo !== false;
        state = 'booked';
        reason = shouldHide ? 'RECURRING:RESERVED' : `RECURRING:${teamDisplayName(rec)}`;
        labelHint = 'RECURRING';
        teamName = shouldHide ? null : (rec.teamName || null);
        labelSo = 'Joogto · Lama heli karo';
      }
    }

    if (state === 'available' && start.getTime() <= venueNow().getTime()) {
      state = 'past';
      reason = 'PAST';
      labelSo = 'Dhacay';
    }

    if (state === 'available') labelSo = 'Banaan';
    if (state === 'booked' && labelHint !== 'RECURRING') labelSo = 'La kiraystay';

    const priced = applyDiscountToPrice(
      basePrice,
      pickBestDiscount(
        discounts,
        { fieldId: field._id, stadiumId: field.stadium, startTime: start },
        basePrice.totalPrice
      )
    );

    const waitingMs = selectedUntil
      ? Math.max(0, new Date(selectedUntil).getTime() - Date.now())
      : 0;

    slots.push({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      startLabel: wallClockHHMM(start),
      endLabel: wallClockHHMM(end),
      state,
      lost: state === 'past',
      reason,
      bookingId,
      holdExpiresAt: holdExpiresAt ? new Date(holdExpiresAt).toISOString() : null,
      selectedUntil: selectedUntil ? new Date(selectedUntil).toISOString() : null,
      waitingSeconds: Math.ceil(waitingMs / 1000),
      policyMinutes,
      waitingTeamB,
      labelHint,
      labelSo,
      teamName,
      isRecurring: labelHint === 'RECURRING',
      pricing: {
        currency: priced.currency,
        baseTotalPrice: priced.baseTotalPrice,
        totalPrice: priced.totalPrice,
        stadiumRentTotal: priced.totalPrice,
        teamShare: priced.teamShare,
        platformFee: feePerTeam,
        platformFeeFullMatch: feeFullMatch,
        payableTeamShare: Math.round((priced.teamShare + feePerTeam) * 100) / 100,
        payableFullMatch: Math.round((priced.totalPrice + feeFullMatch) * 100) / 100,
        discountAmount: priced.discountAmount || 0,
        discountPercent: priced.discountPercent ?? null,
        discountName: priced.discountName || null,
      },
    });

    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  const { getBusiness } = require('./platformSettings.service');
  const biz = getBusiness();
  const clock = venueClockSnapshot();
  const lostCount = slots.filter((s) => s.state === 'past').length;
  const visible = includeLostSlots ? slots : slots.filter((s) => s.state !== 'past');

  return {
    fieldId: field._id,
    date,
    openingTime: field.openingTime || '06:00',
    closingTime: field.closingTime || '23:00',
    clock,
    includeLostSlots: Boolean(includeLostSlots),
    ...(includeLostSlots ? { lostCount } : {}),
    paymentPolicy: {
      bookingHoldMinutes: biz.bookingHoldMinutes ?? 10,
      teamBPaymentDeadlineMinutes: biz.teamBPaymentDeadlineMinutes ?? 10,
      releaseSlotOnPartialPaymentTimeout: biz.releaseSlotOnPartialPaymentTimeout !== false,
    },
    slots: visible,
  };
}

module.exports = { getFieldSlots, LIVE_STATUSES, classifyBookingSlot, BOOKED_STATUSES };
