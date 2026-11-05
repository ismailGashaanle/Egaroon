const MockOtpProvider = require('./MockOtpProvider');
const TwilioVerifyProvider = require('./TwilioVerifyProvider');
const AfricasTalkingProvider = require('./AfricasTalkingProvider');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

/**
 * Resolve OTP delivery adapter.
 *
 * OTP_PROVIDER=mock|twilio|africastalking (default mock)
 *
 * Channel policy:
 * - email → always Mock (local hashed OTP; console in non-prod). Real email later.
 * - phone → configured provider (Twilio Verify preferred).
 *
 * Fail closed: OTP_PROVIDER=twilio without credentials throws — never silent mock
 * that would expose codes in production.
 */
function getOtpProvider(channel) {
  const configured = (env.otp?.provider || process.env.OTP_PROVIDER || 'mock').toLowerCase();

  // Email stays on local/mock delivery for now (no SMTP wiring in MVP).
  if (channel === 'email') {
    return new MockOtpProvider();
  }

  switch (configured) {
    case 'twilio':
    case 'twilio_verify': {
      const provider = new TwilioVerifyProvider();
      if (!provider.configured) {
        throw ApiError.internal(
          'OTP_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID. Refusing to fall back to mock (would expose codes). Set OTP_PROVIDER=mock for local development.'
        );
      }
      return provider;
    }
    case 'africastalking':
    case 'at':
      return new AfricasTalkingProvider();
    case 'mock':
    default:
      return new MockOtpProvider();
  }
}

function isTwilioOtpMode() {
  const p = (env.otp?.provider || process.env.OTP_PROVIDER || 'mock').toLowerCase();
  return p === 'twilio' || p === 'twilio_verify';
}

module.exports = {
  getOtpProvider,
  isTwilioOtpMode,
  MockOtpProvider,
  TwilioVerifyProvider,
  AfricasTalkingProvider,
};
