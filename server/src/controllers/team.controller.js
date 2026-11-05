const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Team = require('../models/Team');

async function loadOwnedTeam(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) throw ApiError.notFound('Team not found');
  if (team.captain.toString() !== userId) {
    throw ApiError.forbidden('Only the team captain can modify this team');
  }
  return team;
}

const createTeam = asyncHandler(async (req, res) => {
  const { name, city, region, logoUrl } = req.body;
  const team = await Team.create({ name, city, region, logoUrl, captain: req.user.id });
  sendSuccess(res, 201, { team });
});

const listMyTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ captain: req.user.id }).sort({ createdAt: -1 });
  sendSuccess(res, 200, { teams });
});

const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.teamId).populate('captain', 'name email');
  if (!team) throw ApiError.notFound('Team not found');
  sendSuccess(res, 200, { team });
});

const updateTeam = asyncHandler(async (req, res) => {
  const team = await loadOwnedTeam(req.params.teamId, req.user.id);
  const { name, city, region, logoUrl } = req.body;
  if (name !== undefined) team.name = name;
  if (city !== undefined) team.city = city;
  if (region !== undefined) team.region = region;
  if (logoUrl !== undefined) team.logoUrl = logoUrl;
  await team.save();
  sendSuccess(res, 200, { team });
});

const deleteTeam = asyncHandler(async (req, res) => {
  const team = await loadOwnedTeam(req.params.teamId, req.user.id);
  await team.deleteOne();
  sendSuccess(res, 200, { message: 'Team deleted' });
});

const addPlayer = asyncHandler(async (req, res) => {
  const team = await loadOwnedTeam(req.params.teamId, req.user.id);
  const { name, phone, position, jerseyNumber } = req.body;
  team.players.push({ name, phone, position, jerseyNumber });
  await team.save();
  sendSuccess(res, 201, { team });
});

const removePlayer = asyncHandler(async (req, res) => {
  const team = await loadOwnedTeam(req.params.teamId, req.user.id);
  team.players = team.players.filter((p) => p._id.toString() !== req.params.playerId);
  await team.save();
  sendSuccess(res, 200, { team });
});

module.exports = { createTeam, listMyTeams, getTeam, updateTeam, deleteTeam, addPlayer, removePlayer };
