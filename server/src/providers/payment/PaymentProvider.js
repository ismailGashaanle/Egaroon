/**
 * Payment provider adapter interface (docs/14-payment-design.md).
 * Concrete providers implement initiate / verifyWebhook / parseWebhookEvent / checkBalance.
 */
class PaymentProvider {
  get name() {
    throw new Error('PaymentProvider.name must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async initiate({ amount, currency, metadata, phone, operator }) {
    throw new Error('initiate() must be implemented');
  }

  /**
   * Optional pre-check. Return { ok: true } or { ok: false, reason }.
   * Mock simulates; live adapters call provider APIs when available.
   */
  // eslint-disable-next-line no-unused-vars
  async checkBalance({ phone, amount, currency, operator }) {
    return { ok: true, simulated: true };
  }

  // eslint-disable-next-line no-unused-vars
  async verifyWebhook(headers, body) {
    throw new Error('verifyWebhook() must be implemented');
  }

  /**
   * Normalize provider payload → { eventId, paymentId, providerReference, status, reason }
   * status: 'succeeded' | 'failed'
   */
  // eslint-disable-next-line no-unused-vars
  parseWebhookEvent(body) {
    throw new Error('parseWebhookEvent() must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async refund(providerRef, amount) {
    throw new Error('refund() must be implemented');
  }
}

module.exports = PaymentProvider;
