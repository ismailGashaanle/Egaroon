const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/lineup.controller');

const router = express.Router();

// Authenticated — caller's own team boards (must be before /teams/:teamId)
router.get('/mine', requireAuth, ctrl.listMyLineups);

// Public discovery — gated only by lineupEnabled inside the service
router.get('/search', ctrl.searchLineups);
router.get('/teams/:teamId', ctrl.getTeamLineup);

module.exports = router;
