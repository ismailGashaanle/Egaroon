const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const env = require('../config/env');
const { normalizeSomaliPhone, formatDisplay, phoneLookupVariants } = require('../utils/somaliPhone');
const otpService = require('../services/otp.service');
const { listContacts } = require('../config/contacts');
const { getBusiness, resolvePublicSignupRole } = require('../services/platformSettings.service');
const oauthService = require('../services/oauth.service');
const { ROLES } = require('../constants/roles');
const demo2fa = require('../services/demo2fa.service');

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  const safe = user.toSafeJSON();
  if (user.role === 'stadium_owner') {
    try {
      const { checkOwnerSubscriptionLockout } = require('../services/stadiumSubscription.service');
      safe.subscriptionLockout = await checkOwnerSubscriptionLockout(user._id);
    } catch {
      safe.subscriptionLockout = { locked: false };
    }
  }
  return { user: safe, accessToken };
}

const getFeatures = asyncHandler(async (_req, res) => {
  const business = getBusiness();
  sendSuccess(res, 200, {
    otpEnabled: Boolean(env.otp.enabled),
    /** Super-admin platform setting; default false until enabled. */
    lineupEnabled: Boolean(business.lineupEnabled),
    /** Super-admin platform setting; default false until enabled (BR-009c). */
    giftEnabled: Boolean(business.giftEnabled),
    /** Super-admin flag; default false — city play-risk alerts (rain / storm / wind). */
    weatherEnabled: Boolean(business.weatherEnabled),
    /** Super-admin visibility flag; default false — owners do not see commission (BR-009d). */
    ownerCommissionVisible: Boolean(business.ownerCommissionVisible),
    /** Super-admin flag; default false — public register is team_captain only. */
    publicOwnerSignup: Boolean(business.publicOwnerSignup),
    /** Daily exchange rate managed by Super Admin (SLL per USD). */
    sllPerUsd: Number(business.sllPerUsd || 8500),
    oauthEnabled: oauthService.isGoogleConfigured(),
    oauthProviders: oauthService.isGoogleConfigured() ? ['google'] : [],
    /** Which payment provider checkout uses right now (no secrets): mock | sandbox | live. */
    payments: require('../services/deployInfo.service').paymentSetup(),
    /** Turnstile (bot check) — site key is public; widget shows only when enabled. */
    captcha: require('../services/captcha.service').publicConfig(),
  });
});

const sendOtp = asyncHandler(async (req, res) => {
  if (!env.otp.enabled) {
    throw ApiError.badRequest(
      'OTP is currently disabled. Set OTP_ENABLED=true on the server to require verification.'
    );
  }
  const { channel, target, purpose } = req.body;
  const data = await otpService.sendOtp({ channel, target, purpose });
  sendSuccess(res, 200, { otp: data });
});

const verifyOtp = asyncHandler(async (req, res) => {
  if (!env.otp.enabled) {
    throw ApiError.badRequest(
      'OTP is currently disabled. Set OTP_ENABLED=true on the server to require verification.'
    );
  }
  const { channel, target, purpose, code } = req.body;
  const data = await otpService.verifyOtp({ channel, target, purpose, code });
  sendSuccess(res, 200, { verification: data });
});

const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    role,
    city,
    region,
    area,
    lat,
    lng,
    emailOtp,
    phoneOtp,
  } = req.body;

  const requestedRole = resolvePublicSignupRole(role, { rejectOwnerIfDisabled: true });

  if (!email || !phone) {
    throw ApiError.badRequest(
      `Email iyo telefoon labaduba waa loo baahan yahay. ${otpService.hint()}`
    );
  }

  // When OTP_ENABLED=true, require verified email + phone OTPs
  if (env.otp.enabled) {
    if (!emailOtp || !phoneOtp) {
      throw ApiError.badRequest(
        `Email and phone OTP codes are required. ${otpService.hint()}`
      );
    }
    await otpService.verifyOtp({
      channel: 'email',
      target: email,
      purpose: 'register',
      code: emailOtp,
    });
    await otpService.verifyOtp({
      channel: 'phone',
      target: phone,
      purpose: 'register',
      code: phoneOtp,
    });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict(`An account with this email already exists. ${otpService.hint()}`);
  }

  const normalizedPhone = normalizeSomaliPhone(phone);
  if (!normalizedPhone) {
    throw ApiError.badRequest(
      'Invalid Somali mobile. Use Hormuud 061, Telesom 063, Somtel 065, or Golis 090'
    );
  }
  const phoneTaken = await User.findOne({ phone: normalizedPhone });
  if (phoneTaken) {
    throw ApiError.conflict(
      `Phone ${formatDisplay(normalizedPhone)} is already registered. ${otpService.hint()}`
    );
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name,
    email,
    phone: normalizedPhone,
    passwordHash,
    role: requestedRole,
    selfRegistered: requestedRole === ROLES.STADIUM_OWNER,
    authProviders: ['local'],
    city: city || undefined,
    region: region || undefined,
    area: area || undefined,
    latLng:
      lat != null && lng != null
        ? { lat: Number(lat), lng: Number(lng) }
        : undefined,
    // Mark verified when OTP was checked; when OTP is disabled, still allow MVP signup
    isEmailVerified: Boolean(env.otp.enabled),
    isPhoneVerified: Boolean(env.otp.enabled),
  });

  sendSuccess(res, 201, await issueSession(res, user));
});

