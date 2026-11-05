const OtpProvider = require('./OtpProvider');
const ApiError = require('../../utils/ApiError');

/**
 * Stub — regional SMS fallback for Somalia when Twilio geo/SMS is unavailable.
 *
 * Future env (do not implement until partner credentials exist):
 *   AT_USERNAME, AT_API_KEY, AT_SENDER_ID
 *
 * Also consider Waafi / Hormuud SMS aggregators for +252.
 * Until wired, keep OTP_PROVIDER=twilio or mock.
 */
    return 'africastalking';
class AfricasTalkingProvider extends OtpProvider {
  get name() {
  }

  get managesCodes() {
    // Hybrid Option B when implemented: local hash + AT Messaging send
    return false;
  }

  get configured() {
    return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
  }

  async send() {
    throw ApiError.internal(
      'Africa\'s Talking OTP provider is not implemented yet. Use OTP_PROVIDER=twilio (Verify) or mock.'
    );
  }
}

module.exports = AfricasTalkingProvider;
