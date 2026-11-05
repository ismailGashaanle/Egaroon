const Booking = require('../models/Booking');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const { getBusiness } = require('./platformSettings.service');
const { generateUniqueMatchCode } = require('../utils/matchCode');
const { notifyUser } = require('./notification.service');
const { emitFieldUpdate } = require('../sockets');
const ApiError = require('../utils/ApiError');
const {
  normalizeSomaliPhone,
  formatDisplay,
  phoneLookupVariants,
  phoneMatchesAny,
} = require('../utils/somaliPhone');
const joinGuard = require('./matchCodeJoinGuard.service');

const TEAM_A_WAITING_MSG_SO =
  'Waad bixisay lacagta teamkaaga. Waxaan sugaynaa Team B inuu lacagta ku bixiyo…';

const INVITE_PHONE_MISMATCH_MSG =
  'Match Code-kan wuxuu u xidhan yahay telefoon kale — isticmaal akoonka Team B la casuumay.';

function isSidePaid(party) {
  if (!party) return false;
  return (
    party.paymentStatus === PAYMENT_STATUS.SUCCESS ||
    party.paymentStatus === PAYMENT_STATUS.HELD ||
    party.paymentStatus === PAYMENT_STATUS.SETTLED
  );
}

function isTeamBProcessing(booking) {
  return booking?.teamB?.paymentStatus === PAYMENT_STATUS.PROCESSING;
}

async function hasProcessingPayment(bookingId) {
  const n = await Payment.countDocuments({
    booking: bookingId,
    side: 'teamB',
    status: PAYMENT_STATUS.PROCESSING,
  });
  return n > 0;
}

function windowDeadline(booking) {
  const ow = booking.opponentWindow || {};
  if (ow.phase === 'FINAL_GRACE' && ow.finalGraceEndsAt) return ow.finalGraceEndsAt;
  return booking.teamBPaymentDueAt || booking.holdExpiresAt || ow.priorityEndsAt || null;
}

function setDue(booking, due) {
  booking.teamBPaymentDueAt = due;
  booking.holdExpiresAt = due;
  if (booking.teamB) booking.teamB.paymentDeadline = due;
}

/**
 * After Team A split payment succeeds: open priority window + Match Code.
 * Snapshots teamAPayerPhone when missing (anti-scam join factor).
 */
async function startOpponentWindow(booking, fromDate = new Date(), payerPhone = null) {
  if (booking.coveredFullMatch) return booking;
  if (!isSidePaid(booking.teamA) && !booking.teamAPaidAt) return booking;

  const biz = getBusiness();
  const priorityMin = Number(biz.teamBPriorityMinutes ?? biz.teamBPaymentDeadlineMinutes) || 12;
  const priorityEndsAt = new Date(fromDate.getTime() + priorityMin * 60 * 1000);

  if (!booking.matchCode) {
    booking.matchCode = await generateUniqueMatchCode();
  }

  // Always prefer normalized payer MSISDN when provided (anti-scam join factor).
  const fromPay = normalizeSomaliPhone(payerPhone);
  if (fromPay) {
    booking.teamAPayerPhone = fromPay;
  } else if (!booking.teamAPayerPhone) {
    const captainId = booking.teamA?.captain?._id || booking.teamA?.captain;
    if (captainId) {
      const captain = await User.findById(captainId).select('phone');
      const capPhone = normalizeSomaliPhone(captain?.phone);
      if (capPhone) booking.teamAPayerPhone = capPhone;
    }
  }

  booking.opponentWindow = {
    phase: 'PRIORITY',
    priorityEndsAt,
    graceExtensionsUsed: 0,
    finalGraceEndsAt: undefined,
    competingAttemptCount: booking.opponentWindow?.competingAttemptCount || 0,
    lastDemandEvalAt: fromDate,
    lastExtensionAt: undefined,
    lastAlertLevel: booking.opponentWindow?.lastAlertLevel || 0,
  };
  setDue(booking, priorityEndsAt);
  booking.status = BOOKING_STATUS.PAYMENT_PENDING;

  return booking;
}

/**
 * Build public countdown payload for clients.
 */
