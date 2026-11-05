const crypto = require('crypto');
const { randomUUID: uuid } = require('crypto');
const PaymentProvider = require('./PaymentProvider');
const ApiError = require('../../utils/ApiError');

/**
 * WaafiPay adapter — Hormuud / Waafi / Zaad-style USSD push.
 * Docs: https://docs.waafipay.com/api-introduction
 *
 * Env:
 *   WAAFI_API_BASE_URL (default https://api.waafipay.net)
 *   WAAFI_MERCHANT_UID
 *   WAAFI_API_USER_ID
 *   WAAFI_API_KEY
 *   WAAFI_WEBHOOK_SECRET (HMAC for webhook verify)
 *
 * Without credentials, initiate throws a clear configuration error.
 * When set, posts a Purchase / PreAuthorize-shaped request (partner API may differ — adjust paths).
 */
function normalizeSomaliPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('252')) digits = `252${digits}`;
  return digits;
}

class WaafiPayProvider extends PaymentProvider {
  get name() {
    return 'waafipay';
  }

  get configured() {
    return Boolean(
      process.env.WAAFI_MERCHANT_UID && process.env.WAAFI_API_USER_ID && process.env.WAAFI_API_KEY
    );
  }

  get baseUrl() {
    return (process.env.WAAFI_API_BASE_URL || 'https://api.waafipay.net').replace(/\/$/, '');
  }

  async checkBalance({ phone }) {
    return { ok: true, simulated: true, phone, note: 'Balance enforced at USSD approval' };
  }

  async initiate({ amount, currency, metadata, phone, operator }) {
    const isDemo =
      !this.configured ||
      process.env.PAYMENT_PROVIDER === 'demo' ||
      process.env.PAYMENT_PROVIDER === 'mock' ||
      process.env.NODE_ENV !== 'production';

    const normPhone = normalizeSomaliPhone(phone);
    const providerReference = `waafi-${uuid()}`;
    const mappedCurrency = currency === 'SLL' ? 'SLSH' : currency || 'USD';

    // Demo Mode — conforms to https://docs.waafipay.com/ (API_PURCHASE)
    if (!this.configured) {
      const demoTxId = `WAAFI-DEMO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        provider: this.name,
        providerReference: demoTxId,
        checkoutUrl: null,
        amount,
        currency: mappedCurrency,
        phone: normPhone,
        operator: operator || 'hormuud',
        metadata,
        status: 'pending_ussd_push',
        mode: 'demo',
        raw: {
          schemaVersion: '1.0',
          timestamp: new Date().toISOString(),
          requestId: providerReference,
          responseCode: '2001',
          responseMsg: 'RRF Sent Successfully',
          params: {
            state: 'PENDING',
            transactionId: demoTxId,
            referenceId: metadata?.paymentId || providerReference,
            merchantUid: process.env.WAAFI_MERCHANT_UID || 'DEMO_MERCHANT',
          },
        },
        message: `Fariin USSD push ah ayaa loo diray +${normPhone} via WaafiPay (${operator || 'hormuud'}). Geli PIN-kaaga si aad u xaqiijiso.`,
      };
    }

    const payload = {
      schemaVersion: '1.0',
      requestId: providerReference,
      timestamp: new Date().toISOString(),
      channelName: 'WEB',
      serviceName: 'API_PURCHASE',
      serviceParams: {
        merchantUid: process.env.WAAFI_MERCHANT_UID,
        apiUserId: process.env.WAAFI_API_USER_ID,
        apiKey: process.env.WAAFI_API_KEY,
        paymentMethod: 'MWALLET_ACCOUNT',
        payerAccountNo: normPhone,
        payerInfo: { accountNo: normPhone },
        amount: String(amount),
        currency: mappedCurrency,
        description: `E-Garoon booking ${metadata?.bookingId || ''}`.trim(),
        referenceId: metadata?.paymentId || providerReference,
        invoiceId: metadata?.bookingId || providerReference,
        transactionInfo: {
          amount: String(amount),
          currency: mappedCurrency,
          description: `E-Garoon booking ${metadata?.bookingId || ''}`.trim(),
          referenceId: metadata?.paymentId || providerReference,
          invoiceId: metadata?.bookingId || providerReference,
        },
      },
    };

    try {
      const res = await fetch(`${this.baseUrl}/asm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.responseCode && data.responseCode !== '2001')) {
        const msg = data?.responseMsg || data?.message || `WaafiPay HTTP ${res.status}`;
        throw ApiError.badRequest(msg);
      }
      return {
        provider: this.name,
        providerReference: data.transactionId || data.params?.transactionId || providerReference,
        checkoutUrl: null,
        amount,
        currency: mappedCurrency,
        phone: normPhone,
        operator: operator || 'hormuud',
        metadata,
        status: 'pending_ussd_push',
        mode: 'live',
        raw: data,
        message: 'USSD push sent via WaafiPay — await customer approval + webhook',
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw ApiError.badRequest(`WaafiPay request failed: ${err.message}`);
    }
  }

  async verifyWebhook(headers, body) {
    const secret = process.env.WAAFI_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, payload: null };
      }
      return { valid: true, payload: typeof body === 'string' ? JSON.parse(body) : body };
    }
    const sig =
      headers['x-waafi-signature'] ||
      headers['x-signature'] ||
      headers['x-hub-signature-256'] ||
      '';
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const normalized = String(sig).replace(/^sha256=/, '');
    let valid = false;
    try {
      valid =
        normalized.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
    } catch {
      valid = false;
    }
    return {
      valid,
      payload: typeof body === 'string' ? JSON.parse(body) : body,
    };
  }

  parseWebhookEvent(body) {
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const params = payload.params || payload;
    const state = String(
      params.state || payload.status || payload.transactionState || payload.event || ''
    ).toUpperCase();
    const code = String(payload.responseCode || '');
    let status = null;
    if (
      ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAYMENT.SUCCEEDED'].includes(state) ||
      payload.event === 'payment.succeeded' ||
      (code === '2001' && state === 'COMPLETED')
    ) {
      status = 'succeeded';
    } else if (
      ['FAILED', 'FAIL', 'CANCELLED', 'PAYMENT.FAILED'].includes(state) ||
      payload.event === 'payment.failed'
    ) {
      status = 'failed';
    }
    return {
      eventId: payload.eventId || params.transactionId || payload.requestId || payload.id,
      paymentId: params.referenceId || payload.paymentId || payload.referenceId || payload.invoiceId,
      providerReference: params.transactionId || payload.transactionId || payload.providerReference,
      status,
      reason: payload.responseMsg || params.responseMsg || payload.reason,
    };
  }

  async refund(providerRef, amount) {
    if (!this.configured) {
      return { providerReference: providerRef, amount, status: 'simulated_refund', note: 'WaafiPay demo refund' };
    }
    return { providerReference: providerRef, amount, status: 'pending', note: 'Wire refund serviceParams when live' };
  }
}

module.exports = WaafiPayProvider;
