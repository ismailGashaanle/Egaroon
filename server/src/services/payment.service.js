const { randomUUID: uuid } = require('crypto');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const { calculateCommission } = require('./pricing.service');
const { getPaymentProvider } = require('../providers/payment');
const { emitFieldUpdate } = require('../sockets');
const { getBusiness } = require('./platformSettings.service');
const {
  normalizeSomaliPhone,
  phoneMatchesOperator,
  phoneLookupVariants,
  getCarrierById,
  formatDisplay,
} = require('../utils/somaliPhone');
const { sanitizePersonName, stripControlChars } = require('../utils/sanitizeInput');

const OPERATORS = ['hormuud', 'telesom', 'somtel', 'golis'];

function assertObjectId(id, label = 'id') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
  return String(id);
}

function sideKey(booking, teamId) {
  if (booking.teamA.team.toString() === teamId) return 'teamA';
  if (booking.teamB && booking.teamB.team.toString() === teamId) return 'teamB';
  return null;
}

function teamShareOf(booking) {
  if (booking.pricing?.teamShare != null) return booking.pricing.teamShare;
  return Math.round((Number(booking.pricing.totalPrice) / 2) * 100) / 100;
}

function refreshHold(booking) {
  const holdExpiresAt = new Date(Date.now() + getBusiness().bookingHoldMinutes * 60 * 1000);
  booking.holdExpiresAt = holdExpiresAt;
  if (booking.teamA) booking.teamA.paymentDeadline = holdExpiresAt;
  if (booking.teamB) booking.teamB.paymentDeadline = holdExpiresAt;
  return holdExpiresAt;
}

/**
 * BR-005 / BR-005b: Team B priority window (demand-based; default 12 min).
 * Prefer opponentWindow.service.startOpponentWindow after Team A split pay.
 */
function applyTeamBPaymentWindow(booking, fromDate = new Date()) {
  const biz = getBusiness();
  const minutes = Number(biz.teamBPriorityMinutes ?? biz.teamBPaymentDeadlineMinutes) || 12;
  const due = new Date(fromDate.getTime() + minutes * 60 * 1000);
  booking.teamBPaymentDueAt = due;
  booking.holdExpiresAt = due;
  if (booking.teamB) booking.teamB.paymentDeadline = due;
  if (!booking.opponentWindow?.phase) {
    booking.opponentWindow = {
      phase: 'PRIORITY',
      priorityEndsAt: due,
      graceExtensionsUsed: 0,
      competingAttemptCount: 0,
      lastAlertLevel: 0,
    };
  }
  return due;
}

function isSidePaid(party) {
  if (!party) return false;
  return (
    party.paymentStatus === PAYMENT_STATUS.SUCCESS ||
    party.paymentStatus === PAYMENT_STATUS.HELD ||
    party.paymentStatus === PAYMENT_STATUS.SETTLED
  );
}

/** Match is fully paid when A covered both sides, or both teams paid their share. */
function isBookingFullyPaid(booking) {
  if (booking.coveredFullMatch) return true;
  if (!isSidePaid(booking.teamA)) return false;
  if (!booking.teamB) return false;
  return isSidePaid(booking.teamB);
}

async function findUserByPhone(phone) {
  const normalized = normalizeSomaliPhone(phone);
  if (!normalized) return null;
  const variants = phoneLookupVariants(normalized);
  let user = await User.findOne({ phone: { $in: variants } });
  if (user) return user;
  const candidates = await User.find({ phone: { $exists: true, $ne: '' } }).select('phone name');
  return candidates.find((u) => normalizeSomaliPhone(u.phone) === normalized) || null;
}

function validateOperatorAndPhone(operator, phone) {
  const op = String(operator || '').toLowerCase();
  if (!OPERATORS.includes(op)) {
    throw ApiError.badRequest(
      `Operator must be one of: ${OPERATORS.join(', ')} / Dooro: Hormuud, Telesom, Somtel, Golis`
    );
  }
  const carrier = getCarrierById(op);
  const normalized = normalizeSomaliPhone(phone);
  if (!normalized) {
    throw ApiError.badRequest(
      `Invalid Somali mobile. Use ${carrier?.prefixes?.[0] || '061'}… / Lambarka ma saxna`
    );
  }
  if (!phoneMatchesOperator(normalized, op)) {
    throw ApiError.badRequest(
      `Phone must match ${carrier?.label || op} (${carrier?.prefixes?.[0]}). / Lambarku waa inuu noqdaa ${carrier?.prefixes?.[0]}`
    );
  }
  return { operator: op, phone: normalized };
}

/**
 * Initiate MM payment for a booking side.
 * Amount always from server pricing — never from client.
 */
