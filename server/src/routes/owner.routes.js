const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/platform.controller');
const { otpSendLimiter } = require('../middleware/rateLimiters');
const verifiedOwner = require('../middleware/verifiedOwner');
const requireCaptcha = require('../middleware/captcha');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER));

router.get('/bookings', ctrl.listOwnerBookings);
router.get('/bookings/pending-accept', ctrl.listPendingAccepts);
router.post('/bookings/:bookingId/accept', ctrl.acceptOwnerBooking);
router.get('/bookings/:bookingId', ctrl.getOwnerBooking);
router.post('/walk-in', verifiedOwner, ctrl.createWalkInBooking);
router.get('/revenue', ctrl.ownerRevenue);
router.get('/reports', ctrl.ownerReports);
router.get('/reports/slots', ctrl.ownerSlotReports);
router.get('/reports/export', ctrl.exportOwnerReports);
router.post('/check-in', ctrl.managerGateCheckIn);
router.get('/recurring', ctrl.listRecurring);
router.post('/recurring', ctrl.createRecurring);
router.post('/recurring/verify-card', ctrl.verifyRecurringCard);
router.post('/recurring/:recurringId/mark-paid', ctrl.markRecurringPaid);
router.patch('/recurring/:recurringId', ctrl.updateRecurring);
router.delete('/recurring/:recurringId', ctrl.deleteRecurring);
router.get('/discounts', ctrl.listDiscounts);
router.post('/discounts', ctrl.createDiscount);
router.patch('/discounts/:discountId', ctrl.updateDiscount);
router.delete('/discounts/:discountId', ctrl.deleteDiscount);

router.get('/subscriptions', ctrl.listOwnerSubscriptions);
router.post('/subscriptions/:periodId/pay', verifiedOwner, ctrl.payOwnerSubscription);
router.post('/subscriptions/:periodId/submit-proof', verifiedOwner, ctrl.submitSubscriptionProof);
router.patch('/stadiums/:stadiumId/subscription-settings', verifiedOwner, ctrl.updateStadiumSubscriptionSettings);

const agreementCtrl = require('../controllers/stadiumAgreement.controller');
const policyCtrl = require('../controllers/bookingPolicy.controller');

router.get('/agreements', agreementCtrl.listOwnerAgreements);
router.post('/agreements/:agreementId/accept', agreementCtrl.acceptAgreement);
router.post('/agreements/:agreementId/reject', agreementCtrl.rejectAgreement);

router.get('/change-requests', policyCtrl.listOwnerChangeRequests);
router.get('/stadiums/:stadiumId/policy', policyCtrl.getStadiumPolicy);
router.patch('/stadiums/:stadiumId/policy', policyCtrl.updateStadiumPolicy);
router.post('/stadiums/:stadiumId/policy/draft', policyCtrl.saveDraftPolicy);
router.post('/stadiums/:stadiumId/policy/publish', policyCtrl.publishPolicy);

const walletCtrl = require('../controllers/egaroonWallet.controller');

// Wallet money is the owner's alone — managers share the router above but not these routes.
const ownerOnly = requireRole(ROLES.STADIUM_OWNER);
router.get('/wallet', ownerOnly, walletCtrl.getOwnerWallet);
router.get('/wallet/transactions', ownerOnly, walletCtrl.getOwnerTransactions);
router.post('/wallet/kyc', ownerOnly, walletCtrl.submitKyc);
router.post('/wallet/withdraw', ownerOnly, otpSendLimiter, requireCaptcha('withdraw'), walletCtrl.initiateWithdrawal);
router.post('/wallet/withdraw/verify-otp', ownerOnly, walletCtrl.verifyWithdrawalOtp);
router.post('/wallet/withdrawals/:id/cancel', ownerOnly, walletCtrl.cancelWithdrawal);
router.get('/wallet/withdrawals', ownerOnly, walletCtrl.listOwnerWithdrawals);

module.exports = router;
