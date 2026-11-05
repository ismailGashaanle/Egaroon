const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/freeMatchGift.controller');

const router = express.Router();

const enterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many gift entries, try again later' } },
});

// Captain surfaces
router.get(
  '/active',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.listActiveForMe
);
router.get(
  '/vouchers/mine',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.listMyVouchers
);
router.post(
  '/vouchers/preview',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.previewVoucher
);
router.post(
  '/campaigns/:campaignId/enter',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  enterLimiter,
  ctrl.enterCampaign
);
router.post(
  '/bookings/:bookingId/redeem',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.redeemVoucher
);

// Super Admin campaign management
router.get(
  '/campaigns',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  ctrl.listCampaigns
);
router.post(
  '/campaigns',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  ctrl.createCampaign
);
router.post(
  '/campaigns/:campaignId/end',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  ctrl.endCampaign
);
router.post(
  '/campaigns/:campaignId/activate',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  ctrl.activateCampaign
);

module.exports = router;
