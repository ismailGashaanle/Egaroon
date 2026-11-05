const OtpCode = require('../models/OtpCode');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { normalizeSomaliPhone, formatDisplay, toE164 } = require('../utils/somaliPhone');
const { getOtpProvider } = require('./otpProviders');
const { maskTarget } = require('./otpProviders/mask');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Max OTP create requests per target within window (phone/email abuse). */
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;
/** Minimum gap between sends to the same target+purpose. */
const RESEND_COOLDOWN_MS = 30 * 1000;

function normalizeTarget(channel, raw) {
  if (channel === 'email') {
    const email = String(raw || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) throw ApiError.badRequest('Valid email is required');
    return email;
  }
  const phone = normalizeSomaliPhone(raw);
  if (!phone) {
    throw ApiError.badRequest(
      'Invalid Somali mobile. Use Hormuud 061, Telesom 063, Somtel 065, or Golis 090'
    );
  }
  return phone;
}

/**
 * Approach A (preferred): Twilio Verify manages phone OTP codes.
 * Email always uses local hashed OTP (mock/console until SMTP exists).
 *
 * Never returns `devCode` when OTP_PROVIDER=twilio (or in production).
 */
async function sendOtp({ channel, target, purpose }) {
  if (!['email', 'phone'].includes(channel)) {
    throw ApiError.badRequest('channel must be email or phone');
  }
  if (!['register', 'reset', 'withdrawal'].includes(purpose)) {
    throw ApiError.badRequest('purpose must be register, reset, or withdrawal');
  }

  const normalized = normalizeTarget(channel, target);
  await enforceSendLimits({ channel, target: normalized, purpose });

  const provider = getOtpProvider(channel);

  await OtpCode.deleteMany({ channel, target: normalized, purpose, consumedAt: null });

  let codeForDev = null;
  let providerSid;

  if (provider.managesCodes) {
    // Twilio Verify (phone): provider generates + delivers; we only track purpose/session.
    const delivery = await provider.send({
      to: channel === 'phone' ? toE164(normalized) : normalized,
      channel: 'sms',
      purpose,
    });
    providerSid = delivery?.sid;

    await OtpCode.create({
      channel,
      target: normalized,
      purpose,
      provider: provider.name,
      codeHash: OtpCode.EXTERNAL_CODE_HASH,
      expiresAt: new Date(Date.now() + TTL_MS),
      providerSid,
    });

    console.log(
      `[otp] ${purpose} ${channel}=${maskTarget(channel, normalized)} via=${provider.name}`
    );
  } else {
    // Local hashed OTP (email always; phone when OTP_PROVIDER=mock).
    const code = OtpCode.generateNumericOtp(6);
    const codeHash = await OtpCode.hashCode(code);
    codeForDev = code;

    await OtpCode.create({
      channel,
      target: normalized,
      purpose,
      provider: 'local',
      codeHash,
      expiresAt: new Date(Date.now() + TTL_MS),
    });

    await provider.send({
      to: channel === 'phone' ? toE164(normalized) || normalized : normalized,
      channel: channel === 'phone' ? 'sms' : 'email',
      purpose,
    });

    // Log masked target only — never log the OTP itself outside intentional mock helper.
    if (env.nodeEnv !== 'production') {
      console.log(
        `[otp] ${purpose} ${channel}=${maskTarget(channel, normalized)} via=local (code omitted from log; use API devCode in mock mode)`
      );
    }
  }

  const exposeDevCode =
    Boolean(codeForDev) && env.nodeEnv !== 'production' && !provider.managesCodes;

  return {
    channel,
    target: channel === 'phone' ? formatDisplay(normalized) : normalized,
    expiresInSeconds: TTL_MS / 1000,
    provider: provider.managesCodes ? provider.name : 'local',
    ...(exposeDevCode ? { devCode: codeForDev } : {}),
  };
}

async function verifyOtp({ channel, target, purpose, code }) {
  const normalized = normalizeTarget(channel, target);
  const row = await OtpCode.findOne({
    channel,
    target: normalized,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!row || row.expiresAt < new Date()) {
    throw ApiError.badRequest(`OTP waa dhacay ama khaldan. ${hint()}`);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest(`OTP attempts exceeded. ${hint()}`);
  }

  let ok = false;

  if (row.provider === 'twilio_verify' || row.codeHash === OtpCode.EXTERNAL_CODE_HASH) {
    const provider = getOtpProvider(channel);
    if (!provider.managesCodes) {
      throw ApiError.internal(
        'OTP was issued via Twilio Verify but OTP_PROVIDER is no longer twilio. Set OTP_PROVIDER=twilio or request a new code.'
      );
    }
    const check = await provider.verify({
      to: channel === 'phone' ? toE164(normalized) : normalized,
      code,
    });
    ok = Boolean(check.approved);
  } else {
    ok = await OtpCode.compareCode(code, row.codeHash);
  }

  row.attempts += 1;
  if (!ok) {
    await row.save();
    throw ApiError.badRequest(`OTP code is incorrect. ${hint()}`);
  }

  row.consumedAt = new Date();
  await row.save();

  return { channel, target: normalized, purpose, verified: true };
}

async function enforceSendLimits({ channel, target, purpose }) {
  const since = new Date(Date.now() - SEND_WINDOW_MS);
  const recentCount = await OtpCode.countDocuments({
    channel,
    target,
    createdAt: { $gte: since },
  });
  if (recentCount >= MAX_SENDS_PER_WINDOW) {
    throw ApiError.badRequest(
      `Too many OTP requests for this ${channel}. Wait 15 minutes and try again. ${hint()}`
    );
  }

  const last = await OtpCode.findOne({ channel, target, purpose }).sort({ createdAt: -1 });
  if (last && Date.now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    throw ApiError.badRequest('Please wait a few seconds before requesting another OTP.');
  }
}

function hint() {
  const support = require('./platformSettings.service').getBusiness().support || {};
  const phone = support.phone || env.support?.phone || '0610000000';
  const email = support.email || env.support?.email || 'support@egaroon.com';
  return `Haddii dhibaato jirto, la xiriir E-Garoon: ${phone} / ${email}`;
}

module.exports = { sendOtp, verifyOtp, normalizeTarget, hint };
