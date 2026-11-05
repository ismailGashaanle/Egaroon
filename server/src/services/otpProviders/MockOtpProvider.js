const OtpProvider = require('./OtpProvider');
const { maskTarget } = require('./mask');

/**
 * Dev / default provider. Does not deliver SMS.
 * otp.service generates a local hashed OTP and may expose `devCode` outside production.
 * Logs only masked targets — never the OTP or secrets.
 */
class MockOtpProvider extends OtpProvider {
  get name() {
    return 'mock';
  }

  get managesCodes() {
    return false;
  }

  async send({ to, channel, purpose }) {
    // Intentionally no network call. Delivery is simulated via otp.service logging (masked).
    console.log(
      `[otp:mock] queued purpose=${purpose || '-'} channel=${channel || '-'} to=${maskTarget(channel, to)}`
    );
    return { delivered: true, status: 'mocked' };
  }
}

module.exports = MockOtpProvider;