async function initiatePayment({
  bookingId,
  teamId,
  side: sideHint,
  payerId,
  idempotencyKey,
  coverFullMatch = false,
  operator,
  carrierId,
  phone,
  payerPhone,
  payerName,
  teamBContactPhone,
  teamBContactName,
  invitePhoneTeamB,
  forceInsufficient = false,
  currency: reqCurrency,
  payCurrency: reqPayCurrency,
}) {
  assertObjectId(bookingId, 'bookingId');
  if (teamId) assertObjectId(teamId, 'teamId');
  assertObjectId(payerId, 'payerId');

  // Snapshot display name (required). Never trust client amounts — ignored entirely.
  const payerNameClean = sanitizePersonName(payerName);
  if (!payerNameClean) {
    throw ApiError.badRequest(
      'Captain name: 2–80 letters/spaces only / Magaca: xarafyo iyo boosas kaliya'
    );
  }

  if (idempotencyKey) {
    const existing = await Payment.findOne({
      idempotencyKey: stripControlChars(String(idempotencyKey), { max: 128 }),
    });
    if (existing) {
      return {
        payment: existing,
        checkout: {
          provider: existing.provider,
          providerReference: existing.providerReference,
          status: existing.status,
          mode: existing.provider === 'mock' ? 'mock' : 'live',
          idempotent: true,
        },
        payerRegistered: existing.payerRegistered,
        warning: existing.payerRegistered
          ? null
          : 'Lambarkan ma diiwaangashna — waa la wici doonaa lacag-bixinta. Reference ayaa la hayaa; akoon cusub lama abuuro.',
      };
    }
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');

  if ([BOOKING_STATUS.EXPIRED, BOOKING_STATUS.CANCELLED].includes(booking.status)) {
    throw ApiError.conflict('This booking was released or cancelled — the slot is free for others');
  }

  let side = sideHint;
  if (teamId) {
    const fromTeam = sideKey(booking, teamId);
    if (!fromTeam) throw ApiError.forbidden('Team is not part of this booking');
    side = fromTeam;
  }
  if (!side || !['teamA', 'teamB'].includes(side)) {
    throw ApiError.badRequest('side must be teamA or teamB (or provide teamId)');
  }
  if (!booking[side]) {
    throw ApiError.badRequest(`Booking has no ${side} yet`);
  }

  const resolvedTeamId = booking[side].team.toString();

  // Captain of that side (or Team A covering full match) must be the initiator
  const rawCaptain = booking[side].captain;
  const sideCaptainId = (rawCaptain?._id || rawCaptain)?.toString?.();
  const teamACaptainId = (booking.teamA.captain?._id || booking.teamA.captain)?.toString?.();
  if (sideCaptainId !== payerId && !(coverFullMatch && side === 'teamA' && teamACaptainId === payerId)) {
    throw ApiError.forbidden('Only the team captain can pay this side');
  }

  if (coverFullMatch && side !== 'teamA') {
    throw ApiError.badRequest('Only Team A captain can pay the full match for both teams');
  }

  const party = booking[side];
  if (isSidePaid(party) && !coverFullMatch) {
    throw ApiError.conflict('This team has already paid');
  }
  if (booking.coveredFullMatch) {
    throw ApiError.conflict('This match is already fully paid');
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    // Demand-based: may still extend / protect PROCESSING
    try {
      const opponentWindow = require('./opponentWindow.service');
      const evalResult = await opponentWindow.evaluateOpponentWindow(booking);
      if (evalResult?.released || booking.status === BOOKING_STATUS.EXPIRED) {
        throw ApiError.conflict(
          'Opponent payment window expired. Slot released — Team A gets refund/credit; book again as new Team A.',
          {
            code: 'OPPONENT_WINDOW_EXPIRED',
            messageSo: 'Waqtigii wuu dhacay — boosku wuu furmay. Samee ballan cusub.',
          }
        );
      }
      // Reload deadlines after possible extension
      const refreshed = await Booking.findById(bookingId);
      if (refreshed) {
        booking.holdExpiresAt = refreshed.holdExpiresAt;
        booking.teamBPaymentDueAt = refreshed.teamBPaymentDueAt;
        booking.status = refreshed.status;
        booking.opponentWindow = refreshed.opponentWindow;
      }
      if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
        throw ApiError.conflict('Payment window expired. Slot is released — search and book again.');
      }
    } catch (err) {
      if (err.isApiError) throw err;
      throw ApiError.conflict('Payment window expired. Slot is released — search and book again.');
    }
  }

  // Block duplicate in-flight payments for same side
  const inflight = await Payment.findOne({
    booking: booking._id,
    side,
    status: PAYMENT_STATUS.PROCESSING,
    coverFullMatch: Boolean(coverFullMatch),
  }).sort({ createdAt: -1 });
  if (inflight) {
    return {
      payment: inflight,
      checkout: {
        provider: inflight.provider,
        providerReference: inflight.providerReference,
        status: inflight.status,
        mode: inflight.provider === 'mock' ? 'mock' : 'live',
        reuse: true,
      },
      payerRegistered: inflight.payerRegistered,
      warning: inflight.payerRegistered
        ? null
        : 'Lambarkan ma diiwaangashna — waa la wici doonaa lacag-bixinta. Reference ayaa la hayaa; akoon cusub lama abuuro.',
    };
  }

  // Amount always from booking pricing snapshot — never from client body.
  const bookingFinance = require('./bookingFinance.service');
  const fullPayable = Number(
    booking.pricing?.payableFullMatch ??
      (Number(booking.pricing?.totalPrice || 0) +
        bookingFinance.feesForSide(booking.financialSnapshot, 'teamA', { coverFullMatch: true }))
  );
  const amount = coverFullMatch ? fullPayable : Number(party.amountDue);
  if (!amount || amount <= 0) {
    throw ApiError.badRequest('Nothing due for this team');
  }

  const opRaw = operator || carrierId;
  const payerMsisdnRaw = payerPhone || phone;
  const { operator: op, phone: msisdn } = validateOperatorAndPhone(opRaw, payerMsisdnRaw);

  let teamBContactNorm = null;
  if (side === 'teamB' || teamBContactPhone) {
    if (teamBContactPhone) {
      teamBContactNorm = normalizeSomaliPhone(teamBContactPhone);
      if (!teamBContactNorm) {
        throw ApiError.badRequest('Team B contact phone is invalid / Lambarka Team B ma saxna');
      }
    }
  }

  /** Optional invite lock for Team A split pay (applied after Match Code is generated). */
  let invitePhoneNorm = null;
  if (invitePhoneTeamB) {
    if (side !== 'teamA' || coverFullMatch) {
      throw ApiError.badRequest('invitePhoneTeamB is only for Team A split payment');
    }
    invitePhoneNorm = normalizeSomaliPhone(invitePhoneTeamB);
    if (!invitePhoneNorm) {
      throw ApiError.badRequest('Team B invite phone is invalid / Lambarka Team B ma saxna');
    }
    if (invitePhoneNorm === msisdn) {
      throw ApiError.badRequest('Invite phone cannot be the same as payer phone');
    }
  }

  const registeredUser = await findUserByPhone(msisdn);
  const payerRegistered = Boolean(registeredUser);

  const provider = getPaymentProvider(undefined, { operator: op });

  const contactNameClean = teamBContactName ? sanitizePersonName(teamBContactName) : null;

  // Currency & exchange rate dynamic handling (USD vs Somaliland Shillings)
  const chosenCurrency = String(reqPayCurrency || reqCurrency || booking.pricing.currency || 'USD').toUpperCase();
  const isSll = chosenCurrency === 'SLL' || chosenCurrency === 'SLSH';
  const { getBusiness } = require('./platformSettings.service');
  const biz = getBusiness();
  const rate = Number(booking.financialSnapshot?.sllPerUsd || biz.sllPerUsd || 8500);
  const amountUsd = amount;
  const amountSll = Math.round(amountUsd * rate);
  const amountToCharge = isSll ? amountSll : amountUsd;
  const finalCurrency = isSll ? 'SLL' : 'USD';

  // Create intent row first so provider metadata / webhooks carry our payment id
  const payment = await Payment.create({
    booking: booking._id,
    team: resolvedTeamId,
    payer: payerId,
    side,
    amount: amountToCharge,
    currency: finalCurrency,
    payCurrency: finalCurrency,
    amountUsd,
    amountSll,
    exchangeRate: rate,
    status: PAYMENT_STATUS.PENDING,
    provider: provider.name,
    operator: op,
    payerPhone: msisdn,
    msisdn,
    payerName: payerNameClean,
    teamBContactPhone: teamBContactNorm || undefined,
    teamBContactName: contactNameClean || undefined,
    invitePhoneTeamB: invitePhoneNorm || undefined,
    payerRegistered,
    providerReference: `pending-${uuid()}`,
    idempotencyKey: idempotencyKey
      ? stripControlChars(String(idempotencyKey), { max: 128 })
      : uuid(),
    coverFullMatch: Boolean(coverFullMatch),
  });

  let intent;
  try {
    intent = await provider.initiate({
      amount: amountToCharge,
      currency: finalCurrency,
      phone: msisdn,
      operator: op,
      metadata: {
        bookingId: booking._id.toString(),
        teamId: resolvedTeamId,
        side,
        coverFullMatch: Boolean(coverFullMatch),
        paymentId: payment._id.toString(),
        amountUsd,
        amountSll,
        exchangeRate: rate,
        forceInsufficient: Boolean(forceInsufficient),
      },
    });
  } catch (err) {
    payment.status = PAYMENT_STATUS.FAILED;
    payment.failureReason =
      err.code === 'INSUFFICIENT_FUNDS' || err.balance?.reason === 'INSUFFICIENT_FUNDS'
        ? err.message || 'Lacagta kuma filna — Insufficient mobile-money balance'
        : err.message || 'Payment initiate failed';
    await payment.save();
    if (err.code === 'INSUFFICIENT_FUNDS' || err.balance?.reason === 'INSUFFICIENT_FUNDS') {
      throw ApiError.badRequest(payment.failureReason);
    }
    throw err;
  }

  payment.status = PAYMENT_STATUS.PROCESSING;
  payment.providerReference = intent.providerReference || payment.providerReference;
  await payment.save();

  party.paymentStatus = PAYMENT_STATUS.PROCESSING;
  await booking.save();

  emitFieldUpdate(booking.field.toString(), 'payment:received', {
    bookingId: booking._id,
    paymentId: payment._id,
    status: payment.status,
    side,
  });

  // Provider already collected the money (e.g. Sifalo code 601): confirm now, don't wait for a webhook.
  let resultPayment = payment;
  if (intent.status === 'paid' && intent.verified) {
    await applyProviderVerification(payment, intent.verified);
    resultPayment = (await Payment.findById(payment._id)) || payment;
  }

  return {
    payment: resultPayment,
    checkout: intent,
    payerRegistered,
    warning: payerRegistered
      ? null
      : 'Lambarkan ma diiwaangashna — waa la wici doonaa lacag-bixinta. Reference ayaa la hayaa; akoon cusub lama abuuro.',
    displayPhone: formatDisplay(msisdn),
  };
}

