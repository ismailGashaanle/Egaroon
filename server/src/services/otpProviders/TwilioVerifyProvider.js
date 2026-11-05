const OtpProvider = require('./OtpProvider');
const ApiError = require('../../utils/ApiError');
const { maskPhone } = require('./mask');

/**
 * Twilio Verify adapter (preferred for OTP).
 * Twilio generates, rate-limits, and checks codes — we never store plaintext OTP.
 *
 * Env (server only — never commit real values, never put in Vite client):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_VERIFY_SERVICE_SID
 *   OTP_TWILIO_CHANNEL=sms|whatsapp (default sms)
 *
 * Somalia (+252): enable geographic permissions for Somalia in Twilio Console.
 * If SMS to SO fails, consider Africa's Talking / local aggregator (see AfricasTalkingProvider stub).
 */
class TwilioVerifyProvider extends OtpProvider {
  get name() {
    return 'twilio_verify';
  }

  get managesCodes() {
    return true;
  }

  get configured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_VERIFY_SERVICE_SID
    );
  }

  get verifyChannel() {
    const ch = String(process.env.OTP_TWILIO_CHANNEL || 'sms').toLowerCase();
    return ch === 'whatsapp' ? 'whatsapp' : 'sms';
  }

  _client() {
    // Lazy require so mock-only installs do not need twilio until configured.
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  _assertConfigured() {
    if (!this.configured) {
      throw ApiError.internal(
        'OTP_PROVIDER=twilio but Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID (or set OTP_PROVIDER=mock for local dev).'
      );
    }
  }

  async send({ to, purpose }) {
    this._assertConfigured();
    const e164 = to.startsWith('+') ? to : `+${to}`;
    const masked = maskPhone(e164);

    try {
      const client = this._client();
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({
          to: e164,
          channel: this.verifyChannel,
        });

      console.log(
        `[otp:twilio] sent purpose=${purpose || '-'} to=${masked} status=${verification.status} sid=${verification.sid}`
      );

      return {
        delivered: true,
        status: verification.status,
        sid: verification.sid,
      };
    } catch (err) {
      const msg = err?.message || String(err);
      const code = err?.code;
      console.error(`[otp:twilio] send failed to=${masked} code=${code || '-'} msg=${msg}`);

      // Common: geo permissions / unsupported destination for trial
      if (
        code === 21215 ||
        code === 21408 ||
        /permission|geographic|not enabled|unreachable/i.test(msg)
      ) {
        throw ApiError.badRequest(
          'SMS to this number is not available (Twilio geographic permissions or Somalia coverage). Enable +252 in Twilio Geo Permissions, or use a regional provider (Africa\'s Talking). Contact E-Garoon support if this persists.'
        );
      }
      if (code === 60200 || /invalid.*phone|invalid parameter/i.test(msg)) {
        throw ApiError.badRequest('Invalid phone number for SMS delivery');
      }
      if (code === 60203 || /max.*check|rate|too many/i.test(msg)) {
        throw ApiError.badRequest('Too many OTP attempts. Please wait and try again.');
      }

      throw ApiError.internal(
        'Failed to send verification SMS. Check Twilio Verify configuration and try again.'
      );
    }
  }

  async verify({ to, code }) {
    this._assertConfigured();
    const e164 = to.startsWith('+') ? to : `+${to}`;
    const masked = maskPhone(e164);

    try {
      const client = this._client();
      const check = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: e164, code: String(code) });

      const approved = check.status === 'approved';
      console.log(
        `[otp:twilio] check to=${masked} status=${check.status} approved=${approved}`
      );
      return { approved, status: check.status };
    } catch (err) {
      const msg = err?.message || String(err);
      const twilioCode = err?.code;
      console.error(
        `[otp:twilio] check failed to=${masked} code=${twilioCode || '-'} msg=${msg}`
      );

      // No pending verification / expired
      if (twilioCode === 20404 || /not found|expired/i.test(msg)) {
        return { approved: false, status: 'expired' };
      }
      if (twilioCode === 60202 || /max.*check/i.test(msg)) {
        throw ApiError.badRequest('OTP attempts exceeded. Request a new code.');
      }

      return { approved: false, status: 'failed' };
    }
  }
}

module.exports = TwilioVerifyProvider;