const login = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;
  const identifier = String(email || phone || '').trim();

  let user = null;
  if (identifier.includes('@')) {
    user = await User.findOne({ email: identifier.toLowerCase() }).select('+passwordHash');
  } else {
    const normalized = normalizeSomaliPhone(identifier);
    const variants = normalized ? phoneLookupVariants(normalized) : [identifier];
    user = await User.findOne({ phone: { $in: variants } }).select('+passwordHash');
    if (!user && identifier) {
      // Fallback: exact email-like miss already handled; try raw phone string
      user = await User.findOne({ phone: identifier }).select('+passwordHash');
    }
  }

  if (!user) throw ApiError.unauthorized(`Invalid email or password. ${otpService.hint()}`);

  if (!password || String(password).trim() === '') {
    throw ApiError.badRequest('Password is required');
  }

  // Legacy / corrupted accounts may exist without passwordHash — never crash bcrypt
  if (!user.passwordHash) {
    throw ApiError.unauthorized(
      `Account has no password set. Use Continue with Google or Forgot password. ${otpService.hint()}`,
      {
        code: 'PASSWORD_NOT_SET',
        messageEn: 'Account has no password set. Use Continue with Google or Forgot password.',
        messageSo: 'Akoonkan ma lahan password — isticmaal Google ama Forgot password.',
      }
    );
  }

  const match = await user.comparePassword(password);
  if (!match) throw ApiError.unauthorized(`Invalid email or password. ${otpService.hint()}`);

  if (user.deletedAt) throw ApiError.unauthorized(`Invalid email or password. ${otpService.hint()}`);
  if (user.status === 'suspended') throw ApiError.forbidden('Account is suspended');

  // Demo deployments: password is right, now ask for the sample code before signing in.
  if (demo2fa.isEnabled()) {
    return sendSuccess(res, 200, { twoFactorRequired: true, challenge: demo2fa.signChallenge(user) });
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, 200, await issueSession(res, user));
});