async function getPaymentStatus(paymentId, requesterId, role) {
  const payment = await Payment.findById(paymentId).populate({
    path: 'booking',
    select: 'status teamA teamB field stadium pricing holdExpiresAt coveredFullMatch bookingCode',
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  const isOwner = payment.payer.toString() === requesterId;
  const isAdmin = ['admin', 'super_admin'].includes(role);
  if (!isOwner && !isAdmin) throw ApiError.forbidden('Not your payment');

  // Sifalo only sends one webhook (at charge time), so a payment the customer approves later
  // is confirmed here, by asking Sifalo directly.
  if (payment.status === PAYMENT_STATUS.PROCESSING && payment.provider === 'sifalopay') {
    const changed = await reconcileProviderPayment(payment);
    if (changed) {
      return Payment.findById(paymentId).populate({
        path: 'booking',
        select: 'status teamA teamB field stadium pricing holdExpiresAt coveredFullMatch bookingCode',
      });
    }
  }
  return payment;
}

const normCurrency = (c) => {
  const v = String(c || '').toUpperCase();
  return v === 'SLSH' ? 'SLL' : v || 'USD';
};

/** The amount/currency the provider says it collected must be what we asked for. */
function providerAmountMatches(payment, verified) {
  if (verified.amount == null) return false;
  if (normCurrency(verified.currency) !== normCurrency(payment.currency)) return false;
  const tolerance = normCurrency(payment.currency) === 'SLL' ? 1 : 0.01;
  return Math.abs(Number(verified.amount) - Number(payment.amount)) <= tolerance;
}

/**
 * Apply an authoritative provider answer ({ status, sid, amount, currency }) to a payment.
 * A "succeeded" answer for the wrong amount/currency is never confirmed.
 */
async function applyProviderVerification(payment, verified) {
  if (verified.status === 'succeeded') {
    if (!providerAmountMatches(payment, verified)) {
      console.warn(
        `[payment] ${payment._id} provider amount mismatch: got ${verified.amount} ${verified.currency}, expected ${payment.amount} ${payment.currency}`
      );
      return false;
    }
    await confirmPaymentSuccess({
      paymentId: payment._id,
      providerReference: verified.sid,
      eventId: `${payment.provider}-${verified.sid}-succeeded`,
    });
    return true;
  }
  if (verified.status === 'failed') {
    await confirmPaymentFailure({
      paymentId: payment._id,
      reason: verified.message || 'Payment was declined by the provider',
      eventId: `${payment.provider}-${verified.sid || payment._id}-failed`,
    });
    return true;
  }
  return false; // still pending
}

/** Ask Sifalo about one PROCESSING payment. Never throws. Returns true when its state changed. */
async function reconcileProviderPayment(payment) {
  try {
    const provider = getPaymentProvider('sifalopay');
    const hasSid = payment.providerReference && !String(payment.providerReference).startsWith('pending-');
    const verified = await provider.verify(
      hasSid ? { sid: payment.providerReference } : { orderId: String(payment._id) }
    );
    if (!verified.found) return false; // charge not registered (yet)
    // The sid must belong to THIS payment.
    if (verified.orderId && String(verified.orderId) !== String(payment._id)) return false;
    return await applyProviderVerification(payment, verified);
  } catch (err) {
    console.warn('[payment] provider reconcile failed', String(payment._id), err.message);
    return false;
  }
}

/** Job: settle Sifalo payments the customer approved after the charge call returned. */
async function reconcileProcessingPayments({ maxAgeMinutes = 30, limit = 50 } = {}) {
  const since = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const rows = await Payment.find({
    provider: 'sifalopay',
    status: PAYMENT_STATUS.PROCESSING,
    createdAt: { $gte: since },
  }).limit(limit);
  let changed = 0;
  for (const payment of rows) {
    if (await reconcileProviderPayment(payment)) changed += 1;
  }
  return changed;
}

async function confirmPaymentSuccess({ paymentId, providerReference, eventId }) {
  assertObjectId(paymentId, 'paymentId');
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');

  if (eventId && payment.processedEventIds?.includes(eventId)) {
    return payment;
  }

  if (payment.status === PAYMENT_STATUS.SUCCESS || payment.status === PAYMENT_STATUS.HELD) {
    if (eventId) {
      payment.processedEventIds = [...(payment.processedEventIds || []), eventId];
      await payment.save();
    }
    return payment;
  }

  payment.status = PAYMENT_STATUS.HELD;
  payment.providerReference = providerReference || payment.providerReference;
  payment.paidAt = new Date();
  if (eventId) {
    payment.processedEventIds = [...(payment.processedEventIds || []), eventId];
  }
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw ApiError.notFound('Booking not found');

  const side = payment.side || sideKey(booking, payment.team.toString());
  if (!side) throw ApiError.conflict('Payment team is not on this booking');

  const wasFullyPaid = isBookingFullyPaid(booking);

  if (payment.coverFullMatch) {
    booking.coveredFullMatch = true;
    booking.teamAPaidAt = payment.paidAt;
    booking.teamA.paymentStatus = PAYMENT_STATUS.HELD;
    booking.teamA.amountDue = teamShareOf(booking);
    if (booking.teamB) {
      booking.teamB.paymentStatus = PAYMENT_STATUS.HELD;
      booking.teamB.amountDue = 0;
    }
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.holdExpiresAt = undefined;
    booking.teamBPaymentDueAt = undefined;
  } else {
    booking[side].paymentStatus = PAYMENT_STATUS.HELD;

      if (side === 'teamA') {
      booking.teamAPaidAt = payment.paidAt;
      // Always snapshot canonical 252… payer MSISDN (anti-scam join factor).
      const payPhone = normalizeSomaliPhone(payment.payerPhone || payment.msisdn);
      if (payPhone) booking.teamAPayerPhone = payPhone;
    }

    if (isBookingFullyPaid(booking)) {
      booking.status = BOOKING_STATUS.CONFIRMED;
      booking.holdExpiresAt = undefined;
      booking.teamBPaymentDueAt = undefined;
      if (booking.opponentWindow) booking.opponentWindow.phase = 'CLOSED';
    } else {
      booking.status = BOOKING_STATUS.PAYMENT_PENDING;
      if (side === 'teamA') {
        // BR-005b: open Match Code + demand-based priority window (with or without Team B yet)
        const opponentWindow = require('./opponentWindow.service');
        await opponentWindow.startOpponentWindow(
          booking,
          payment.paidAt || new Date(),
          payment.payerPhone || payment.msisdn
        );
      } else {
        refreshHold(booking);
      }
    }
  }

  // Snapshot commission % when first payment succeeds so later policy changes
  // do not rewrite in-flight / historical settlement math (BR-009).
  if (booking.commissionPercent == null) {
    booking.commissionPercent = getBusiness().platformCommissionPercent;
  }

  await booking.save();

  const nowFullyPaid = isBookingFullyPaid(booking) || booking.status === BOOKING_STATUS.CONFIRMED;

  // Credit rent portion to Stadium E-Garoon Wallet (Escrow held until check-in/match)
  try {
    const egaroonWalletService = require('./egaroonWallet.service');
    const rentShare = payment.rentAmount != null
      ? payment.rentAmount
      : Math.max(0, (payment.amount || 0) - (payment.platformBookingFeeAmount || 0));
    await egaroonWalletService.holdBookingPayment(booking, rentShare, payment);
  } catch (_escrowErr) {
    console.warn('[payment] escrow hold failed:', _escrowErr.message);
  }

  // Apply optional Team B invite lock requested at initiate (after Match Code exists)
  if (
    side === 'teamA' &&
    !payment.coverFullMatch &&
    payment.invitePhoneTeamB &&
    booking.matchCode &&
    !booking.teamB &&
    !booking.invitePhone
  ) {
    try {
      const inviteNorm = normalizeSomaliPhone(payment.invitePhoneTeamB);
      const payerNorm = normalizeSomaliPhone(booking.teamAPayerPhone);
      if (inviteNorm && inviteNorm !== payerNorm) {
        booking.invitePhone = inviteNorm;
        await booking.save();
      }
    } catch (err) {
      console.warn('[payment] invitePhone lock failed', err.message);
    }
  }

  // Notify Team A with Match Code after split pay
  if (
    side === 'teamA' &&
    !payment.coverFullMatch &&
    !nowFullyPaid &&
    booking.matchCode
  ) {
    try {
      const { notifyUser } = require('./notification.service');
      const { TEAM_A_WAITING_MSG_SO } = require('./opponentWindow.service');
      await notifyUser({
        userId: booking.teamA.captain,
        type: 'MATCH_CODE_READY',
        title: 'Match Code diyaar',
        body: `${TEAM_A_WAITING_MSG_SO} Code: ${booking.matchCode} — copy oo u dir kabtanka Team B.`,
        bookingId: booking._id,
        dedupeKey: `match_code:${booking._id}`,
        meta: {
          matchCode: booking.matchCode,
          messageSo: TEAM_A_WAITING_MSG_SO,
          opponentWindow: require('./opponentWindow.service').describeWindow(booking),
        },
      });
    } catch (err) {
      console.warn('[payment] match code notify failed', err.message);
    }
  }

  try {
    const { notifyStadiumStaff } = require('./notification.service');
    const Stadium = require('../models/Stadium');
    const stadium = await Stadium.findById(booking.stadium).select('name');
    const stadiumName = stadium?.name || 'Garoon';
    const isSll = payment.currency === 'SLL' || payment.payCurrency === 'SLL';
    const amountStr = isSll
      ? `${Number(payment.amountSll || payment.amount).toLocaleString()} SlSh ($${Number(payment.amountUsd || 0).toFixed(2)})`
      : `$${Number(payment.amountUsd || payment.amount || 0).toFixed(2)}`;

    if (payment.coverFullMatch || (nowFullyPaid && !wasFullyPaid)) {
      await notifyStadiumStaff({
        stadiumId: booking.stadium,
        type: 'PAYMENT_RECEIVED',
        title: 'Labada kooxood waa bixiyeen',
        body: `${stadiumName}: ${amountStr} — ballanka waa la xaqiijiyay (kiraystay).`,
        bookingId: booking._id,
        eventKey: `payment_full:${booking._id}`,
        socketEvent: 'booking:confirmed',
        meta: { side, amount: payment.amount, currency: payment.currency, coverFullMatch: Boolean(payment.coverFullMatch) },
      });
      const { applyAcceptanceOnFullyPaid } = require('./ownerAccept.service');
      await applyAcceptanceOnFullyPaid(booking);
    } else if (side === 'teamA') {
      await notifyStadiumStaff({
        stadiumId: booking.stadium,
        type: 'PAYMENT_RECEIVED',
        title: 'Kooxda A waa bixisay',
        body: `${stadiumName}: ${amountStr} — Match Code ${booking.matchCode || '—'}; weli Team B.`,
        bookingId: booking._id,
        eventKey: `payment_team_a:${booking._id}`,
        socketEvent: 'booking:created',
        meta: { side, amount: payment.amount, matchCode: booking.matchCode },
      });
    } else if (side === 'teamB') {
      await notifyStadiumStaff({
        stadiumId: booking.stadium,
        type: 'PAYMENT_RECEIVED',
        title: 'Kooxda B waa bixisay',
        body: `${stadiumName}: $${amount}.`,
        bookingId: booking._id,
        eventKey: `payment_team_b:${booking._id}`,
        socketEvent: 'booking:created',
        meta: { side, amount: payment.amount },
      });
    }
  } catch (err) {
    console.warn('[payment] stadium notify failed', err.message);
  }

  emitFieldUpdate(booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
  });
  emitFieldUpdate(booking.field.toString(), 'payment:received', {
    bookingId: booking._id,
    paymentId: payment._id,
    status: payment.status,
    side,
    message: 'Payment received',
  });

  return payment;
}

async function confirmPaymentFailure({ paymentId, reason, eventId }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');

  if (eventId && payment.processedEventIds?.includes(eventId)) {
    return payment;
  }

  if (payment.status === PAYMENT_STATUS.HELD || payment.status === PAYMENT_STATUS.SUCCESS) {
    return payment;
  }

  payment.status = PAYMENT_STATUS.FAILED;
  payment.failureReason = reason || 'Payment failed';
  if (eventId) {
    payment.processedEventIds = [...(payment.processedEventIds || []), eventId];
  }
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (booking) {
    const side = payment.side || sideKey(booking, payment.team.toString());
    if (side && booking[side]?.paymentStatus === PAYMENT_STATUS.PROCESSING) {
      booking[side].paymentStatus = PAYMENT_STATUS.FAILED;
      await booking.save();
    }

    emitFieldUpdate(booking.field.toString(), 'payment:received', {
      bookingId: booking._id,
      paymentId: payment._id,
      status: payment.status,
      side,
      message: payment.failureReason,
    });
  }

  return payment;
}

/**
 * Provider webhook handler — verify via adapter, idempotent apply.
 */
async function handleProviderWebhook({ providerName, headers, body }) {
  const provider = getPaymentProvider(providerName);
  const verification = await provider.verifyWebhook(headers, body);
  if (!verification.valid) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  const event = provider.parseWebhookEvent(verification.payload || body);
  if (!event?.paymentId || !event.status) {
    throw ApiError.badRequest('Unrecognized webhook payload');
  }

  // paymentId may be our Mongo id or we look up by providerReference
  let payment = null;
  if (/^[a-f\d]{24}$/i.test(String(event.paymentId))) {
    payment = await Payment.findById(event.paymentId);
  }
  if (!payment && event.providerReference) {
    payment = await Payment.findOne({ providerReference: event.providerReference });
  }
  if (!payment && event.paymentId) {
    payment = await Payment.findOne({
      $or: [{ providerReference: event.paymentId }, { idempotencyKey: event.paymentId }],
    });
  }
  if (!payment) throw ApiError.notFound('Payment not found for webhook');

  // A webhook must describe THIS payment: same transaction id once we hold one, and for a
  // success the provider-reported amount/currency must match what we charged.
  const hasRealRef = payment.providerReference && !String(payment.providerReference).startsWith('pending-');
  if (hasRealRef && event.providerReference && payment.providerReference !== event.providerReference) {
    throw ApiError.conflict('Webhook transaction does not belong to this payment');
  }
  if (event.status === 'succeeded' && event.amount != null && !providerAmountMatches(payment, event)) {
    throw ApiError.conflict('Webhook amount does not match this payment');
  }

  if (event.status === 'succeeded') {
    await confirmPaymentSuccess({
      paymentId: payment._id,
      providerReference: event.providerReference,
      eventId: event.eventId,
    });
  } else if (event.status === 'failed') {
    await confirmPaymentFailure({
      paymentId: payment._id,
      reason: event.reason || 'Provider reported failure',
      eventId: event.eventId,
    });
  }

  return { received: true, paymentId: payment._id, status: event.status };
}

/**
 * Idempotent single-payment refund via provider adapter.
 * Safe to call repeatedly — already-REFUNDED rows are no-ops.
 */
async function refundPayment(payment) {
  if (!payment) return null;
  if (payment.status === PAYMENT_STATUS.REFUNDED) return payment;
  if (![PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS].includes(payment.status)) {
    return payment;
  }

  // Atomic claim so concurrent timeout ticks do not double-refund
  const claimed = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS] },
    },
    { $set: { status: PAYMENT_STATUS.REFUNDED, refundedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    return Payment.findById(payment._id);
  }

  try {
    const provider = getPaymentProvider(claimed.provider, { operator: claimed.operator });
    await provider.refund(claimed.providerReference, claimed.amount);
  } catch (err) {
    console.warn('[refund] provider refund stub/fail', claimed._id.toString(), err.message);
    // Keep REFUNDED in ledger for mock/stub providers; live adapters may re-queue later.
  }

  // Take the stadium's share back out of its E-Garoon wallet (Held or Available)
  try {
    await require('./egaroonWallet.service').reverseBookingEscrow(claimed);
  } catch (walletErr) {
    console.warn('[refund] wallet reversal failed', claimed._id.toString(), walletErr.message);
  }

  return claimed;
}

