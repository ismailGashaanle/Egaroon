const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const paymentService = require('../services/payment.service');
const bookingService = require('../services/booking.service');
const env = require('../config/env');

// Starts a mobile-money payment for one team's share (or full match).
// Amount is always calculated server-side — never trust client totals.
const initiatePayment = asyncHandler(async (req, res) => {
  // Whitelist only — raw body must not reach Mongo queries.
  const {
    bookingId,
    teamId,
    side,
    idempotencyKey,
    coverFullMatch,
    operator,
    carrierId,
    phone,
    payerPhone,
    payerName,
    teamBContactPhone,
    teamBContactName,
    invitePhoneTeamB,
    forceInsufficient,
    currency,
    payCurrency,
  } = req.body;

  const result = await paymentService.initiatePayment({
    bookingId,
    teamId,
    side,
    payerId: req.user.id,
    idempotencyKey,
    coverFullMatch: Boolean(coverFullMatch),
    operator,
    carrierId,
    phone,
    payerPhone,
    payerName,
    teamBContactPhone,
    teamBContactName,
    invitePhoneTeamB,
    currency,
    payCurrency,
    forceInsufficient: env.nodeEnv !== 'production' ? Boolean(forceInsufficient) : false,
  });
  sendSuccess(res, 201, result);
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentStatus(
    req.params.paymentId,
    req.user.id,
    req.user.role
  );
  sendSuccess(res, 200, { payment });
});

// Legacy + mock-friendly webhook on /payments/webhook
const providerWebhook = asyncHandler(async (req, res) => {
  const providerName = req.params.provider || req.body?.provider || process.env.PAYMENT_PROVIDER || 'mock';
  const result = await paymentService.handleProviderWebhook({
    providerName,
    headers: req.headers,
    body: req.body,
  });
  sendSuccess(res, 200, result);
});

// Dev/mock-only: simulate successful provider webhook
const mockConfirm = asyncHandler(async (req, res) => {
  const payment = await paymentService.confirmPaymentSuccess({
    paymentId: req.params.paymentId,
    providerReference: `mock-ok-${Date.now()}`,
    eventId: `mock-confirm-${req.params.paymentId}-${Date.now()}`,
  });
  sendSuccess(res, 200, { payment });
});

// Dev/mock-only: simulate failed webhook (e.g. insufficient / rejected USSD)
const mockFail = asyncHandler(async (req, res) => {
  const payment = await paymentService.confirmPaymentFailure({
    paymentId: req.params.paymentId,
    reason: req.body?.reason || 'Lacagta kuma filna — mock payment failed',
    eventId: `mock-fail-${req.params.paymentId}-${Date.now()}`,
  });
  sendSuccess(res, 200, { payment });
});

const settleBooking = asyncHandler(async (req, res) => {
  const booking = await paymentService.settleBooking(req.params.bookingId);
  sendSuccess(res, 200, { booking });
});

const expireStaleHolds = asyncHandler(async (req, res) => {
  const expired = await bookingService.expireStaleHolds();
  sendSuccess(res, 200, { expiredCount: expired.length, expired });
});

const forceClearHolds = asyncHandler(async (req, res) => {
  const { fieldId, includeActive } = req.body || {};
  const result = await bookingService.forceClearHolds({
    fieldId: fieldId || undefined,
    includeActive: Boolean(includeActive),
  });
  sendSuccess(res, 200, result);
});

module.exports = {
  initiatePayment,
  getPayment,
  providerWebhook,
  mockConfirm,
  mockFail,
  settleBooking,
  expireStaleHolds,
  forceClearHolds,
};
