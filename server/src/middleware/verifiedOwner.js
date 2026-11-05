const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');
const { assertOwnerVerified } = require('../services/ownerVerification.service');

/** Blocks payments / subscriptions for self-registered owners until verified. */
module.exports = asyncHandler(async (req, _res, next) => {
  if (req.user?.role === ROLES.STADIUM_OWNER) await assertOwnerVerified(req.user.id);
  next();
});
