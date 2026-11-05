const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, ALL_ROLES } = require('../constants/roles');
const { normalizeSomaliPhone } = require('../utils/somaliPhone');

const SAFE_EDIT_FIELDS = ['name', 'phone', 'city', 'region', 'area'];

/** Roles Super Admin may provision via POST /admin/users (not self-serve). */
const PROVISIONABLE_ROLES = [ROLES.ADMIN, ROLES.STADIUM_OWNER];

function generateTempPassword(role) {
  const part = crypto.randomBytes(5).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const prefix = role === ROLES.ADMIN ? 'Adm' : 'Own';
  return `${prefix}${part}!${String(Date.now()).slice(-3)}`;
}

function sanitizeName(name) {
  return String(name || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 80);
}

function sanitizeEmail(email) {
  return String(email || '')
    .toLowerCase()
    .trim()
    .slice(0, 120);
}

function assertCanManageTarget(actor, target) {
  if (!target || target.deletedAt) throw ApiError.notFound('User not found');
  // BR-014: Admin never touches Super Admin (edit / suspend / delete).
  if (target.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Admin cannot edit, suspend, or delete a Super Admin account');
  }
  // Admins cannot manage other admin accounts — only Super Admin (admin-of-admins).
  if (
    target.role === ROLES.ADMIN &&
    actor.role === ROLES.ADMIN &&
    String(actor.id) !== String(target._id)
  ) {
    throw ApiError.forbidden('Admins cannot modify other admin accounts');
  }
}

/**
 * Super Admin only: create admin or stadium_owner with a one-time temporary password.
 * Returns { user, temporaryPassword } — password is never stored/logged.
 */
async function createUser(actor, body = {}) {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin may register admin or stadium owner accounts');
  }

  const role = body.role;
  if (!PROVISIONABLE_ROLES.includes(role)) {
    throw ApiError.badRequest('role must be admin or stadium_owner');
  }

  const name = sanitizeName(body.name);
  const email = sanitizeEmail(body.email);
  if (name.length < 2) throw ApiError.badRequest('Name is required (min 2 characters)');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('Valid email is required');
  }

  let phone;
  if (body.phone != null && String(body.phone).trim() !== '') {
    phone = normalizeSomaliPhone(body.phone);
    if (!phone) throw ApiError.badRequest('Invalid Somali phone number');
  }

  const existingEmail = await User.findOne({ email }).select('_id').lean();
  if (existingEmail) throw ApiError.conflict('Email already registered', { code: 'EMAIL_EXISTS' });
  if (phone) {
    const existingPhone = await User.findOne({ phone }).select('_id').lean();
    if (existingPhone) throw ApiError.conflict('Phone already registered', { code: 'PHONE_EXISTS' });
  }

  const temporaryPassword =
    typeof body.password === 'string' && body.password.length >= 8
      ? body.password
      : generateTempPassword(role);
  if (temporaryPassword.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  const passwordHash = await User.hashPassword(temporaryPassword);
  const user = await User.create({
    name,
    email,
    phone: phone || undefined,
    passwordHash,
    role,
    status: 'active',
    mustChangePassword: true,
    city: body.city ? String(body.city).trim().slice(0, 80) : undefined,
    region: body.region ? String(body.region).trim().slice(0, 80) : undefined,
  });

  return {
    user: user.toSafeJSON(),
    temporaryPassword,
  };
}

async function listUsers(actor, query = {}) {
  const { role, status, search, includeDeleted } = query;
  const filter = {};
  if (!includeDeleted || includeDeleted === 'false') {
    filter.deletedAt = null;
  }
  // Operational Admin never sees Super Admin accounts in the console list.
  if (actor?.role === ROLES.ADMIN) {
    if (role === ROLES.SUPER_ADMIN) {
      return [];
    }
    if (role) filter.role = role;
    else filter.role = { $ne: ROLES.SUPER_ADMIN };
  } else if (role) {
    filter.role = role;
  }
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(filter).sort({ createdAt: -1 }).limit(500);
  return users.map((u) => u.toSafeJSON());
}

async function setUserStatus(actor, userId, status) {
  if (!['active', 'suspended'].includes(status)) {
    throw ApiError.badRequest('status must be active or suspended');
  }
  const user = await User.findById(userId);
  assertCanManageTarget(actor, user);

  if (String(user._id) === String(actor.id) && status === 'suspended') {
    throw ApiError.badRequest('Cannot suspend your own account');
  }

  user.status = status;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user.toSafeJSON();
}

async function setUserRole(actor, userId, role) {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin may change roles');
  }
  if (role === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super Admin role cannot be granted through this endpoint');
  }
  if (!ALL_ROLES.includes(role)) {
    throw ApiError.badRequest('Invalid role');
  }
  const user = await User.findById(userId);
  assertCanManageTarget(actor, user);
  if (String(user._id) === String(actor.id)) {
    throw ApiError.badRequest('Cannot change your own role');
  }

  user.role = role;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user.toSafeJSON();
}

async function updateUser(actor, userId, patch) {
  const user = await User.findById(userId);
  assertCanManageTarget(actor, user);

  for (const key of SAFE_EDIT_FIELDS) {
    if (patch[key] !== undefined) {
      user[key] = typeof patch[key] === 'string' ? patch[key].trim() : patch[key];
    }
  }
  // Never accept password / email / role / status via this path
  await user.save();
  return user.toSafeJSON();
}

async function softDeleteUser(actor, userId) {
  if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden();
  }
  const user = await User.findById(userId);
  assertCanManageTarget(actor, user);
  if (String(user._id) === String(actor.id)) {
    throw ApiError.badRequest('Cannot delete your own account');
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Cannot delete a Super Admin account');
  }
  // Delete Admin accounts: Super Admin only (matrix: Delete Admin ❌ for Admin).
  if (user.role === ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin may delete admin accounts');
  }

  user.deletedAt = new Date();
  user.status = 'suspended';
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user.toSafeJSON();
}

async function restoreUser(actor, userId) {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin may restore users');
  }
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  user.deletedAt = null;
  user.status = 'active';
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user.toSafeJSON();
}

module.exports = {
  createUser,
  listUsers,
  setUserStatus,
  setUserRole,
  updateUser,
  softDeleteUser,
  restoreUser,
  SAFE_EDIT_FIELDS,
  PROVISIONABLE_ROLES,
  assertCanManageTarget,
};
