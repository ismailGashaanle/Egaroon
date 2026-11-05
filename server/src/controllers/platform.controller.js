const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const slotService = require('../services/slot.service');
const lineupService = require('../services/lineup.service');
const tournamentService = require('../services/tournament.service');
const Booking = require('../models/Booking');
const Stadium = require('../models/Stadium');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const { LIVE_STATUSES } = require('../services/slot.service');
const managerService = require('../services/manager.service');
const bookingService = require('../services/booking.service');
const ownerAcceptService = require('../services/ownerAccept.service');
const ownerReportsService = require('../services/ownerReports.service');
const discountService = require('../services/discount.service');
const recurringService = require('../services/recurring.service');
const { ROLES, canViewLostSlots } = require('../constants/roles');
const { ownerCanSeeCommission } = require('../services/platformSettings.service');

async function accessibleStadiumIds(user) {
  if (user.role === ROLES.STADIUM_MANAGER) {
    return managerService.getManagedStadiumIds(user.id);
  }
  const owned = await Stadium.find({ owner: user.id }).select('_id');
  const managed = await managerService.getManagedStadiumIds(user.id);
  return [...owned.map((s) => s._id), ...managed];
}

const getFieldSlots = asyncHandler(async (req, res) => {
  const date = req.query.date;
  if (!date) throw ApiError.badRequest('Query param date=YYYY-MM-DD is required');
  // Slot availability changes on hold/pay — avoid stale 304 green cells on mobile.
  res.set('Cache-Control', 'no-store');
  const data = await slotService.getFieldSlots({
    fieldId: req.params.fieldId,
    date,
    includeLostSlots: canViewLostSlots(req.user?.role),
  });
  sendSuccess(res, 200, data);
});

const getLineups = asyncHandler(async (req, res) => {
  const data = await lineupService.getLineupsForBooking(req.params.bookingId, req.user.id);
  sendSuccess(res, 200, data);
});

const upsertLineup = asyncHandler(async (req, res) => {
  const lineup = await lineupService.upsertLineup({
    bookingId: req.params.bookingId,
    captainId: req.user.id,
    formation: req.body.formation,
    players: req.body.players,
    published: req.body.published,
  });
  sendSuccess(res, 200, { lineup });
});

const listTournaments = asyncHandler(async (req, res) => {
  const tournaments = await tournamentService.listTournaments({
    stadiumId: req.query.stadiumId,
    status: req.query.status,
    mineOwnerId: req.query.mine === 'true' ? req.user?.id : undefined,
  });
  sendSuccess(res, 200, { tournaments });
});

const createTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.createTournament(req.user.id, {
    ...req.body,
    stadiumId: req.body.stadiumId,
    fieldIds: req.body.fieldIds,
  });
  sendSuccess(res, 201, { tournament });
});

const getTournament = asyncHandler(async (req, res) => {
  const data = await tournamentService.getTournament(req.params.tournamentId);
  sendSuccess(res, 200, data);
});

const publishTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.publishTournament(req.params.tournamentId, req.user.id);
  sendSuccess(res, 200, { tournament });
});

const registerForTournament = asyncHandler(async (req, res) => {
  const entry = await tournamentService.registerTeam({
    tournamentId: req.params.tournamentId,
    teamId: req.body.teamId,
    captainId: req.user.id,
  });
  sendSuccess(res, 201, { entry });
});

const payTournamentFee = asyncHandler(async (req, res) => {
  const entry = await tournamentService.confirmRegistrationPayment({
    tournamentId: req.params.tournamentId,
    teamId: req.body.teamId,
    captainId: req.user.id,
  });
  sendSuccess(res, 200, { entry });
});

const assignGroups = asyncHandler(async (req, res) => {
  const data = await tournamentService.assignGroups({
    tournamentId: req.params.tournamentId,
    ownerId: req.user.id,
    groupSize: req.body.groupSize || 4,
  });
  sendSuccess(res, 200, data);
});