/**
 * Refund Team A HELD/SUCCESS payments for a booking (partial match timeout).
 * Does not auto-register users; only records refund against existing payment refs.
 */
async function refundTeamAPaymentsForBooking(bookingId) {
  assertObjectId(bookingId, 'bookingId');
  const payments = await Payment.find({
    booking: bookingId,
    side: 'teamA',
    status: { $in: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS] },
  });

  const refunded = [];
  for (const payment of payments) {
    const result = await refundPayment(payment);
    if (result?.status === PAYMENT_STATUS.REFUNDED) refunded.push(result._id);
  }

  if (refunded.length) {
    await Booking.updateOne(
      { _id: bookingId, 'teamA.paymentStatus': { $in: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS] } },
      { $set: { 'teamA.paymentStatus': PAYMENT_STATUS.REFUNDED } }
    );
  }

  return refunded;
}

async function settleBooking(bookingId) {
  assertObjectId(bookingId, 'bookingId');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw ApiError.conflict('Booking must be COMPLETED before settlement');
  }

  const payments = await Payment.find({ booking: booking._id, status: PAYMENT_STATUS.HELD });
  const totalCollected = payments.reduce(
    (sum, p) =>
      sum +
      (p.amountUsd != null
        ? p.amountUsd
        : p.currency === 'SLL' && p.exchangeRate
          ? p.amount / p.exchangeRate
          : p.amount),
    0
  );

  const bookingFinance = require('./bookingFinance.service');
  const revenueLedger = require('./revenueLedger.service');

  // Compute platform booking fee portion (Team A + Team B if full match)
  const rules = booking.financialSnapshot || {};
  let totalBookingFees = 0;
  if (booking.coveredFullMatch) {
    totalBookingFees = bookingFinance.feesForSide(rules, 'teamA', { coverFullMatch: true });
  } else {
    if (
      booking.teamA?.paymentStatus === PAYMENT_STATUS.HELD ||
      booking.teamA?.paymentStatus === PAYMENT_STATUS.SETTLED
    ) {
      totalBookingFees += bookingFinance.feesForSide(rules, 'teamA', { coverFullMatch: false });
    }
    if (
      booking.teamB?.paymentStatus === PAYMENT_STATUS.HELD ||
      booking.teamB?.paymentStatus === PAYMENT_STATUS.SETTLED
    ) {
      totalBookingFees += bookingFinance.feesForSide(rules, 'teamB', { coverFullMatch: false });
    }
  }
  totalBookingFees = Math.min(totalBookingFees, totalCollected);

  // Stadium rent is total collected minus platform booking fees
  const rentAmount = Math.max(0, Math.round((totalCollected - totalBookingFees) * 100) / 100);

  // Commission is taken ONLY from stadium rent (not from booking fees)
  const commissionPct =
    booking.commissionPercent != null
      ? Number(booking.commissionPercent)
      : rules.commissionEnabled
        ? Number(rules.commissionPercent || 0)
        : getBusiness().platformCommissionPercent;
  const commissionAmount = rules.commissionEnabled
    ? Math.round(((rentAmount * commissionPct) / 100) * 100) / 100
    : 0;
  const ownerPayoutAmount = Math.round((rentAmount - commissionAmount) * 100) / 100;

  for (const payment of payments) {
    const share = totalCollected > 0 ? payment.amount / totalCollected : 0;
    payment.commissionPercent = commissionPct;
    payment.commissionAmount = Math.round(commissionAmount * share * 100) / 100;
    payment.netToOwner = Math.round(ownerPayoutAmount * share * 100) / 100;
    payment.status = PAYMENT_STATUS.SETTLED;
    await payment.save();
  }

  booking.commissionPercent = commissionPct;
  booking.commissionAmount = commissionAmount;
  booking.ownerPayoutAmount = ownerPayoutAmount;
  booking.status = BOOKING_STATUS.SETTLED;
  booking.settledAt = new Date();
  await booking.save();

  // Post revenue ledger entries
  try {
    await revenueLedger.postSettlementBreakdown({
      booking: booking._id,
      stadiumId: booking.stadium,
      agreementId: rules.agreementId,
      rentAmount,
      commissionAmount,
      bookingFeeAmount: totalBookingFees,
    });
  } catch (ledgerErr) {
    console.warn('[settle] revenue ledger entry failed', ledgerErr.message);
  }

  // Release escrow in Stadium E-Garoon Wallet to balanceAvailable
  try {
    const egaroonWalletService = require('./egaroonWallet.service');
    await egaroonWalletService.releaseBookingEscrow(booking, { source: 'settle' });
  } catch (escrowErr) {
    console.warn('[settle] escrow release failed', escrowErr.message);
  }

  try {
    const Stadium = require('../models/Stadium');
    const stadium = await Stadium.findById(booking.stadium).select('owner name');
    if (stadium?.owner) {
      const { notifyUser } = require('./notification.service');
      await notifyUser({
        userId: stadium.owner,
        type: 'PAYOUT',
        title: 'Payout ready',
        body: `${stadium.name || 'Stadium'}: $${Number(ownerPayoutAmount || 0).toFixed(2)} settled after match.`,
        bookingId: booking._id,
        meta: { ownerPayoutAmount, commissionAmount },
      });
    }
  } catch (err) {
    console.warn('[settle] owner notify failed', err.message);
  }

  emitFieldUpdate(booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
  });

  return booking;
}

module.exports = {
  initiatePayment,
  confirmPaymentSuccess,
  confirmPaymentFailure,
  handleProviderWebhook,
  getPaymentStatus,
  settleBooking,
  refundPayment,
  refundTeamAPaymentsForBooking,
  reconcileProcessingPayments,
  isBookingFullyPaid,
  isSidePaid,
  refreshHold,
  applyTeamBPaymentWindow,
  teamShareOf,
  assertObjectId,
  OPERATORS,
};
