const path = require('path');

// Always load server/.env regardless of process.cwd() (e.g. starting from monorepo root).
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
  quiet: true,
});

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : value || '';
}

function parseCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return {};
  try {
    const trimmed = url.trim().replace(/^cloudinary:\/\//i, '');
    const at = trimmed.lastIndexOf('@');
    if (at < 0) return {};
    const cloudName = trimmed.slice(at + 1).split(/[/?]/)[0];
    const creds = trimmed.slice(0, at);
    const colon = creds.indexOf(':');
    if (colon < 0) return { cloudName };
    return {
      cloudName,
      apiKey: creds.slice(0, colon),
      apiSecret: creds.slice(colon + 1),
    };
  } catch {
    return {};
  }
}

function resolveCloudinary() {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  return {
    cloudName: trim(process.env.CLOUDINARY_CLOUD_NAME) || trim(fromUrl.cloudName),
    apiKey: trim(process.env.CLOUDINARY_API_KEY) || trim(fromUrl.apiKey),
    apiSecret: trim(process.env.CLOUDINARY_API_SECRET) || trim(fromUrl.apiSecret),
  };
}

const nodeEnv = process.env.NODE_ENV || 'development';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

/** Vite SPA + optional CORS_ORIGINS; Expo web ports only in development. */
const EXPO_WEB_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
];

function buildCorsOrigins() {
  const origins = new Set([clientUrl]);
  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => origins.add(o));
  if (nodeEnv === 'development') {
    EXPO_WEB_ORIGINS.forEach((o) => origins.add(o));
  }
  return [...origins];
}

