const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/** Sentinel when Twilio Verify (or similar) owns the code — never a real bcrypt of an OTP. */
const EXTERNAL_CODE_HASH = 'external:provider-managed';

const otpSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'phone'], required: true },
    target: { type: String, required: true, index: true },
    purpose: { type: String, enum: ['register', 'reset', 'withdrawal'], required: true },
    /** local = bcrypt hash of OTP; twilio_verify = provider-managed (codeHash sentinel). */
    provider: {
      type: String,
      enum: ['local', 'twilio_verify', 'mock'],
      default: 'local',
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    /** Optional Twilio verification SID for ops correlation (not secret). */
    providerSid: { type: String },
  },
  { timestamps: true }
);

otpSchema.index({ target: 1, purpose: 1, channel: 1 });

const OtpCode = mongoose.model('OtpCode', otpSchema);

async function hashCode(code) {
  return bcrypt.hash(String(code), 8);
}

async function compareCode(code, hash) {
  if (!hash || hash === EXTERNAL_CODE_HASH) return false;
  return bcrypt.compare(String(code), hash);
}

function generateNumericOtp(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

OtpCode.hashCode = hashCode;
OtpCode.compareCode = compareCode;
OtpCode.generateNumericOtp = generateNumericOtp;
OtpCode.EXTERNAL_CODE_HASH = EXTERNAL_CODE_HASH;

module.exports = OtpCode;
