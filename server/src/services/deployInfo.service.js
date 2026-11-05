const mongoose = require('mongoose');
const env = require('../config/env');

const startedAt = new Date();

/** Public, non-secret summary of the active payment provider: mock | sandbox | live | not_configured. */
function paymentSetup() {
  try {
    const provider = require('../providers/payment').getPaymentProvider();
    const sandbox = typeof provider.baseUrl === 'string' && provider.baseUrl.includes('sifalo.net');
    return {
      provider: provider.name,
      mode: provider.name === 'mock' ? 'mock' : provider.configured === false ? 'not_configured' : sandbox ? 'sandbox' : 'live',
    };
  } catch {
    return { provider: 'unknown', mode: 'unknown' };
  }
}

function smsProvider() {
  try {
    return require('./otpProviders').getOtpProvider('phone').name;
  } catch {
    return 'misconfigured';
  }
}

/**
 * What this server is running right now — for health checks, uptime monitors, and answering
 * "did my deployment land?". Booleans and names only: no keys, secrets or user data.
 */
function describeDeployment() {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    status: 'ok',
    time: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    environment: process.env.VERCEL_ENV || env.nodeEnv,
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    payments: paymentSetup(),
    sms: smsProvider(),
    integrations: {
      turnstile: require('./captcha.service').isEnabled(),
      googleSignIn: require('./oauth.service').isGoogleConfigured(),
      cronSecret: Boolean(process.env.CRON_SECRET),
    },
  };
}

module.exports = { describeDeployment, paymentSetup };