const env = {
  nodeEnv,
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl,
  /** Allowed browser origins for CORS (never '*' with credentials). */
  corsOrigins: buildCorsOrigins(),

  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/kulansiiye'),
  /** Redis for slot locks. Optional in dev — see redis.js memory fallback. */
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  /** Set REDIS_ENABLED=false to skip Redis entirely and use in-memory locks. */
  redisEnabled: !['false', '0', 'off', 'no'].includes(
    String(process.env.REDIS_ENABLED ?? 'true').toLowerCase()
  ),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  business: {
    bookingHoldMinutes: parseInt(process.env.BOOKING_HOLD_MINUTES || '10', 10),
    bookingHoldGraceMinutes: parseInt(process.env.BOOKING_HOLD_GRACE_MINUTES || '2', 10),
    teamBPaymentDeadlineMinutes: parseInt(process.env.TEAM_B_PAYMENT_MINUTES || '12', 10),
    teamBPriorityMinutes: parseInt(process.env.TEAM_B_PRIORITY_MINUTES || process.env.TEAM_B_PAYMENT_MINUTES || '12', 10),
    teamBGraceMinutes: parseInt(process.env.TEAM_B_GRACE_MINUTES || '10', 10),
    teamBMaxGraceExtensions: parseInt(process.env.TEAM_B_MAX_GRACE_EXTENSIONS || '2', 10),
    teamBFinalGraceMinutes: parseInt(process.env.TEAM_B_FINAL_GRACE_MINUTES || '3', 10),
    slotDemandTtlSeconds: parseInt(process.env.SLOT_DEMAND_TTL_SECONDS || '180', 10),
    autoRefundTeamAOnTeamBTimeout: process.env.AUTO_REFUND_TEAM_A_ON_TEAM_B_TIMEOUT !== 'false',
    preferWalletCreditOnDemandRelease: process.env.PREFER_WALLET_CREDIT_ON_DEMAND_RELEASE !== 'false',
    releaseSlotOnPartialPaymentTimeout: process.env.RELEASE_SLOT_ON_PARTIAL_PAYMENT_TIMEOUT !== 'false',
    platformCommissionPercent: parseFloat(process.env.PLATFORM_COMMISSION_PERCENT || '4'),
    ownerPayoutDelayMinutes: parseInt(process.env.OWNER_PAYOUT_DELAY_MINUTES || '60', 10),
    noShowGraceMinutes: parseInt(process.env.NO_SHOW_GRACE_MINUTES || '15', 10),
    /** Max km between Team A stadium and Team B for invites (GPS). */
    maxMatchDistanceKm: parseFloat(process.env.MAX_MATCH_DISTANCE_KM || '30'),
  },

  support: {
    email: process.env.SUPPORT_EMAIL || 'support@egaroon.com',
    phone: process.env.SUPPORT_PHONE || '0610000000',
    whatsapp: process.env.SUPPORT_WHATSAPP || '252610000000',
  },

  cookieSecure: process.env.COOKIE_SECURE === 'true',

  /** Public API origin for OAuth redirects (Google callback must hit this host). */
  apiPublicUrl: trim(process.env.API_PUBLIC_URL) || 'http://localhost:5000',

  /**
   * Google OAuth — optional. When client id + secret are set, GET /auth/features
   * returns oauthEnabled: true and the web app shows Continue with Google.
   * Callback: {API_PUBLIC_URL}/api/auth/oauth/google/callback
   */
  oauth: {
    google: {
      clientId: trim(process.env.GOOGLE_CLIENT_ID),
      clientSecret: trim(process.env.GOOGLE_CLIENT_SECRET),
      callbackUrl: trim(process.env.GOOGLE_CALLBACK_URL),
    },
  },

  /**
   * OTP delivery — server only.
   * OTP_ENABLED=false (default) skips OTP on register / password reset.
   * Set OTP_ENABLED=true to require OTP again (Twilio / mock still via OTP_PROVIDER).
   * OTP_PROVIDER=mock|twilio (default mock). Never put Twilio secrets in the Vite client.
   * Twilio Verify (preferred): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID.
   */
  otp: {
    /** Master switch — default false until production is ready for OTP. */
    enabled: String(process.env.OTP_ENABLED || '').toLowerCase() === 'true',
    provider: (process.env.OTP_PROVIDER || 'mock').toLowerCase(),
    twilioAccountSid: trim(process.env.TWILIO_ACCOUNT_SID),
    twilioVerifyServiceSid: trim(process.env.TWILIO_VERIFY_SERVICE_SID),
    // Auth token intentionally not mirrored on env object for accidental logging —
    // providers read process.env.TWILIO_AUTH_TOKEN directly.
    twilioChannel: (process.env.OTP_TWILIO_CHANNEL || 'sms').toLowerCase(),
  },

  // Cloudflare R2 Storage (https://dash.cloudflare.com)
  cloudflareR2: {
    accountId: trim(process.env.CLOUDFLARE_R2_ACCOUNT_ID),
    accessKeyId: trim(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID),
    secretAccessKey: trim(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
    bucketName: trim(process.env.CLOUDFLARE_R2_BUCKET_NAME) || 'kulansiiye',
    publicUrl: trim(process.env.CLOUDFLARE_R2_PUBLIC_URL),
  },

  /**
   * Cloudflare Turnstile (free CAPTCHA). Keys come from dash.cloudflare.com → Turnstile.
   * Both must be set to switch it on; the site key is public, the secret key stays on the server.
   */
  turnstile: {
    siteKey: trim(process.env.TURNSTILE_SITE_KEY),
    secretKey: trim(process.env.TURNSTILE_SECRET_KEY),
  },

  /**
   * DEMO ONLY. When set, password login asks for this fixed sample code as a second step.
   * Not real security — see services/demo2fa.service.js. Leave unset for a normal login.
   */
  demo2fa: {
    // One code, or several separated by commas / spaces: DEMO_2FA_CODE=482913,731605
    codes: String(process.env.DEMO_2FA_CODE || '')
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter(Boolean),
  },

  storageProvider: (process.env.STORAGE_PROVIDER || 'cloudflare').toLowerCase(),

  // Cloudinary (fallback) — API secret must stay on the server only (never in the Vite client).
  get cloudinary() {
    return resolveCloudinary();
  },
};

module.exports = env;