function describeWindow(booking, now = new Date()) {
  const ow = booking.opponentWindow || {};
  const due = windowDeadline(booking);
  const msLeft = due ? Math.max(0, new Date(due).getTime() - now.getTime()) : 0;
  return {
    matchCode: booking.matchCode || null,
    phase: ow.phase || null,
    priorityEndsAt: ow.priorityEndsAt || null,
    graceExtensionsUsed: ow.graceExtensionsUsed || 0,
    finalGraceEndsAt: ow.finalGraceEndsAt || null,
    competingAttemptCount: ow.competingAttemptCount || 0,
    teamBPaymentDueAt: booking.teamBPaymentDueAt || null,
    holdExpiresAt: booking.holdExpiresAt || null,
    secondsRemaining: Math.ceil(msLeft / 1000),
    messageSo: booking.matchCode && !booking.coveredFullMatch && booking.status === BOOKING_STATUS.PAYMENT_PENDING
      ? TEAM_A_WAITING_MSG_SO
      : null,
    teamACredit: booking.teamACredit || null,
  };
}

async function creditTeamAWallet(booking, amount, reason) {
  const captainId = booking.teamA?.captain;
  if (!captainId || !(amount > 0)) return null;

  await User.findByIdAndUpdate(captainId, {
    $inc: { walletCreditUsd: amount },
    $push: {
      walletLedger: {
        amount,
        reason,
        booking: booking._id,
        createdAt: new Date(),
      },
    },
  });

  booking.teamACredit = {
    status: 'CREDITED',
    amount,
    reason,
    settledAt: new Date(),
  };

  await notifyUser({
    userId: captainId,
    type: 'TEAM_A_CREDIT',
    title: 'Lacagtaada waa credit',
    body: `$${Number(amount).toFixed(2)} ayaa lagu daray wallet-kaaga (boos kale). Sabab: ${reason}.`,
    bookingId: booking._id,
    dedupeKey: `team_a_credit:${booking._id}`,
    meta: { amount, reason },
  });

  return booking.teamACredit;
}

async function settleTeamAFunds(booking, { forceCredit = false, reason = 'opponent_window_timeout' } = {}) {
  const biz = getBusiness();
  const { refundTeamAPaymentsForBooking } = require('./payment.service');

  const payments = await Payment.find({
    booking: booking._id,
    side: 'teamA',
    status: { $in: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS] },
  });
  const amount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const useCredit =
    forceCredit ||
    (biz.preferWalletCreditOnDemandRelease && reason === 'demand_forced_release');

  if (useCredit && amount > 0) {
    // Mark payments as REFUNDED in ledger sense without double-paying provider if we credit
    // Prefer wallet: still mark payment REFUNDED locally after credit (funds not settled to owner).
    booking.teamACredit = {
      status: 'PENDING',
      amount,
      reason,
    };
    await creditTeamAWallet(booking, amount, reason);
    for (const payment of payments) {
      if ([PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS].includes(payment.status)) {
        payment.status = PAYMENT_STATUS.REFUNDED;
        payment.refundedAt = new Date();
        payment.failureReason = `credited_to_wallet:${reason}`;
        // eslint-disable-next-line no-await-in-loop
        await payment.save();
      }
    }
    if (booking.teamA) booking.teamA.paymentStatus = PAYMENT_STATUS.REFUNDED;
    return { mode: 'credit', amount };
  }

  if (biz.autoRefundTeamAOnTeamBTimeout !== false && amount > 0) {
    await refundTeamAPaymentsForBooking(booking._id);
    booking.teamACredit = {
      status: 'REFUNDED',
      amount,
      reason,
      settledAt: new Date(),
    };
    return { mode: 'refund', amount };
  }

  booking.teamACredit = {
    status: 'PENDING',
    amount,
    reason: `${reason}_owed`,
  };
  return { mode: 'pending', amount };
}

/**
 * Release slot: EXPIRED + settle Team A funds.
 * Competing Team C must create a NEW booking (new Team A / new Match Code).
 */
