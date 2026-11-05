const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Booking = require('../models/Booking');
const Team = require('../models/Team');
const bookingService = require('../services/booking.service');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { buildQrPayload, qrWindowStatus } = require('../utils/bookingPass');

const createBooking = asyncHandler(async (req, res) => {
  const { fieldId, stadiumId, teamId, teamName, playersCount, startTime, endTime } = req.body;

  const booking = await bookingService.createHold({
    fieldId,
    stadiumId,
    captainId: req.user.id,
    teamId: teamId || undefined,
    teamName,
    playersCount,
    startTime,
    endTime,
  });

  sendSuccess(res, 201, { booking });
});

const inviteTeamB = asyncHandler(async (req, res) => {
  const { teamBId, playersCount, phone } = req.body;

  if (phone) {
    const result = await bookingService.inviteTeamBByPhone({
      bookingId: req.params.bookingId,
      requesterId: req.user.id,
      phone,
      playersCount,
    });
    return sendSuccess(res, 200, result);
  }

  if (!teamBId) throw ApiError.badRequest('Provide phone (preferred) or teamBId');

  const teamB = await Team.findById(teamBId);
  if (!teamB) throw ApiError.notFound('Team not found');

  const booking = await bookingService.inviteTeamB({
    bookingId: req.params.bookingId,
    requesterId: req.user.id,
    teamBId: teamB._id,
    teamBCaptainId: teamB.captain.toString(),
    playersCount,
  });

  sendSuccess(res, 200, { booking });
});

const getBooking = asyncHandler(async (req, res) => {
  let booking = await Booking.findById(req.params.bookingId)
    .populate('field')
    .populate('stadium')
    .populate('teamA.team')
    .populate('teamB.team')
    .populate('teamA.captain', 'name phone')
    .populate('teamB.captain', 'name phone');
  if (!booking) throw ApiError.notFound('Booking not found');

  // Hydrate live finance rules and platform booking fee dues if missing on live hold
  if (
    [BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.status) &&
    (!booking.pricing?.payableTeamShare || !booking.pricing?.platformFee || !booking.financialSnapshot)
  ) {
    try {
      const bookingFinance = require('../services/bookingFinance.service');
      const stadiumId = booking.stadium?._id || booking.stadium;
      const rentTotal = Number(booking.pricing?.totalPrice || 0);
      const teamShare = Number(booking.pricing?.teamShare || rentTotal / 2);
      const finance = await bookingFinance.buildForStadium(stadiumId, {
        rentTotal,
        teamShare,
      });
      booking.financialSnapshot = finance.snapshot;
      booking.pricing.stadiumRentTotal = rentTotal;
      booking.pricing.payableTeamShare = finance.dues.payableTeamShare;
      booking.pricing.payableFullMatch = finance.dues.payableFullMatch;
      booking.pricing.platformFee = finance.dues.platformFeeTeamA;
      booking.pricing.platformFeeFullMatch = finance.dues.platformFeeFullMatch;
      if (booking.teamA && booking.teamA.paymentStatus === 'PENDING') {
        booking.teamA.amountDue = finance.dues.teamADue;
      }
      if (booking.teamB && booking.teamB.paymentStatus === 'PENDING') {
        booking.teamB.amountDue = finance.dues.teamBDue;
      }
      await booking.save();
    } catch (hydrateErr) {
      console.warn('[getBooking] hydrate finance error:', hydrateErr.message);
    }
  }

  // On-access: demand-based window tick for Team A–paid waiting bookings
  try {
    const opponentWindow = require('../services/opponentWindow.service');
    await opponentWindow.evaluateOpponentWindow(booking);
    booking = await Booking.findById(req.params.bookingId)
      .populate('field')
      .populate('stadium')
      .populate('teamA.team')
      .populate('teamB.team')
      .populate('teamA.captain', 'name phone')
      .populate('teamB.captain', 'name phone');
  } catch (err) {
    console.warn('[getBooking] opponent window eval', err.message);
  }

  const payload = booking.toObject();
  // Anti-scam: gate QR / entry code until CONFIRMED (both sides paid or full cover)
  const qrReady = [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CHECKED_IN,
    BOOKING_STATUS.IN_PROGRESS,
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.SETTLED,
  ].includes(booking.status);
  if (qrReady && booking.bookingCode) {
    payload.qrPayload = buildQrPayload(booking);
    const window = booking.startTime ? qrWindowStatus(booking) : null;
    payload.qrValidFrom = window?.validFrom;
    payload.qrValidUntil = window?.validUntil;
    payload.qrValidNow = Boolean(window?.ok);
    try {
      payload.matchPass = await bookingService.buildMatchPassCard(booking);
    } catch (err) {
      console.warn('[getBooking] matchPass', err.message);
      payload.matchPass = null;
    }
  } else {
    payload.bookingCode = undefined;
    payload.qrPayload = null;
    payload.qrValidFrom = null;
    payload.qrValidUntil = null;
    payload.qrValidNow = false;
    payload.matchPass = null;
  }
  // Team A captain may see payer phone for WhatsApp share instructions
  const isTeamA = String(booking.teamA?.captain?._id || booking.teamA?.captain) === String(req.user.id);
  if (isTeamA && booking.teamAPayerPhone) {
    payload.teamAPayerPhone = booking.teamAPayerPhone;
    try {
      const { formatDisplay, formatSharePhone, toE164, toLocal0 } = require('../utils/somaliPhone');
      const share = formatSharePhone(booking.teamAPayerPhone);
      payload.teamAPayerPhoneDisplay = share?.display || formatDisplay(booking.teamAPayerPhone);
      payload.teamAPayerPhoneE164 = share?.e164 || toE164(booking.teamAPayerPhone);
      payload.teamAPayerPhoneLocal = share?.local0 || toLocal0(booking.teamAPayerPhone);
    } catch {
      payload.teamAPayerPhoneDisplay = booking.teamAPayerPhone;
    }
  } else {
    payload.teamAPayerPhone = undefined;
  }
  if (booking.invitePhone) {
    payload.invitePhoneLocked = true;
    if (isTeamA) {
      payload.invitePhone = booking.invitePhone;
      try {
        const { formatDisplay } = require('../utils/somaliPhone');
        payload.invitePhoneDisplay = formatDisplay(booking.invitePhone);
      } catch {
        payload.invitePhoneDisplay = booking.invitePhone;
      }
    } else {
      payload.invitePhone = undefined;
    }
  }
  try {
    const opponentWindow = require('../services/opponentWindow.service');
    payload.opponentWindowPublic = opponentWindow.describeWindow(booking);
    payload.messageSo = payload.opponentWindowPublic?.messageSo || null;
  } catch {
    /* optional */
  }

  sendSuccess(res, 200, { booking: payload });
});

