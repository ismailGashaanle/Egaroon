const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}

// Verifies the JWT and attaches { id, role } to req.user.
// Never trust a role claimed anywhere else (body/query) — only this.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub).select('_id role status deletedAt');
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('User no longer exists');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }

  req.user = { id: user._id.toString(), role: user.role };
  next();
});

// Same as requireAuth but does not fail the request if no/invalid token is present.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('_id role status deletedAt');
    if (user && !user.deletedAt && user.status !== 'suspended') {
      req.user = { id: user._id.toString(), role: user.role };
    }
  } catch (_err) {
    // ignore invalid token in optional mode
  }
  next();
});

function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of roles: ${roles.join(', ')}`));
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
