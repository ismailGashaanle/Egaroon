const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/booking.controller');
const platformCtrl = require('../controllers/platform.controller');
const policyCtrl = require('../controllers/bookingPolicy.controller');
const { demandLimiter, matchJoinLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Cross-role change request endpoints (Captain or Stadium Owner/Manager)
router.post(
  '/change-requests/:requestId/respond',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN, ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER, ROLES.SUPER_ADMIN),
  policyCtrl.respondToChangeRequest
);
router.post(
  '/:bookingId/reschedule-request',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN, ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER, ROLES.SUPER_ADMIN),
  policyCtrl.createRescheduleRequest
);
router.get(
  '/:bookingId/change-requests',
  requireAuth,
  policyCtrl.listBookingChangeRequests
);
router.post(
  '/:bookingId/cancel-with-policy',
  requireAuth,
  policyCtrl.cancelBookingWithPolicy
);

router.use(requireAuth, requireRole(ROLES.TEAM_CAPTAIN));

router.get('/joogto-cards', platformCtrl.getCaptainJoogtoCards);
router.post('/', demandLimiter, ctrl.createBooking);
router.get('/', ctrl.listMyBookings);
/** Match Code lookup / join — before /:bookingId to avoid param capture */
router.get('/match-code/:code', matchJoinLimiter, ctrl.lookupMatchCode);
router.post('/join-by-code', matchJoinLimiter, ctrl.joinByMatchCode);
router.get('/:bookingId', ctrl.getBooking);
router.get('/:bookingId/lineups', platformCtrl.getLineups);
router.put('/:bookingId/lineup', platformCtrl.upsertLineup);
router.post('/:bookingId/invite-team-b', ctrl.inviteTeamB);
router.post('/:bookingId/lock-invite-phone', ctrl.lockInvitePhone);
router.post('/:bookingId/cancel', ctrl.cancelBooking);
router.post('/:bookingId/check-in', ctrl.checkIn);

module.exports = router;