const recordFixtureResult = asyncHandler(async (req, res) => {
  const fixture = await tournamentService.recordResult({
    fixtureId: req.params.fixtureId,
    ownerId: req.user.id,
    homeScore: req.body.homeScore,
    awayScore: req.body.awayScore,
    notes: req.body.notes,
  });
  sendSuccess(res, 200, { fixture });
});

const listOwnerBookings = asyncHandler(async (req, res) => {
  const result = await bookingService.listOwnerBookings(req.user, req.query);
  sendSuccess(res, 200, result);
});

const ownerRevenue = asyncHandler(async (req, res) => {
  // Payout figures are owner-only; managers see bookings count but zero payout
  const owned = await Stadium.find({ owner: req.user.id }).select('_id name');
  const stadiumIds = owned.map((s) => s._id);
  const settled = await Booking.find({
    stadium: { $in: stadiumIds },
    status: 'SETTLED',
  }).select('ownerPayoutAmount commissionAmount pricing startTime stadium');

  const totalPayout = settled.reduce((s, b) => s + (b.ownerPayoutAmount || 0), 0);
  const totalCommission = settled.reduce((s, b) => s + (b.commissionAmount || 0), 0);
  const allIds = await accessibleStadiumIds(req.user);
  const upcoming = await Booking.countDocuments({
    stadium: { $in: allIds },
    status: { $in: LIVE_STATUSES },
    startTime: { $gte: new Date() },
  });

  const canSeePayout = req.user.role !== ROLES.STADIUM_MANAGER;
  let subscriptionStatus = null;
  try {
    const { checkStadiumSubscriptionStatus } = require('../services/stadiumSubscription.service');
    if (stadiumIds.length) {
      for (const sid of stadiumIds) {
        const st = await checkStadiumSubscriptionStatus(sid);
        if (st.isLocked) {
          subscriptionStatus = st;
          break;
        }
        if (st.isGracePeriod && (!subscriptionStatus || !subscriptionStatus.isLocked)) {
          subscriptionStatus = st;
        }
      }
    }
  } catch {
    subscriptionStatus = null;
  }

  sendSuccess(res, 200, {
    revenue: {
      settledCount: settled.length,
      totalPayout: canSeePayout ? totalPayout : null,
      totalCommission: ownerCanSeeCommission(req.user) ? totalCommission : null,
      upcomingBookings: upcoming,
      stadiums: allIds.length,
      subscriptionStatus,
    },
  });
});

const ownerReports = asyncHandler(async (req, res) => {
  const reports = await ownerReportsService.buildOwnerReports(req.user, req.query);
  sendSuccess(res, 200, { reports });
});

const ownerSlotReports = asyncHandler(async (req, res) => {
  const report = await ownerReportsService.buildSlotReports(req.user, req.query);
  sendSuccess(res, 200, { report });
});