async function releaseOpponentWindow(booking, { reason = 'opponent_window_timeout', forceCredit = false } = {}) {
  if (isTeamBProcessing(booking) || (await hasProcessingPayment(booking._id))) {
    // Protect PROCESSING — nudge deadline a bit
    const bump = new Date(Date.now() + 2 * 60 * 1000);
    setDue(booking, bump);
    if (booking.opponentWindow) {
      booking.opponentWindow.phase = booking.opponentWindow.phase || 'FINAL_GRACE';
      booking.opponentWindow.finalGraceEndsAt = bump;
    }
    await booking.save();
    return { released: false, protected: true, booking };
  }

  const now = new Date();
  const claimed = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: { $in: [BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING] },
    },
    {
      $set: {
        status: BOOKING_STATUS.EXPIRED,
        partialPaymentTimeoutAt: now,
        cancelReason: reason,
        'opponentWindow.phase': 'CLOSED',
      },
      $unset: {
        holdExpiresAt: 1,
        teamBPaymentDueAt: 1,
      },
    },
    { returnDocument: 'after' }
  );
  if (!claimed) return { released: false, booking: null };

  const settlement = await settleTeamAFunds(claimed, { forceCredit, reason });
  if (claimed.teamACredit) {
    await Booking.updateOne({ _id: claimed._id }, { $set: { teamACredit: claimed.teamACredit } });
  }

  try {
    const aCaptain = claimed.teamA?.captain;
    if (aCaptain) {
      await notifyUser({
        userId: aCaptain,
        type: 'BOOKING_EXPIRED',
        title: forceCredit ? 'Booska waa la qaatay — credit' : 'Team B ma bixin — slot furmay',
        body: forceCredit
          ? 'Kabtan kale ayaa doonayay booska. Lacagtaada waa credit wallet. Samee ballan cusub (Match Code cusub).'
          : 'Waqtigii Team B wuu dhacay. Boosku wuu furmay; lacagtaada waa la soo celiyay ama credit.',
        bookingId: claimed._id,
        dedupeKey: `opp_release_a:${claimed._id}`,
        meta: { reason, settlement },
      });
    }
    const bCaptain = claimed.teamB?.captain;
    if (bCaptain) {
      await notifyUser({
        userId: bCaptain,
        type: 'BOOKING_EXPIRED',
        title: 'Waqtigii lacag-bixinta wuu dhacay',
        body: forceCredit
          ? 'Mahadsanid — booska waa la qaatay. Samee ballan cusub haddii aad rabto.'
          : 'Invitation-kii wuu dhacay; boosku wuu furmay.',
        bookingId: claimed._id,
        dedupeKey: `opp_release_b:${claimed._id}`,
      });
    }
  } catch (err) {
    console.warn('[opponentWindow] notify on release failed', err.message);
  }

  emitFieldUpdate(claimed.field.toString(), 'booking:updated', {
    bookingId: claimed._id,
    status: claimed.status,
  });

  return { released: true, booking: claimed, settlement };
}

async function extendGrace(booking, now = new Date()) {
  const biz = getBusiness();
  const maxExt = Number(biz.teamBMaxGraceExtensions) || 2;
  const graceMin = Number(biz.teamBGraceMinutes) || 10;
  const used = Number(booking.opponentWindow?.graceExtensionsUsed) || 0;

  if (used >= maxExt) {
    return releaseOpponentWindow(booking, { reason: 'opponent_window_timeout' });
  }

  const due = new Date(now.getTime() + graceMin * 60 * 1000);
  booking.opponentWindow = booking.opponentWindow || {};
  booking.opponentWindow.phase = 'GRACE';
  booking.opponentWindow.graceExtensionsUsed = used + 1;
  booking.opponentWindow.lastExtensionAt = now;
  booking.opponentWindow.lastDemandEvalAt = now;
  setDue(booking, due);
  await booking.save();

  const notifyTargets = [booking.teamB?.captain, booking.teamA?.captain].filter(Boolean);
  for (const userId of notifyTargets) {
    // eslint-disable-next-line no-await-in-loop
    await notifyUser({
      userId,
      type: 'OPPONENT_WINDOW_EXTENDED',
      title: 'Waqtiga Team B waa la kordhiyay',
      body: `+${graceMin} daqiiqo (extension ${used + 1}/${maxExt}). Ma jiro demand dhab ah. Match Code: ${booking.matchCode || '—'}`,
      bookingId: booking._id,
      dedupeKey: `opp_ext:${booking._id}:${used + 1}`,
      meta: { graceMinutes: graceMin, extension: used + 1 },
    });
  }

  emitFieldUpdate(booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
    opponentWindow: describeWindow(booking),
  });

  return { extended: true, booking, graceMinutes: graceMin };
}

