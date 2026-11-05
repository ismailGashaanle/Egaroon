/**
 * OTP delivery adapter interface.
 * Concrete providers implement send / verify (and optionally manage codes).
 *
 * When managesCodes === true (e.g. Twilio Verify), the provider generates,
 * delivers, and checks the code — E-Garoon never sees the plaintext OTP.
 * When false (mock / Messaging hybrid), otp.service generates + hashes locally.
 */
class OtpProvider {
  get name() {
    throw new Error('OtpProvider.name must be implemented');
  }

  /** If true, provider owns code generation and verification (Verify API). */
  get managesCodes() {
    return false;
  }

  get configured() {
    return true;
  }

  /**
   * @param {{ to: string, channel: 'sms'|'whatsapp'|'email', purpose?: string }} _opts
   * @returns {Promise<{ sid?: string, status?: string, delivered: boolean }>}
   */
  // eslint-disable-next-line no-unused-vars
  async send(_opts) {
    throw new Error('send() must be implemented');
  }

  /**
   * Only required when managesCodes is true.
   * @param {{ to: string, code: string }} _opts
   * @returns {Promise<{ approved: boolean, status?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async verify(_opts) {
    throw new Error('verify() must be implemented');
  }
}

module.exports = OtpProvider;