const exportOwnerReports = asyncHandler(async (req, res) => {
  const { buffer, contentType, ext } = await ownerReportsService.buildExportBuffer(req.user, req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="egaroon-report-${stamp}.${ext}"`);
  res.send(buffer);
});

const listPendingAccepts = asyncHandler(async (req, res) => {
  const bookings = await ownerAcceptService.listPendingAccepts(req.user, {
    stadiumId: req.query.stadiumId,
  });
  sendSuccess(res, 200, { bookings, count: bookings.length });
});

const acceptOwnerBooking = asyncHandler(async (req, res) => {
  const result = await ownerAcceptService.acceptBooking({
    bookingId: req.params.bookingId,
    user: req.user,
  });
  sendSuccess(res, 200, result);
});

const createRecurring = asyncHandler(async (req, res) => {
  const rec = await recurringService.createRecurring(req.user, req.body);
  sendSuccess(res, 201, { recurring: rec });
});

const listRecurring = asyncHandler(async (req, res) => {
  const items = await recurringService.listRecurring(req.user, {
    fieldId: req.query.fieldId,
    stadiumId: req.query.stadiumId,
  });
  sendSuccess(res, 200, { recurring: items });
});

const updateRecurring = asyncHandler(async (req, res) => {
  const rec = await recurringService.updateRecurring(req.params.recurringId, req.user, req.body);
  sendSuccess(res, 200, { recurring: rec });
});

const deleteRecurring = asyncHandler(async (req, res) => {
  const result = await recurringService.deleteRecurring(req.params.recurringId, req.user);
  sendSuccess(res, 200, result);
});

const markRecurringPaid = asyncHandler(async (req, res) => {
  const result = await recurringService.markPaid(req.params.recurringId, req.user, req.body);
  sendSuccess(res, 200, result);
});

const verifyRecurringCard = asyncHandler(async (req, res) => {
  const result = await recurringService.verifyCard(req.user, req.body);
  sendSuccess(res, 200, result);
});

const getCaptainJoogtoCards = asyncHandler(async (req, res) => {
  const cards = await recurringService.getCaptainJoogto(req.user.id);
  sendSuccess(res, 200, { cards });
});

const createDiscount = asyncHandler(async (req, res) => {
  const discount = await discountService.createDiscount(req.user, req.body);
  sendSuccess(res, 201, { discount });
});

const listDiscounts = asyncHandler(async (req, res) => {
  const discounts = await discountService.listDiscountsForUser(req.user, {
    stadiumId: req.query.stadiumId,
  });
  sendSuccess(res, 200, { discounts });
});

const updateDiscount = asyncHandler(async (req, res) => {
  const discount = await discountService.updateDiscount(req.params.discountId, req.user, req.body);
  sendSuccess(res, 200, { discount });
});

const deleteDiscount = asyncHandler(async (req, res) => {
  const result = await discountService.deleteDiscount(req.params.discountId, req.user);
  sendSuccess(res, 200, result);
});

const listMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ payer: req.user.id })
    .populate({
      path: 'booking',
      select: 'startTime endTime status stadium field pricing',
      populate: [
        { path: 'stadium', select: 'name' },
        { path: 'field', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(100);
  sendSuccess(res, 200, { payments });
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId).populate('booking');
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.payer.toString() !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
    throw ApiError.forbidden('Not your payment');
  }
  sendSuccess(res, 200, { payment });
});

const listAdminBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const bookings = await Booking.find(filter)
    .populate('stadium', 'name')
    .populate('field', 'name')
    .sort({ startTime: -1 })
    .limit(100);
  sendSuccess(res, 200, { bookings });
});

const managerGateCheckIn = asyncHandler(async (req, res) => {
  const result = await bookingService.managerGateCheckIn({
    actor: req.user,
    bookingCode: req.body.bookingCode,
    qrPayload: req.body.qrPayload,
    stadiumId: req.body.stadiumId,
    force: Boolean(req.body.force),
    validateOnly: Boolean(req.body.validateOnly),
  });
  sendSuccess(res, 200, result);
});

const createWalkInBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.createWalkInBooking({
    actor: req.user,
    stadiumId: req.body.stadiumId,
    fieldId: req.body.fieldId,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    captainName: req.body.captainName,
    captainPhone: req.body.captainPhone,
    teamName: req.body.teamName,
    payMode: req.body.payMode || 'full',
    paymentMethod: req.body.paymentMethod || req.body.operator || 'cash',
    payerPhone: req.body.payerPhone,
    payNow: req.body.payNow !== false,
  });
  sendSuccess(res, 201, result);
});

const getOwnerBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.getOwnerBooking(req.user, req.params.bookingId);
  sendSuccess(res, 200, result);
});

const listOwnerSubscriptions = asyncHandler(async (req, res) => {
  const stadiumSubscriptionService = require('../services/stadiumSubscription.service');
  const owned = await Stadium.find({ owner: req.user.id }).select('_id');
  const stadiumIds = owned.map((s) => s._id);
  const subscriptions = await stadiumSubscriptionService.listSubscriptions({
    stadiumId: { $in: stadiumIds },
  });
  sendSuccess(res, 200, { subscriptions });
});

const payOwnerSubscription = asyncHandler(async (req, res) => {
  const stadiumSubscriptionService = require('../services/stadiumSubscription.service');
  const StadiumSubscriptionPeriod = require('../models/StadiumSubscriptionPeriod');
  const { periodId } = req.params;
  const { operator, phone, payCurrency, method } = req.body;

  if (method === 'auto_deduct') {
    const period = await StadiumSubscriptionPeriod.findById(periodId);
    if (!period) throw ApiError.notFound('Subscription period not found');
    const stadium = await Stadium.findById(period.stadium);
    if (!stadium || String(stadium.owner) !== String(req.user.id)) {
      throw ApiError.forbidden('Only the stadium owner can pay this subscription');
    }
    const success = await stadiumSubscriptionService.tryAutoDeductSubscription(stadium, period);
    if (!success) {
      throw ApiError.badRequest('Lacagta dakhliga garoonka kuma filna inay bixiso subscription-ka');
    }
    return sendSuccess(res, 200, {
      success: true,
      period,
      messageSo: `Si toos ah ayaa dakhliga garoonka looga jaray subscription-ka ($${period.amountDue} USD).`,
    });
  }

  const result = await stadiumSubscriptionService.paySubscriptionViaMobileMoney({
    periodId,
    operator,
    phone,
    payCurrency,
    actorId: req.user.id,
  });
  sendSuccess(res, 200, result);
});

const submitSubscriptionProof = asyncHandler(async (req, res) => {
  const stadiumSubscriptionService = require('../services/stadiumSubscription.service');
  const { periodId } = req.params;
  const { paymentReference, notes } = req.body;
  const result = await stadiumSubscriptionService.submitSubscriptionProof({
    periodId,
    paymentReference,
    notes,
    actorId: req.user.id,
  });
  sendSuccess(res, 200, result);
});

const updateStadiumSubscriptionSettings = asyncHandler(async (req, res) => {
  const { stadiumId } = req.params;
  const stadium = await Stadium.findOne({ _id: stadiumId, owner: req.user.id });
  if (!stadium) throw ApiError.notFound('Stadium not found or access denied');

  if (req.body.subscriptionAutoDeduct !== undefined) {
    stadium.subscriptionAutoDeduct = Boolean(req.body.subscriptionAutoDeduct);
  }
  await stadium.save();
  sendSuccess(res, 200, {
    stadium: {
      _id: stadium._id,
      name: stadium.name,
      subscriptionAutoDeduct: stadium.subscriptionAutoDeduct,
    },
  });
});

module.exports = {
  getFieldSlots,
  getLineups,
  upsertLineup,
  listTournaments,
  createTournament,
  getTournament,
  publishTournament,
  registerForTournament,
  payTournamentFee,
  assignGroups,
  recordFixtureResult,
  listOwnerBookings,
  ownerRevenue,
  ownerReports,
  ownerSlotReports,
  exportOwnerReports,
  listPendingAccepts,
  acceptOwnerBooking,
  createRecurring,
  listRecurring,
  updateRecurring,
  deleteRecurring,
  markRecurringPaid,
  verifyRecurringCard,
  getCaptainJoogtoCards,
  createDiscount,
  listDiscounts,
  updateDiscount,
  deleteDiscount,
  listMyPayments,
  getPayment,
  listAdminBookings,
  managerGateCheckIn,
  createWalkInBooking,
  getOwnerBooking,
  listOwnerSubscriptions,
  payOwnerSubscription,
  submitSubscriptionProof,
  updateStadiumSubscriptionSettings,
};