async function startFinalGrace(booking, now = new Date()) {
  const biz = getBusiness();
  const finalMin = Number(biz.teamBFinalGraceMinutes) || 3;
  const due = new Date(now.getTime() + finalMin * 60 * 1000);

  booking.opponentWindow = booking.opponentWindow || {};
  booking.opponentWindow.phase = 'FINAL_GRACE';
  booking.opponentWindow.finalGraceEndsAt = due;
  booking.opponentWindow.lastDemandEvalAt = now;
  setDue(booking, due);
  await booking.save();

  const targets = [booking.teamB?.captain, booking.teamA?.captain].filter(Boolean);
  for (const userId of targets) {
    // eslint-disable-next-line no-await-in-loop
    await notifyUser({
      userId,
      type: 'OPPONENT_FINAL_GRACE',
      title: 'Daqiiqado ugu dambeeya!',
      body: `Kabtan kale ayaa doonaya booska. ${finalMin} daqiiqo ayaad haysataa inaad lacagta bixiso. Code: ${booking.matchCode || '—'}`,
      bookingId: booking._id,
      dedupeKey: `opp_final:${booking._id}`,
      meta: { finalGraceMinutes: finalMin },
    });
  }

  emitFieldUpdate(booking.field.toString(), 'booking:updated', {
    bookingId: booking._id,
    status: booking.status,
    opponentWindow: describeWindow(booking),
  });

  return { finalGrace: true, booking, minutes: finalMin };
}

/**
 * Escalating alerts on competing Book attempts (count on booking).
 * 2 → alert, 3 → urgent, 4 → push, 5 → force release + Team A credit.
 */
async function onCompetingDemand({ bookingId, demandUserId, isNewDemand }) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.coveredFullMatch) return { ok: false };

  if (!booking.opponentWindow?.phase) {
    await startOpponentWindow(booking);
    await booking.save();
  }

  // Only bump count for new distinct demand records (idempotent clicks don't re-escalate)
  if (isNewDemand) {
    booking.opponentWindow.competingAttemptCount =
      (Number(booking.opponentWindow.competingAttemptCount) || 0) + 1;
  }
  const count = Number(booking.opponentWindow.competingAttemptCount) || 0;
  booking.opponentWindow.lastDemandEvalAt = new Date();

  // If already past priority and demand appears → enter final grace
  const due = windowDeadline(booking);
  const pastPriority =
    booking.opponentWindow.phase === 'PRIORITY' &&
    booking.opponentWindow.priorityEndsAt &&
    new Date() >= new Date(booking.opponentWindow.priorityEndsAt);
  const inGrace = booking.opponentWindow.phase === 'GRACE';

  if (
    (pastPriority || inGrace || booking.opponentWindow.phase === 'PRIORITY') &&
    count >= 1 &&
    booking.opponentWindow.phase !== 'FINAL_GRACE' &&
    booking.opponentWindow.phase !== 'CLOSED'
  ) {
    // Demand during open window: if past priority OR grace, start final grace immediately
    if (pastPriority || inGrace || (due && new Date() >= new Date(due))) {
      await booking.save();
      return startFinalGrace(booking);
    }
  }

  const alertLevel = count;
  const prev = Number(booking.opponentWindow.lastAlertLevel) || 0;

  if (count >= 5) {
    await booking.save();
    const released = await releaseOpponentWindow(booking, {
      reason: 'demand_forced_release',
      forceCredit: true,
    });
    return {
      ...released,
      toast: {
        code: 'SLOT_TAKEN_DEMAND',
        messageEn: 'This slot was taken after competing demand. Thank you — please book another time.',
        messageSo:
          'Mahadsanid — booska waa la qaatay (demand badan). Team A lacagtiisu waa credit. Samee ballan cusub.',
      },
      alertLevel: 5,
    };
  }

  if (count >= 2 && alertLevel > prev) {
    booking.opponentWindow.lastAlertLevel = count;
    await booking.save();

    const bCaptain = booking.teamB?.captain;
    const aCaptain = booking.teamA?.captain;
    const urgency =
      count >= 4 ? 'DEGDEG' : count >= 3 ? 'Urgente' : 'Digniin';
    const body =
      count >= 4
        ? `Digniin ${count}: kabtanada kale ayaa Book garaacaya. Bixi hadda ama waad lumin kartaa. Code: ${booking.matchCode}`
        : count >= 3
          ? `Urgente: ${count} kabtan ayaa doonaya booska. Bixi lacagta Team B. Code: ${booking.matchCode}`
          : `Kabtan kale ayaa isku dayay inuu booska qabsado. Bixi lacagta. Code: ${booking.matchCode}`;

    for (const userId of [bCaptain, aCaptain].filter(Boolean)) {
      // eslint-disable-next-line no-await-in-loop
      await notifyUser({
        userId,
        type: 'OPPONENT_DEMAND_ALERT',
        title: `${urgency}: demand booska`,
        body,
        bookingId: booking._id,
        dedupeKey: `opp_alert:${booking._id}:${count}`,
        meta: { competingAttemptCount: count, demandUserId },
      });
    }

    return {
      alerted: true,
      alertLevel: count,
      toast: {
        code: 'DEMAND_ALERT',
        messageEn: `Competing captains interested in this slot (${count}). Pay soon.`,
        messageSo: body,
      },
      booking,
    };
  }

  await booking.save();
  return { alerted: false, alertLevel: count, booking };
}

