const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const availabilityService = require('../services/availability.service');

const createBlock = asyncHandler(async (req, res) => {
  const block = await availabilityService.createBlock(req.user, req.body);
  sendSuccess(res, 201, { block });
});

const createStadiumLock = asyncHandler(async (req, res) => {
  const block = await availabilityService.createStadiumLock(req.user, {
    stadiumId: req.params.stadiumId,
    type: req.body.type || 'owner_block',
    startsAt: req.body.startsAt,
    endsAt: req.body.endsAt,
    reason: req.body.reason,
    tournamentId: req.body.tournamentId,
  });
  sendSuccess(res, 201, { block });
});

const listBlocksForField = asyncHandler(async (req, res) => {
  const blocks = await availabilityService.listBlocksForField(req.params.fieldId, {
    upcoming: req.query.upcoming,
    from: req.query.from,
    to: req.query.to,
  });
  sendSuccess(res, 200, { blocks });
});

const listBlocksForStadium = asyncHandler(async (req, res) => {
  const upcoming =
    req.query.upcoming === undefined ? true : req.query.upcoming === '1' || req.query.upcoming === 'true';
  const blocks = await availabilityService.listBlocksForStadium(req.params.stadiumId, req.user, {
    fieldId: req.query.fieldId,
    upcoming,
    from: req.query.from,
    to: req.query.to,
  });
  sendSuccess(res, 200, { blocks });
});

const updateBlock = asyncHandler(async (req, res) => {
  const block = await availabilityService.updateBlock(req.params.blockId, req.user, req.body);
  sendSuccess(res, 200, { block });
});

const deleteBlock = asyncHandler(async (req, res) => {
  const result = await availabilityService.deleteBlock(req.params.blockId, req.user);
  sendSuccess(res, 200, result);
});

module.exports = {
  createBlock,
  createStadiumLock,
  listBlocksForField,
  listBlocksForStadium,
  updateBlock,
  deleteBlock,
};
