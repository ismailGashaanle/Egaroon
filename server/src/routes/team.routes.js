const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/team.controller');

const router = express.Router();

// Team profiles are publicly viewable; only the captain can manage them.
router.get('/:teamId', ctrl.getTeam);

router.use(requireAuth, requireRole(ROLES.TEAM_CAPTAIN));

router.post('/', ctrl.createTeam);
router.get('/', ctrl.listMyTeams);
router.patch('/:teamId', ctrl.updateTeam);
router.delete('/:teamId', ctrl.deleteTeam);

router.post('/:teamId/players', ctrl.addPlayer);
router.delete('/:teamId/players/:playerId', ctrl.removePlayer);

module.exports = router;