/**
 * Called by cron / on-access when deadline passed for Team A–paid waiting bookings.
 * Does NOT hard-expire at priority end — evaluates genuine demand first.
 */
async function evaluateOpponentWindow(bookingDoc, now = new Date()) {
  let booking = bookingDoc;
  if (!booking) return null;
  if (booking.coveredFullMatch) return null;
  if (![BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.status)) return null;
  if (!isSidePaid(booking.teamA) && !booking.teamAPaidAt) return null;
  if (booking.teamB && isSidePaid(booking.teamB)) return null;

  // Ensure window exists for legacy bookings that only have teamBPaymentDueAt
  if (!booking.opponentWindow?.phase && (booking.matchCode || booking.teamAPaidAt)) {
    if (!booking.matchCode) {
      booking.matchCode = await generateUniqueMatchCode();
    }
    booking.opponentWindow = {
      phase: 'PRIORITY',
      priorityEndsAt: booking.teamBPaymentDueAt || booking.holdExpiresAt || now,
      graceExtensionsUsed: 0,
      competingAttemptCount: 0,
      lastAlertLevel: 0,
    };
    await booking.save();
  }

  if (!booking.opponentWindow?.phase || booking.opponentWindow.phase === 'CLOSED') {
    return null;
  }

  if (isTeamBProcessing(booking) || (await hasProcessingPayment(booking._id))) {
    return { protected: true, booking };
  }

  const due = windowDeadline(booking);
  if (!due || new Date(due) > now) {
    return { waiting: true, booking, window: describeWindow(booking, now) };
  }

  const { countActiveDemands } = require('./slotDemand.service');
  const demandCount = await countActiveDemands({
    fieldId: booking.field,
    startTime: booking.startTime,
    excludeUserId: booking.teamA?.captain,
  });

  booking.opponentWindow.lastDemandEvalAt = now;

  if (booking.opponentWindow.phase === 'FINAL_GRACE') {
    return releaseOpponentWindow(booking, { reason: 'final_grace_timeout' });
  }

  if (demandCount > 0) {
    return startFinalGrace(booking, now);
  }

  // No genuine demand → extend grace (up to max)
  return extendGrace(booking, now);
}

/**
 * Process all stale opponent windows (cron).
 * Returns list of released booking ids.
 */
async function processStaleOpponentWindows() {
  const now = new Date();
  const candidates = await Booking.find({
    status: { $in: [BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING] },
    coveredFullMatch: { $ne: true },
    $or: [
      { teamBPaymentDueAt: { $lte: now } },
      { holdExpiresAt: { $lte: now } },
      { 'opponentWindow.finalGraceEndsAt': { $lte: now } },
      { 'opponentWindow.priorityEndsAt': { $lte: now } },
    ],
  }).limit(80);

  const released = [];
  for (const b of candidates) {
    const teamAPaid = isSidePaid(b.teamA) || Boolean(b.teamAPaidAt);
    if (!teamAPaid) continue;
    if (b.teamB && isSidePaid(b.teamB)) continue;

    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateOpponentWindow(b, now);
    if (result?.released) released.push(result.booking._id);
  }
  return released;
}

/**
 * Join / preview Match Code — requires teamAPhone (anti-scam).
 * Optional invitePhone lock: joiner account phone must match.
 */
async function resolveTeamAExpectedPhones(booking) {
  const phones = new Set();
  const add = (raw) => {
    if (raw == null || raw === '') return;
    const trimmed = String(raw).trim();
    phones.add(trimmed);
    for (const v of phoneLookupVariants(trimmed)) {
      phones.add(v);
    }
  };

  add(booking.teamAPayerPhone);

  const captainId = booking.teamA?.captain?._id || booking.teamA?.captain;
  let captainPhone = booking.teamA?.captain?.phone;
  if (!captainPhone && captainId) {
    const captain = await User.findById(captainId).select('phone');
    captainPhone = captain?.phone;
  }
  add(captainPhone);

  try {
    const pay = await Payment.findOne({
      booking: booking._id,
      side: 'teamA',
      status: { $in: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.SETTLED] },
    })
      .sort({ paidAt: -1 })
      .select('payerPhone msisdn');
    add(pay?.payerPhone || pay?.msisdn);
  } catch {
    /* ignore */
  }

  return phones;
}

