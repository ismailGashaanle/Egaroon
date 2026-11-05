const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Stadium = require('../models/Stadium');
const { mapLocationInput, attachLocation } = Stadium;
const { ROLES } = require('../constants/roles');
const managerService = require('../services/manager.service');
const stadiumSearchService = require('../services/stadiumSearch.service');

async function loadOwnedStadium(stadiumId, userId) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (stadium.owner.toString() !== userId) {
    throw ApiError.forbidden('Only the stadium owner can modify this stadium');
  }
  return stadium;
}

const createStadium = asyncHandler(async (req, res) => {
  const { name, description, images, location, facilities, openingTime, closingTime } = req.body;
  const stadium = await Stadium.create({
    owner: req.user.id,
    name,
    description,
    images,
    ...mapLocationInput(location),
    facilities,
    openingTime,
    closingTime,
    status: 'pending',
  });
  sendSuccess(res, 201, { stadium: attachLocation(stadium) });
});

const listStadiums = asyncHandler(async (req, res) => {
  const { stadiums, meta } = await stadiumSearchService.listStadiums(req.query, req.user || null);
  sendSuccess(res, 200, { stadiums, meta });
});

/** Pending / rejected / suspended stadiums are only visible to staff, their owner and their managers. */
async function assertStadiumVisible(stadium, user) {
  if (stadium.status === 'approved') return;
  if (user) {
    if ([ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(user.role)) return;
    if (String(stadium.owner) === String(user.id)) return;
    const managed = await managerService.getManagedStadiumIds(user.id);
    if (managed.some((id) => String(id) === String(stadium._id))) return;
  }
  throw ApiError.notFound('Stadium not found');
}

const getStadium = asyncHandler(async (req, res) => {
  const stadium = await Stadium.findById(req.params.stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  await assertStadiumVisible(stadium, req.user);
  const stadiumObj = attachLocation(stadium);
  try {
    const { checkStadiumSubscriptionStatus } = require('../services/stadiumSubscription.service');
    stadiumObj.subscriptionStatus = await checkStadiumSubscriptionStatus(stadium._id);
  } catch {
    stadiumObj.subscriptionStatus = null;
  }
  sendSuccess(res, 200, { stadium: stadiumObj });
});

const updateStadium = asyncHandler(async (req, res) => {
  const { stadium } = await managerService.assertStadiumAccess(req.params.stadiumId, req.user);
  const fields = ['name', 'description', 'images', 'facilities', 'openingTime', 'closingTime'];
  for (const field of fields) {
    if (req.body[field] !== undefined) stadium[field] = req.body[field];
  }
  if (req.body.location !== undefined) {
    Object.assign(stadium, mapLocationInput(req.body.location));
  }
  // Payout policy — owner only
  if (req.body.payoutPolicy !== undefined) {
    if (req.user.role !== ROLES.STADIUM_OWNER && String(stadium.owner) !== String(req.user.id)) {
      throw ApiError.forbidden('Only the stadium owner can change payout policy');
    }
    const policy = req.body.payoutPolicy || {};
    const mode = policy.mode === 'fixed_hours' ? 'fixed_hours' : 'after_match';
    let delayMinutes = Number(policy.delayMinutes);
    if (mode === 'after_match' && !delayMinutes) delayMinutes = 20;
    if (mode === 'fixed_hours' && !delayMinutes) delayMinutes = 1440;
    delayMinutes = Math.min(Math.max(delayMinutes || 20, 5), 60 * 24 * 7);
    stadium.payoutPolicy = { mode, delayMinutes };
  }
  // Accept mode — owner or assigned manager
  if (req.body.bookingAcceptMode !== undefined) {
    const mode = req.body.bookingAcceptMode === 'manual' ? 'manual' : 'auto';
    stadium.bookingAcceptMode = mode;
  }
  await stadium.save();
  sendSuccess(res, 200, { stadium: attachLocation(stadium) });
});

const deleteStadium = asyncHandler(async (req, res) => {
  const stadium = await loadOwnedStadium(req.params.stadiumId, req.user.id);
  await stadium.deleteOne();
  sendSuccess(res, 200, { message: 'Stadium deleted' });
});

const setStadiumStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const stadium = await Stadium.findById(req.params.stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (status === 'approved') {
    await require('../services/ownerVerification.service').assertStadiumApprovable(stadium);
  }
  stadium.status = status;
  await stadium.save();
  sendSuccess(res, 200, { stadium: attachLocation(stadium) });
});

const setStadiumOps = asyncHandler(async (req, res) => {
  const { stadium } = await managerService.assertStadiumAccess(req.params.stadiumId, req.user);

  const mode = req.body.mode; // 'online' | 'offline'
  if (mode === 'online') {
    stadium.isOnline = true;
    stadium.offlineFrom = undefined;
    stadium.offlineUntil = undefined;
    stadium.offlineReason = undefined;
  } else if (mode === 'offline') {
    stadium.isOnline = false;
    stadium.offlineFrom = req.body.offlineFrom ? new Date(req.body.offlineFrom) : new Date();
    stadium.offlineUntil = req.body.offlineUntil ? new Date(req.body.offlineUntil) : undefined;
    if (req.body.reason !== undefined || req.body.offlineReason !== undefined) {
      stadium.offlineReason = String(req.body.reason || req.body.offlineReason || '').trim();
    }
  } else if (
    req.body.isOnline !== undefined ||
    req.body.offlineUntil !== undefined ||
    req.body.offlineFrom !== undefined
  ) {
    if (req.body.isOnline !== undefined) stadium.isOnline = Boolean(req.body.isOnline);
    if (req.body.offlineFrom !== undefined) {
      stadium.offlineFrom = req.body.offlineFrom ? new Date(req.body.offlineFrom) : undefined;
    }
    if (req.body.offlineUntil !== undefined) {
      stadium.offlineUntil = req.body.offlineUntil ? new Date(req.body.offlineUntil) : undefined;
    }
    if (req.body.reason !== undefined || req.body.offlineReason !== undefined) {
      stadium.offlineReason = String(req.body.reason || req.body.offlineReason || '').trim();
    }
    if (stadium.isOnline) {
      stadium.offlineFrom = undefined;
      stadium.offlineUntil = undefined;
      stadium.offlineReason = undefined;
    }
  } else {
    throw ApiError.badRequest('Send mode: online|offline, or isOnline / offlineFrom / offlineUntil');
  }

  if (stadium.offlineFrom && stadium.offlineUntil && stadium.offlineUntil <= stadium.offlineFrom) {
    throw ApiError.badRequest('offlineUntil must be after offlineFrom');
  }

  await stadium.save();
  sendSuccess(res, 200, { stadium: attachLocation(stadium) });
});

module.exports = {
  createStadium,
  listStadiums,
  getStadium,
  assertStadiumVisible,
  updateStadium,
  deleteStadium,
  setStadiumStatus,
  setStadiumOps,
  loadOwnedStadium,
};
