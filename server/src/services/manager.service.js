const Stadium = require('../models/Stadium');
const StadiumManager = require('../models/StadiumManager');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');

async function getManagedStadiumIds(userId) {
  const rows = await StadiumManager.find({ user: userId, status: 'active' }).select('stadium');
  return rows.map((r) => r.stadium);
}

async function isStadiumOwner(stadiumId, userId) {
  const stadium = await Stadium.findById(stadiumId).select('owner');
  if (!stadium) return false;
  return stadium.owner.toString() === userId;
}

async function isStadiumManager(stadiumId, userId) {
  const row = await StadiumManager.findOne({
    stadium: stadiumId,
    user: userId,
    status: 'active',
  });
  return Boolean(row);
}

/** Owner or active manager of this stadium. */
async function assertStadiumAccess(stadiumId, user, { ownerOnly = false } = {}) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');

  const isOwner = stadium.owner.toString() === user.id;
  if (isOwner) return { stadium, as: 'owner' };

  if (ownerOnly) {
    throw ApiError.forbidden('Only the stadium owner can do this');
  }

  if (user.role === ROLES.STADIUM_MANAGER || user.role === ROLES.STADIUM_OWNER) {
    const manager = await isStadiumManager(stadiumId, user.id);
    if (manager) return { stadium, as: 'manager' };
  }

  throw ApiError.forbidden('You do not manage this stadium');
}

async function inviteManager({ stadiumId, ownerId, email, name, password }) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (stadium.owner.toString() !== ownerId) {
    throw ApiError.forbidden('Only the owner can invite managers');
  }

  const normalized = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalized });
  let temporaryPassword = null;

  if (!user) {
    if (!password && !name) {
      throw ApiError.badRequest('New managers need name and password (or use an existing account email)');
    }
    temporaryPassword = password || `Mgr${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await User.hashPassword(temporaryPassword);
    user = await User.create({
      name: name || normalized.split('@')[0],
      email: normalized,
      passwordHash,
      role: ROLES.STADIUM_MANAGER,
      status: 'active',
    });
  } else if (user.role === ROLES.TEAM_CAPTAIN) {
    // Promote captain to manager only if they accept scoped stadium role
    user.role = ROLES.STADIUM_MANAGER;
    await user.save();
  } else if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    throw ApiError.badRequest('Cannot assign admin accounts as stadium managers');
  } else if (user.role === ROLES.STADIUM_OWNER && user._id.toString() === ownerId) {
    throw ApiError.badRequest('You already own this stadium');
  }

  try {
    const link = await StadiumManager.create({
      stadium: stadiumId,
      user: user._id,
      invitedBy: ownerId,
      status: 'active',
    });
    return {
      manager: link,
      user: user.toSafeJSON(),
      temporaryPassword,
    };
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('This user is already a manager here');
    throw err;
  }
}

async function listManagers(stadiumId, requester) {
  await assertStadiumAccess(stadiumId, requester, { ownerOnly: true });
  return StadiumManager.find({ stadium: stadiumId, status: 'active' })
    .populate('user', 'name email phone role status')
    .sort({ createdAt: -1 });
}

async function revokeManager({ stadiumId, managerId, ownerId }) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium || stadium.owner.toString() !== ownerId) {
    throw ApiError.forbidden('Only the owner can revoke managers');
  }
  const row = await StadiumManager.findOne({ _id: managerId, stadium: stadiumId });
  if (!row) throw ApiError.notFound('Manager assignment not found');
  row.status = 'revoked';
  await row.save();
  return row;
}

module.exports = {
  getManagedStadiumIds,
  isStadiumOwner,
  isStadiumManager,
  assertStadiumAccess,
  inviteManager,
  listManagers,
  revokeManager,
};