function phonesMatch(entered, expectedSet, opts = {}) {
  if (!entered || !expectedSet || expectedSet.size === 0) return false;
  // Variant intersection - never raw string equality alone
  return phoneMatchesAny(entered, expectedSet, opts);
}

/**
 * Raw DB lookup by Match Code only (internal). Prefer verifyAndLoadMatchCode for API.
 */
async function lookupByMatchCode(rawCode) {
  const { normalizeMatchCode } = require('../utils/matchCode');
  const code = normalizeMatchCode(rawCode);
  if (!code) throw ApiError.badRequest('Match Code format must be SG-XXXX-XXXX');

  const booking = await Booking.findOne({ matchCode: code })
    .populate('field', 'name type capacity')
    .populate('stadium', 'name city area')
    .populate('teamA.team', 'name')
    .populate('teamA.captain', 'name phone');

  if (!booking) throw ApiError.notFound('Match Code lama helin');
  return booking;
}

/**
 * Verified lookup: Match Code + Team A payer/captain phone.
 * Distinct error codes (rate-limited) so UI can show clear Somali copy.
 */
async function verifyAndLoadMatchCode({
  matchCode,
  teamAPhone,
  teamACarrier,
  carrierId,
  joinerUserId,
  joinerPhone,
  ip,
  requireInvitePhoneMatch = true,
}) {
  const { normalizeMatchCode } = require('../utils/matchCode');
  const code = normalizeMatchCode(matchCode);
  const phoneOpts = (teamACarrier || carrierId) ? { carrierId: teamACarrier || carrierId } : {};
  const enteredPhone = normalizeSomaliPhone(teamAPhone, phoneOpts);

  if (!code) throw ApiError.badRequest('Match Code format must be SG-XXXX-XXXX');
  if (!enteredPhone) {
    throw ApiError.badRequest('Telefoonka Team A waa loo baahan yahay (Somali MSISDN)');
  }

  const ctx = { ip, userId: joinerUserId };
  await joinGuard.assertNotLockedOut(ctx);

  const booking = await Booking.findOne({ matchCode: code })
    .populate('field', 'name type capacity')
    .populate('stadium', 'name city area')
    .populate('teamA.team', 'name')
    .populate('teamA.captain', 'name phone');

  if (!booking) {
    await joinGuard.recordFailedAttempt(ctx);
    throw joinGuard.matchCodeNotFoundError();
  }

  const expected = await resolveTeamAExpectedPhones(booking);
  if (!phonesMatch(teamAPhone, expected, phoneOpts) && !phonesMatch(enteredPhone, expected, phoneOpts)) {
    await joinGuard.recordFailedAttempt(ctx);
    throw joinGuard.teamAPhoneMismatchError();
  }

  // Optional: Team A locked expected Team B phone
  const lockedInvite = normalizeSomaliPhone(booking.invitePhone);
  if (requireInvitePhoneMatch && lockedInvite) {
    const joinerNorm =
      normalizeSomaliPhone(joinerPhone) ||
      (joinerUserId
        ? normalizeSomaliPhone((await User.findById(joinerUserId).select('phone'))?.phone)
        : null);
    if (!joinerNorm || joinerNorm !== lockedInvite) {
      await joinGuard.recordFailedAttempt(ctx);
      throw ApiError.forbidden(INVITE_PHONE_MISMATCH_MSG, { code: 'MATCH_INVITE_PHONE_LOCKED' });
    }
  }

  await joinGuard.clearFailedAttempts(ctx);
  return booking;
}

