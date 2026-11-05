const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const env = require('../config/env');
const { paymentLimiter } = require('../middleware/rateLimiters');
const { validatePaymentInitiate } = require('../validators/paymentInitiate.validator');
const ctrl = require('../controllers/payment.controller');
const platformCtrl = require('../controllers/platform.controller');

const router = express.Router();

router.get('/', requireAuth, requireRole(ROLES.TEAM_CAPTAIN), platformCtrl.listMyPayments);
router.get('/:paymentId', requireAuth, ctrl.getPayment);
router.post(
  '/',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  paymentLimiter,
  validatePaymentInitiate,
  ctrl.initiatePayment
);

// Provider webhook — no user auth (the provider calls this directly).
// Prefer /api/webhooks/payments/:provider; this path kept for mock/legacy.
router.post('/webhook', ctrl.providerWebhook);
router.post('/webhook/:provider', ctrl.providerWebhook);

// Dev-only helpers to simulate provider webhooks without live MM.
if (env.nodeEnv !== 'production') {
  router.post('/:paymentId/mock-confirm', requireAuth, paymentLimiter, ctrl.mockConfirm);
  router.post('/:paymentId/mock-fail', requireAuth, paymentLimiter, ctrl.mockFail);
}

router.post(
  '/bookings/:bookingId/settle',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  ctrl.settleBooking
);

router.post(
  '/maintenance/expire-stale-holds',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  ctrl.expireStaleHolds
);

router.post(
  '/maintenance/force-clear-holds',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  ctrl.forceClearHolds
);

module.exports = router;