const lookupMatchCode = asyncHandler(async (req, res) => {
  const opponentWindow = require('../services/opponentWindow.service');
  const teamAPhone = req.query.teamAPhone || req.query.phone || req.body?.teamAPhone;
  const teamACarrier =
    req.query.teamACarrier || req.query.carrierId || req.body?.teamACarrier || req.body?.carrierId;
  const booking = await opponentWindow.verifyAndLoadMatchCode({
    matchCode: req.params.code || req.query.code,
    teamAPhone,
    teamACarrier,
    joinerUserId: req.user.id,
    joinerPhone: req.user.phone,
    ip: req.ip,
    requireInvitePhoneMatch: true,
  });
  await opponentWindow.evaluateOpponentWindow(booking);
  const fresh = await Booking.findById(booking._id)
    .populate('field', 'name type capacity')
    .populate('stadium', 'name city area')
    .populate('teamA.team', 'name')
    .populate('teamA.captain', 'name');

  sendSuccess(res, 200, opponentWindow.buildMatchCodePreview(fresh || booking));
});

const joinByMatchCode = asyncHandler(async (req, res) => {
  const opponentWindow = require('../services/opponentWindow.service');
  const { matchCode, code, teamId, playersCount, teamAPhone, phone, teamACarrier, carrierId } =
    req.body;
  const result = await opponentWindow.joinByMatchCode({
    matchCode: matchCode || code,
    teamAPhone: teamAPhone || phone,
    teamACarrier: teamACarrier || carrierId,
    captainId: req.user.id,
    teamId,
    playersCount,
    joinerPhone: req.user.phone,
    ip: req.ip,
  });
  sendSuccess(res, 200, result);
});

const lockInvitePhone = asyncHandler(async (req, res) => {
  const opponentWindow = require('../services/opponentWindow.service');
  const result = await opponentWindow.lockInvitePhone({
    bookingId: req.params.bookingId,
    requesterId: req.user.id,
    invitePhone: req.body.invitePhone || req.body.phone,
  });
  sendSuccess(res, 200, result);
});

const listMyBookings = asyncHandler(async (req, res) => {
  const teams = await Team.find({ captain: req.user.id }).select('_id');
  const teamIds = teams.map((t) => t._id);

  const bookings = await Booking.find({
    $or: [{ 'teamA.team': { $in: teamIds } }, { 'teamB.team': { $in: teamIds } }],
  })
    .populate('field')
    .populate('stadium')
    .sort({ startTime: -1 });

  sendSuccess(res, 200, { bookings });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');

  const isTeamACaptain = booking.teamA.captain.toString() === req.user.id;
  const isTeamBCaptain = booking.teamB && booking.teamB.captain.toString() === req.user.id;
  if (!isTeamACaptain && !isTeamBCaptain) {
    throw ApiError.forbidden('Only a participating team captain can cancel this booking');
  }

  bookingService.assertTransition(booking, BOOKING_STATUS.CANCELLED);
  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledBy = req.user.id;
  booking.cancelReason = req.body.reason;
  await booking.save();

  sendSuccess(res, 200, { booking });
});

const checkIn = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');

  const isTeamACaptain = booking.teamA.captain.toString() === req.user.id;
  const isTeamBCaptain = booking.teamB && booking.teamB.captain.toString() === req.user.id;
  if (!isTeamACaptain && !isTeamBCaptain) {
    throw ApiError.forbidden('Only a participating team captain can check in');
  }
  if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.CHECKED_IN) {
    throw ApiError.conflict('Booking must be CONFIRMED to check in');
  }

  const side = isTeamACaptain ? 'teamA' : 'teamB';
  booking[side].checkedInAt = new Date();
  if (booking.status === BOOKING_STATUS.CONFIRMED) {
    booking.status = BOOKING_STATUS.CHECKED_IN;
  }
  await booking.save();

  sendSuccess(res, 200, { booking });
});

module.exports = {
  createBooking,
  inviteTeamB,
  getBooking,
  listMyBookings,
  cancelBooking,
  checkIn,
  lookupMatchCode,
  joinByMatchCode,
  lockInvitePhone,
};