/** Match payment progress for Team B join UX (Team A share ≈ 50%, both ≈ 100%). */
function buildPaymentProgress(booking) {
  const total = Number(booking.pricing?.totalPrice || 0);
  const teamShare =
    Number(booking.pricing?.teamShare) ||
    Math.round((total / 2) * 100) / 100;
  const teamAPaid = isSidePaid(booking.teamA) || Boolean(booking.teamAPaidAt);
  const teamBPaid = booking.coveredFullMatch
    ? true
    : isSidePaid(booking.teamB) || Boolean(booking.teamBPaidAt);

  let paidAmount = 0;
  if (teamAPaid) {
    paidAmount += Number(booking.teamA?.amountDue ?? teamShare);
  }
  if (booking.coveredFullMatch) {
    paidAmount = total;
  } else if (teamBPaid) {
    paidAmount += Number(booking.teamB?.amountDue ?? teamShare);
  }

  const percent =
    total > 0
      ? Math.min(100, Math.round((paidAmount / total) * 100))
      : teamAPaid && teamBPaid
        ? 100
        : teamAPaid
          ? 50
          : 0;

  return {
    percent,
    paidAmount: Math.round(paidAmount * 100) / 100,
    remainingAmount: Math.max(0, Math.round((total - paidAmount) * 100) / 100),
    totalPrice: total,
    teamAPaid,
    teamBPaid: Boolean(teamBPaid),
    currency: booking.pricing?.currency || 'USD',
  };
}

/** Sanitized preview — no QR / bookingCode / Team A phone / captain phone. */
function buildMatchCodePreview(booking) {
  const teamBShare =
    booking.teamB?.amountDue ??
    booking.pricing?.teamShare ??
    Math.round((Number(booking.pricing?.totalPrice || 0) / 2) * 100) / 100;

  const paymentProgress = buildPaymentProgress(booking);

  return {
    booking: {
      id: booking._id,
      status: booking.status,
      matchCode: booking.matchCode,
      startTime: booking.startTime,
      endTime: booking.endTime,
      field: booking.field,
      stadium: booking.stadium,
      teamA: {
        team: booking.teamA?.team,
        captain: booking.teamA?.captain
          ? { name: booking.teamA.captain.name || booking.teamA.captain?.name }
          : null,
        paymentStatus: booking.teamA?.paymentStatus,
        amountDue: booking.teamA?.amountDue,
      },
      teamBJoined: Boolean(booking.teamB),
      teamBAmountDue: booking.teamB ? booking.teamB.amountDue : teamBShare,
      pricing: {
        totalPrice: booking.pricing?.totalPrice,
        teamShare: booking.pricing?.teamShare,
        currency: booking.pricing?.currency || 'USD',
      },
      coveredFullMatch: booking.coveredFullMatch,
      invitePhoneLocked: Boolean(normalizeSomaliPhone(booking.invitePhone)),
      paymentProgress,
    },
    paymentProgress,
    window: describeWindow(booking),
    messageSo: TEAM_A_WAITING_MSG_SO,
  };
}

