const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const redis = require('../config/redis');
const { resolvePublicSignupRole } = require('./platformSettings.service');

const EXCHANGE_TTL_SEC = 90;
const EXCHANGE_PREFIX = 'oauth:ex:';

function isGoogleConfigured() {
  return Boolean(env.oauth.google.clientId && env.oauth.google.clientSecret);
}

/**
 * Google's endpoints. Outside production they can be pointed at a local fake (scripts/mock-google.js)
 * to test the whole sign-in flow without a Google account. In production the override is ignored,
 * so a bad environment value can never send the client secret to another host.
 */
function googleEndpoint(envName, defaultUrl) {
  if (env.nodeEnv !== 'production' && process.env[envName]) return process.env[envName];
  return defaultUrl;
}

function googleCallbackUrl() {
  if (env.oauth.google.callbackUrl) return env.oauth.google.callbackUrl;
  const base = String(env.apiPublicUrl || 'http://localhost:5000').replace(/\/$/, '');
  return `${base}/api/auth/oauth/google/callback`;
}

function signOAuthState(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: '10m' });
}

function verifyOAuthState(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret);
  } catch {
    throw ApiError.unauthorized('OAuth session expired. Try Google sign-in again.');
  }
}

function getGoogleAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: env.oauth.google.clientId,
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${googleEndpoint('GOOGLE_OAUTH_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth')}?${params.toString()}`;
}

async function exchangeGoogleCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: env.oauth.google.clientId,
    client_secret: env.oauth.google.clientSecret,
    redirect_uri: googleCallbackUrl(),
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch(googleEndpoint('GOOGLE_OAUTH_TOKEN_URL', 'https://oauth2.googleapis.com/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw ApiError.unauthorized('Google sign-in failed. Try again or use email and password.');
  }

  const userRes = await fetch(googleEndpoint('GOOGLE_OAUTH_USERINFO_URL', 'https://www.googleapis.com/oauth2/v3/userinfo'), {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !profile.email) {
    throw ApiError.unauthorized('Google did not return an email for this account.');
  }

  return {
    sub: String(profile.sub),
    email: String(profile.email).toLowerCase().trim(),
    name: String(profile.name || profile.email.split('@')[0]).trim(),
    picture: typeof profile.picture === 'string' ? profile.picture : '',
    emailVerified: Boolean(profile.email_verified),
  };
}

/**
 * Existing email wins: keep that user's role (never promote via OAuth).
 * New accounts get team_captain unless public owner signup is on and requested.
 */
async function upsertGoogleUser(profile, requestedRole) {
  let user = await User.findOne({ googleId: profile.sub });
  if (!user) {
    user = await User.findOne({ email: profile.email });
    // Linking by email hands over that account, so Google must have verified the address.
    if (user && !profile.emailVerified) {
      throw ApiError.unauthorized('Google has not verified this email address, so it cannot be linked to an existing account.');
    }
  }

  if (user) {
    if (user.deletedAt) {
      throw ApiError.unauthorized('This account is no longer active.');
    }
    if (user.status === 'suspended') {
      throw ApiError.forbidden('Account is suspended');
    }
    user.googleId = profile.sub;
    const providers = Array.isArray(user.authProviders) ? user.authProviders : ['local'];
    if (!providers.includes('google')) providers.push('google');
    user.authProviders = providers;
    if (profile.emailVerified) user.isEmailVerified = true;
    if (profile.picture && !user.avatarUrl) user.avatarUrl = profile.picture;
    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }

  const role = resolvePublicSignupRole(requestedRole);
  user = await User.create({
    name: profile.name,
    email: profile.email,
    googleId: profile.sub,
    authProviders: ['google'],
    role,
    selfRegistered: role === 'stadium_owner',
    isEmailVerified: profile.emailVerified,
    avatarUrl: profile.picture || undefined,
    lastLoginAt: new Date(),
  });
  return user;
}

async function storeExchangeCode(userId) {
  const code = randomUUID();
  await redis.setEx(`${EXCHANGE_PREFIX}${code}`, EXCHANGE_TTL_SEC, String(userId));
  return code;
}

async function consumeExchangeCode(code) {
  if (!code || typeof code !== 'string') {
    throw ApiError.badRequest('Missing OAuth code');
  }
  const key = `${EXCHANGE_PREFIX}${code}`;
  const userId = await redis.get(key);
  await redis.del(key);
  if (!userId) {
    throw ApiError.unauthorized('OAuth code expired. Try Google sign-in again.');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('User no longer active');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }
  return user;
}

function clientOAuthRedirect({ code, error }) {
  const base = String(env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
  const url = new URL(`${base}/oauth/callback`);
  if (code) url.searchParams.set('code', code);
  if (error) url.searchParams.set('error', error);
  return url.toString();
}

module.exports = {
  isGoogleConfigured,
  googleCallbackUrl,
  signOAuthState,
  verifyOAuthState,
  getGoogleAuthorizationUrl,
  exchangeGoogleCode,
  upsertGoogleUser,
  storeExchangeCode,
  consumeExchangeCode,
  clientOAuthRedirect,
};
