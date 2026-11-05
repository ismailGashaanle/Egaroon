const { randomUUID: uuid } = require('crypto');
const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/**
 * Dev/MVP adapter — simulates Somali MM USSD push + optional balance fail.
 *
 * Balance simulation:
 * - Phones whose national number ends with 9999 → insufficient funds
 * - metadata.forceInsufficient === true → insufficient
 * - MOCK_FORCE_INSUFFICIENT=true env → all fails
 *
 * After initiate, use POST /payments/:id/mock-confirm or mock-fail (or webhook).
 */
class MockProvider extends PaymentProvider {
  get name() {
    return 'mock';
  }

  async checkBalance({ phone, amount, metadata }) {
    if (process.env.MOCK_FORCE_INSUFFICIENT === 'true') {
      return {
        ok: false,
        reason: 'INSUFFICIENT_FUNDS',
        message: 'Lacagta kuma filna — Insufficient balance (mock)',
        simulated: true,
      };
    }
    if (metadata?.forceInsufficient) {
      return {
        ok: false,
        reason: 'INSUFFICIENT_FUNDS',
        message: 'Lacagta kuma filna — Insufficient balance (mock)',
        simulated: true,
      };
    }
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.endsWith('9999')) {
      return {
        ok: false,
        reason: 'INSUFFICIENT_FUNDS',
        message: 'Lacagta kuma filna — Insufficient balance (mock: …9999)',
        simulated: true,
      };
    }
    return { ok: true, simulated: true, amount, phone };
  }

  async initiate({ amount, currency, metadata, phone, operator }) {
    const balance = await this.checkBalance({ phone, amount, currency, operator, metadata });
    if (!balance.ok) {
      const err = new Error(balance.message || 'Insufficient funds');
      err.code = 'INSUFFICIENT_FUNDS';
      err.balance = balance;
      throw err;
    }

    const providerReference = `mock-${uuid()}`;
    return {
      provider: this.name,
      providerReference,
      checkoutUrl: null,
      amount,
      currency,
      phone,
      operator,
      metadata,
      status: 'pending_ussd_push',
      mode: 'mock',
      message: 'USSD push simulated — confirm via mock-confirm / mock-fail or webhook',
    };
  }

  async verifyWebhook(headers, body) {
    const secret = process.env.MOCK_WEBHOOK_SECRET;
    if (secret) {
      const sig = headers['x-kulansiiye-signature'] || headers['x-mock-signature'];
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      if (sig && sig !== expected) {
        return { valid: false, payload: null };
      }
    }
    return { valid: true, payload: typeof body === 'string' ? JSON.parse(body) : body };
  }

  parseWebhookEvent(body) {
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const event = payload.event || payload.type;
    let status = null;
    if (event === 'payment.succeeded' || payload.status === 'SUCCESS' || payload.status === 'HELD') {
      status = 'succeeded';
    } else if (event === 'payment.failed' || payload.status === 'FAILED') {
      status = 'failed';
    }
    return {
      eventId: payload.eventId || payload.id || `mock-evt-${payload.paymentId}-${status}`,
      paymentId: payload.paymentId,
      providerReference: payload.providerReference || payload.reference,
      status,
      reason: payload.reason || payload.failureReason,
    };
  }

  async refund(providerRef, amount) {
    return { providerReference: providerRef, amount, status: 'refunded', simulated: true };
  }
}

module.exports = MockProvider;
