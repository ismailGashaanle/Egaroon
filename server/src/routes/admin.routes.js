const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

const platformCtrl = require('../controllers/platform.controller');

router.get('/users', ctrl.listUsers);
router.post('/users', requireRole(ROLES.SUPER_ADMIN), ctrl.createUser);
router.patch('/users/:userId/status', ctrl.setUserStatus);
router.patch('/users/:userId', ctrl.updateUser);
router.delete('/users/:userId', ctrl.softDeleteUser);
router.post('/users/:userId/restore', requireRole(ROLES.SUPER_ADMIN), ctrl.restoreUser);
router.get('/bookings', platformCtrl.listAdminBookings);
router.get('/payments', ctrl.listPayments);
router.patch('/payments/:paymentId/review', ctrl.reviewPayment);

// Only Super Admin may change roles (enforced again inside the controller/model rules).
router.patch('/users/:userId/role', requireRole(ROLES.SUPER_ADMIN), ctrl.setUserRole);

router.get('/settings', requireRole(ROLES.SUPER_ADMIN), ctrl.getPlatformSettings);
router.patch('/settings', requireRole(ROLES.SUPER_ADMIN), ctrl.updatePlatformSettings);

router.get('/reports/profit', requireRole(ROLES.SUPER_ADMIN), ctrl.getProfitReport);
router.get('/reports/profit/insights', requireRole(ROLES.SUPER_ADMIN), ctrl.getProfitInsights);
router.get('/reports/profit/export', requireRole(ROLES.SUPER_ADMIN), ctrl.exportProfitReport);
router.get('/reports/planner', requireRole(ROLES.SUPER_ADMIN), ctrl.getBusinessPlan);
router.post('/reports/planner', requireRole(ROLES.SUPER_ADMIN), ctrl.runBusinessPlan);
router.post('/reports/commission/backfill', requireRole(ROLES.SUPER_ADMIN), ctrl.backfillCommission);

router.get('/subscriptions', requireRole(ROLES.SUPER_ADMIN), ctrl.listSubscriptions);
router.patch('/subscriptions/:periodId', requireRole(ROLES.SUPER_ADMIN), ctrl.markSubscription);
router.post('/subscriptions/:periodId/approve', requireRole(ROLES.SUPER_ADMIN), ctrl.approveSubscription);

router.post('/maintenance/expire-stale-holds', ctrl.expireStaleHolds);
router.post('/maintenance/force-clear-holds', ctrl.forceClearHolds);

const siteContentCtrl = require('../controllers/siteContent.controller');
router.get('/site-content', requireRole(ROLES.SUPER_ADMIN), siteContentCtrl.getAdminSiteContent);
router.patch('/site-content', requireRole(ROLES.SUPER_ADMIN), siteContentCtrl.updateAdminSiteContent);

const ownerOnboardingCtrl = require('../controllers/ownerOnboarding.controller');
router.get(
  '/owner-onboardings/suggest-email',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.suggestEmail
);
router.get(
  '/owner-onboardings/agreement-pdf',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.agreementPdfTemplate
);
router.get('/owner-onboardings', requireRole(ROLES.SUPER_ADMIN), ownerOnboardingCtrl.list);
router.post('/owner-onboardings', requireRole(ROLES.SUPER_ADMIN), ownerOnboardingCtrl.create);
router.get(
  '/owner-onboardings/:onboardingId/agreement-pdf',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.agreementPdfFilled
);
router.get(
  '/owner-onboardings/:onboardingId',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.getOne
);
router.patch(
  '/owner-onboardings/:onboardingId',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.update
);
router.post(
  '/owner-onboardings/:onboardingId/submit-agreement',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.submitSignatures
);
router.post(
  '/owner-onboardings/:onboardingId/signatures',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.sign
);
router.post(
  '/owner-onboardings/:onboardingId/activate',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.activate
);
router.post(
  '/owner-onboardings/:onboardingId/cancel',
  requireRole(ROLES.SUPER_ADMIN),
  ownerOnboardingCtrl.cancel
);

const agreementCtrl = require('../controllers/stadiumAgreement.controller');
router.get('/agreements', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.listAgreements);
router.post('/agreements', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.createAgreement);
router.post('/agreements/stadium/:stadiumId/default', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.createDefaultForStadium);
router.get('/agreements/:agreementId', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.getAgreement);
router.post('/agreements/:agreementId/send', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.sendAgreement);
router.post('/agreements/:agreementId/suspend', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.suspendAgreement);
router.post('/agreements/:agreementId/version', requireRole(ROLES.SUPER_ADMIN), agreementCtrl.createVersion);

// Department of Finance — E-Garoon Master Accounts, Escrow, KYC & Payouts
const walletCtrl = require('../controllers/egaroonWallet.controller');
router.get('/finance/overview', requireRole(ROLES.SUPER_ADMIN), walletCtrl.getFinanceOverview);
router.get('/finance/withdrawals', requireRole(ROLES.SUPER_ADMIN), walletCtrl.listFinanceWithdrawals);
router.post('/finance/withdrawals/:id/approve', requireRole(ROLES.SUPER_ADMIN), walletCtrl.approveWithdrawal);
router.post('/finance/withdrawals/:id/reject', requireRole(ROLES.SUPER_ADMIN), walletCtrl.rejectWithdrawal);
router.post('/finance/bookings/:bookingId/release-escrow', requireRole(ROLES.SUPER_ADMIN), walletCtrl.releaseEscrow);
router.get('/finance/kyc', requireRole(ROLES.SUPER_ADMIN), walletCtrl.listFinanceKyc);
router.post('/finance/kyc/:userId/review', requireRole(ROLES.SUPER_ADMIN), walletCtrl.reviewKyc);
router.get('/finance/master-accounts', requireRole(ROLES.SUPER_ADMIN), walletCtrl.getMasterAccounts);
router.put('/finance/master-accounts', requireRole(ROLES.SUPER_ADMIN), walletCtrl.updateMasterAccounts);

module.exports = router;