async function joinByMatchCode({
  matchCode,
  teamAPhone,
  teamACarrier,
  carrierId,
  captainId,
  teamId,
  playersCount,
  joinerPhone,
  ip,
}) {
  const booking = await verifyAndLoadMatchCode({
    matchCode,
    teamAPhone,
    teamACarrier: teamACarrier || carrierId,
    joinerUserId: captainId,
    joinerPhone,
    ip,
    requireInvitePhoneMatch: true,
  });

  if (booking.coveredFullMatch) {
    throw ApiError.conflict('Team A already covered the full match — no Team B payment needed');
  }
  if (![BOOKING_STATUS.PAYMENT_PENDING, BOOKING_STATUS.HELD].includes(booking.status)) {
    throw ApiError.conflict(`Booking is ${booking.status} — cannot join`);
  }
  if (!isSidePaid(booking.teamA) && !booking.teamAPaidAt) {
    throw ApiError.badRequest('Team A has not paid yet');
  }
  if (String(booking.teamA.captain._id || booking.teamA.captain) === String(captainId)) {
    throw ApiError.badRequest('You cannot join your own booking as Team B');
  }

  // Re-evaluate window on access
  await evaluateOpponentWindow(booking);
  const fresh = await Booking.findById(booking._id);
  if (!fresh || fresh.status === BOOKING_STATUS.EXPIRED) {
    throw ApiError.conflict('Opponent payment window expired — slot released. Create a new booking.', {
      code: 'OPPONENT_WINDOW_EXPIRED',
      messageSo: 'Waqtigii wuu dhacay — samee ballan cusub (Team A cusub + Match Code cusub).',
    });
  }

  if (fresh.teamB) {
    if (String(fresh.teamB.captain) === String(captainId)) {
      return { booking: fresh, alreadyJoined: true, window: describeWindow(fresh) };
    }
    throw ApiError.conflict('Team B already joined this match');
  }

  const { resolveTeamForCaptain } = require('./booking.service');
  const Field = require('../models/Field');
  const { playersPerSide, calculatePriceForSlot, splitBetweenTeams } = require('./pricing.service');

  const team = await resolveTeamForCaptain({ captainId, teamId });
  const field = await Field.findById(fresh.field);
  const perSide = playersPerSide(field);
  const freshPrice = await calculatePriceForSlot({ field, startTime: fresh.startTime });
  const { teamBShare, teamAShare } = splitBetweenTeams(
    freshPrice.totalPrice,
    true,
    freshPrice.teamShare
  );

  const bookingFinance = require('./bookingFinance.service');
  const bDues = bookingFinance.applyDues(fresh.financialSnapshot, {
    teamAShare,
    teamBShare,
  });

  fresh.pricing.totalPrice = freshPrice.totalPrice;
  fresh.pricing.teamShare = freshPrice.teamShare;
  fresh.pricing.payableFullMatch = bDues.payableFullMatch;
  fresh.pricing.payableTeamShare = bDues.payableTeamShare;
  fresh.teamA.amountDue = bDues.teamADue;
  fresh.teamA.playersCount = perSide;
  fresh.teamB = {
    team: team._id,
    captain: captainId,
    playersCount: playersCount || perSide,
    amountDue: bDues.teamBDue,
    paymentStatus: PAYMENT_STATUS.PENDING,
    invitedAt: new Date(),
    paymentDeadline: fresh.teamBPaymentDueAt || fresh.holdExpiresAt,
  };
  fresh.status = BOOKING_STATUS.PAYMENT_PENDING;
  await fresh.save();

  await notifyUser({
    userId: captainId,
    type: 'TEAM_B_INVITE',
    title: 'Waad ku biirtay Match Code',
    body: `Bixi $${Number(bDues.teamBDue).toFixed(2)}. Code: ${fresh.matchCode}. ${TEAM_A_WAITING_MSG_SO}`,
    bookingId: fresh._id,
    meta: { amountDue: bDues.teamBDue, matchCode: fresh.matchCode },
  });
  await notifyUser({
    userId: fresh.teamA.captain,
    type: 'TEAM_B_INVITE',
    title: 'Team B waa ku biiray',
    body: `Kabtan Team B wuxuu ku biiray code ${fresh.matchCode}. Wuxuu bixinayaa qaybtiisa.`,
    bookingId: fresh._id,
    dedupeKey: `team_b_joined:${fresh._id}`,
  });

  emitFieldUpdate(fresh.field.toString(), 'booking:updated', {
    bookingId: fresh._id,
    status: fresh.status,
  });

  return {
    booking: fresh,
    alreadyJoined: false,
    amountDue: teamBShare,
    teamAPaid: true,
    messageSo: TEAM_A_WAITING_MSG_SO,
    window: describeWindow(fresh),
  };
}

/**
 * Team A locks expected Team B phone (optional second factor).
 */
async function lockInvitePhone({ bookingId, requesterId, invitePhone }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.teamA.captain) !== String(requesterId)) {
    throw ApiError.forbidden('Only Team A captain can lock invite phone');
  }
  if (!booking.matchCode) {
    throw ApiError.badRequest('Match Code ma jiro — bixi qaybta Team A marka hore');
  }
  if (booking.teamB) {
    throw ApiError.conflict('Team B already joined — cannot change invite phone');
  }
  const normalized = normalizeSomaliPhone(invitePhone);
  if (!normalized) {
    throw ApiError.badRequest('Telefoonka Team B waa khalad (Somali MSISDN)');
  }
  if (normalizeSomaliPhone(booking.teamAPayerPhone) === normalized) {
    throw ApiError.badRequest('Invite phone cannot be Team A payer phone');
  }
  booking.invitePhone = normalized;
  await booking.save();
  return {
    booking,
    invitePhone: normalized,
    invitePhoneDisplay: formatDisplay(normalized),
  };
}

module.exports = {
  TEAM_A_WAITING_MSG_SO,
  startOpponentWindow,
  describeWindow,
  evaluateOpponentWindow,
  processStaleOpponentWindows,
  onCompetingDemand,
  releaseOpponentWindow,
  joinByMatchCode,
  lookupByMatchCode,
  verifyAndLoadMatchCode,
  buildMatchCodePreview,
  buildPaymentProgress,
  lockInvitePhone,
  windowDeadline,
  isSidePaid,
  resolveTeamAExpectedPhones,
};
