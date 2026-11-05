const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const managerService = require('../services/manager.service');

const listManagers = asyncHandler(async (req, res) => {
  const managers = await managerService.listManagers(req.params.stadiumId, req.user);
  sendSuccess(res, 200, { managers });
});

const inviteManager = asyncHandler(async (req, res) => {
  const result = await managerService.inviteManager({
    stadiumId: req.params.stadiumId,
    ownerId: req.user.id,
    email: req.body.email,
    name: req.body.name,
    password: req.body.password,
  });
  sendSuccess(res, 201, result);
});

const revokeManager = asyncHandler(async (req, res) => {
  const manager = await managerService.revokeManager({
    stadiumId: req.params.stadiumId,
    managerId: req.params.managerId,
    ownerId: req.user.id,
  });
  sendSuccess(res, 200, { manager });
});

module.exports = { listManagers, inviteManager, revokeManager };
