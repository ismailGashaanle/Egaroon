const express = require('express');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/platform.controller');

const router = express.Router();

router.get('/', optionalAuth, ctrl.listTournaments);
router.get('/:tournamentId', ctrl.getTournament);

router.post('/', requireAuth, requireRole(ROLES.STADIUM_OWNER), ctrl.createTournament);
router.post(
  '/:tournamentId/publish',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER),
  ctrl.publishTournament
);
router.post(
  '/:tournamentId/register',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.registerForTournament
);
router.post(
  '/:tournamentId/pay-fee',
  requireAuth,
  requireRole(ROLES.TEAM_CAPTAIN),
  ctrl.payTournamentFee
);
router.post(
  '/:tournamentId/assign-groups',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER),
  ctrl.assignGroups
);
router.patch(
  '/fixtures/:fixtureId/result',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER),
  ctrl.recordFixtureResult
);

module.exports = router;
