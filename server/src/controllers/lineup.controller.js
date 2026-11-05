const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const lineupService = require('../services/lineup.service');

/** GET /api/lineups/search?q=teamName — public published boards */
const searchLineups = asyncHandler(async (req, res) => {
  const data = await lineupService.searchPublishedLineups(req.query.q, {
    limit: req.query.limit,
  });
  sendSuccess(res, 200, data);
});

/** GET /api/lineups/teams/:teamId — latest published lineup for team */
const getTeamLineup = asyncHandler(async (req, res) => {
  const data = await lineupService.getPublishedLineupForTeam(req.params.teamId);
  sendSuccess(res, 200, data);
});

/** GET /api/lineups/mine — latest boards for the caller's teams (auth) */
const listMyLineups = asyncHandler(async (req, res) => {
  const data = await lineupService.listMyLineups(req.user.id, {
    limit: req.query.limit,
  });
  sendSuccess(res, 200, data);
});

module.exports = {
  searchLineups,
  getTeamLineup,
  listMyLineups,
};