/** Second step of a demo login: the challenge from /login plus the sample code. */
const verifyLoginCode = asyncHandler(async (req, res) => {
  if (!demo2fa.isEnabled()) throw ApiError.notFound('Not found');
  const userId = demo2fa.readChallenge(req.body?.challenge);
  if (!demo2fa.codeMatches(req.body?.code)) {
    throw ApiError.unauthorized('That code is not correct. Please try again.');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw ApiError.unauthorized('This login session expired. Please sign in again.');
  if (user.status === 'suspended') throw ApiError.forbidden('Account is suspended');

  user.lastLoginAt = new Date();
  await user.save();
  sendSuccess(res, 200, await issueSession(res, user));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { channel, target } = req.body;
  const normalized = otpService.normalizeTarget(channel, target);

  const user =
    channel === 'email'
      ? await User.findOne({ email: normalized })
      : await User.findOne({ phone: normalized });

  if (!user) {
    // Do not leak existence — still pretend success, but no OTP stored for unknown users
    // Actually for UX in Somali market, better to say not found + contact
    throw ApiError.notFound(`Akoon lama helin. ${otpService.hint()}`);
  }

  // OTP disabled: account exists — client may reset with target + newPassword only
  if (!env.otp.enabled) {
    sendSuccess(res, 200, {
      otpDisabled: true,
      message: 'OTP disabled — set a new password without a code. Re-enable OTP_ENABLED for production.',
    });
    return;
  }

  const data = await otpService.sendOtp({ channel, target: normalized, purpose: 'reset' });
  sendSuccess(res, 200, { otp: data, message: 'OTP sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { channel, target, code, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  let normalized;
  if (env.otp.enabled) {
    if (!code) {
      throw ApiError.badRequest(`OTP code is required. ${otpService.hint()}`);
    }
    ({ target: normalized } = await otpService.verifyOtp({
      channel,
      target,
      purpose: 'reset',
      code,
    }));
  } else {
    normalized = otpService.normalizeTarget(channel, target);
  }

  const user =
    channel === 'email'
      ? await User.findOne({ email: normalized }).select('+passwordHash')
      : await User.findOne({ phone: normalized }).select('+passwordHash');

  if (!user) throw ApiError.notFound(`User not found. ${otpService.hint()}`);

  user.passwordHash = await User.hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.mustChangePassword = false;
  const providers = Array.isArray(user.authProviders) ? [...user.authProviders] : [];
  if (!providers.includes('local')) providers.push('local');
  user.authProviders = providers.length ? providers : ['local'];
  await user.save();

  sendSuccess(res, 200, { message: 'Password updated. You can log in now.' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const hasPassword = Boolean(user.passwordHash);
  if (hasPassword && !user.mustChangePassword) {
    if (!currentPassword) throw ApiError.badRequest('Current password is required');
    const match = await user.comparePassword(currentPassword);
    if (!match) throw ApiError.unauthorized('Current password is incorrect');
  } else if (hasPassword && currentPassword) {
    const match = await user.comparePassword(currentPassword);
    if (!match) throw ApiError.unauthorized('Current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  const providers = Array.isArray(user.authProviders) ? [...user.authProviders] : [];
  if (!providers.includes('local')) providers.push('local');
  user.authProviders = providers.length ? providers : ['local'];
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  sendSuccess(res, 200, {
    user: user.toSafeJSON(),
    accessToken,
    message: 'Password changed',
  });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (_err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status === 'suspended') {
    throw ApiError.unauthorized('User no longer active');
  }
  if ((user.tokenVersion || 0) !== payload.tokenVersion) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  sendSuccess(res, 200, { accessToken });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  sendSuccess(res, 200, { message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  const safe = user.toSafeJSON();
  if (user.role === 'stadium_owner') {
    try {
      const { checkOwnerSubscriptionLockout } = require('../services/stadiumSubscription.service');
      safe.subscriptionLockout = await checkOwnerSubscriptionLockout(user._id);
    } catch {
      safe.subscriptionLockout = { locked: false };
    }
  }
  sendSuccess(res, 200, { user: safe });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');

  const { name, avatarUrl, city, region, area, lat, lng } = req.body || {};

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }
  if (typeof avatarUrl === 'string') {
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !avatarUrl.startsWith('data:')) {
      throw ApiError.badRequest('avatarUrl must be an http(s) URL from Cloudinary');
    }
    // Prefer Cloudinary HTTPS URLs; reject huge data URIs on profile
    if (avatarUrl.startsWith('data:') && avatarUrl.length > 2000) {
      throw ApiError.badRequest('Upload the avatar via /api/uploads and save the returned URL');
    }
    user.avatarUrl = avatarUrl || undefined;
  }
  if (typeof city === 'string') user.city = city.trim();
  if (typeof region === 'string') user.region = region.trim();
  if (typeof area === 'string') user.area = area.trim();
  if (lat !== undefined || lng !== undefined) {
    user.latLng = {
      lat: lat !== undefined && lat !== '' ? Number(lat) : user.latLng?.lat,
      lng: lng !== undefined && lng !== '' ? Number(lng) : user.latLng?.lng,
    };
  }

  await user.save();
  sendSuccess(res, 200, { user: user.toSafeJSON() });
});

const getContacts = asyncHandler(async (req, res) => {
  const data = listContacts({ city: req.query.city, region: req.query.region });
  sendSuccess(res, 200, data);
});

const startGoogleOAuth = asyncHandler(async (req, res) => {
  if (!oauthService.isGoogleConfigured()) {
    throw ApiError.badRequest(
      'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.'
    );
  }
  const role = resolvePublicSignupRole(req.query.role);
  const state = oauthService.signOAuthState({ role, n: randomNonce() });
  res.redirect(oauthService.getGoogleAuthorizationUrl(state));
});

const googleOAuthCallback = asyncHandler(async (req, res) => {
  if (req.query.error) {
    return res.redirect(oauthService.clientOAuthRedirect({ error: 'denied' }));
  }
  try {
    const parsed = oauthService.verifyOAuthState(req.query.state);
    const profile = await oauthService.exchangeGoogleCode(req.query.code);
    const user = await oauthService.upsertGoogleUser(profile, parsed.role);
    const code = await oauthService.storeExchangeCode(user._id);
    return res.redirect(oauthService.clientOAuthRedirect({ code }));
  } catch (err) {
    const msg = err?.details?.code || err?.message || 'oauth_failed';
    return res.redirect(
      oauthService.clientOAuthRedirect({
        error: typeof msg === 'string' && msg.length < 80 ? 'failed' : 'failed',
      })
    );
  }
});

const exchangeOAuthCode = asyncHandler(async (req, res) => {
  const user = await oauthService.consumeExchangeCode(req.body.code);
  user.lastLoginAt = new Date();
  await user.save();
  sendSuccess(res, 200, await issueSession(res, user));
});

function randomNonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  getFeatures,
  register,
  login,
  verifyLoginCode,
  refresh,
  logout,
  me,
  updateMe,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  getContacts,
  startGoogleOAuth,
  googleOAuthCallback,
  exchangeOAuthCode,
};
