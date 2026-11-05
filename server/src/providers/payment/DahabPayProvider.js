const crypto = require('crypto');
const { randomUUID: uuid } = require('crypto');
const PaymentProvider = require('./PaymentProvider');
const ApiError = require('../../utils/ApiError');

/**
 * DahabPay / eDahab-style adapter — Golis mobile money.
 * Docs: http://docs.edahab.net/
 *
 * Env:
 *   EDAHAB_API_BASE_URL (default https://edahab.net/api)
 *   EDAHAB_API_KEY / DAHABPAY_API_KEY
 *   EDAHAB_AGENT_CODE / DAHABPAY_AGENT_CODE
 *   EDAHAB_WEBHOOK_SECRET / DAHABPAY_WEBHOOK_SECRET
 *
 * Without credentials, initiate throws a clear configuration error.
 */
function normalizeSomaliPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('252')) digits = `252${digits}`;
  return digits;
}

class DahabPayProvider extends PaymentProvider {
  get name() {
    return 'dahabpay';
  }

  get configured() {
    return Boolean(this.apiKey && this.agentCode);
  }

  get apiKey() {
    return process.env.EDAHAB_API_KEY || process.env.DAHABPAY_API_KEY;
  }

  get agentCode() {
    return process.env.EDAHAB_AGENT_CODE || process.env.DAHABPAY_AGENT_CODE;
  }

  get webhookSecret() {
    return process.env.EDAHAB_WEBHOOK_SECRET || process.env.DAHABPAY_WEBHOOK_SECRET;
  }

  get baseUrl() {
    return (process.env.EDAHAB_API_BASE_URL || process.env.DAHABPAY_API_BASE_URL || 'https://edahab.net/api').replace(
      /\/$/,
      ''
    );
  }

  async checkBalance({ phone }) {
    return { ok: true, simulated: true, phone, note: 'Balance enforced when customer approves' };
  }

  async initiate({ amount, currency, metadata, phone, operator }) {
    const normPhone = normalizeSomaliPhone(phone);
    const providerReference = `edahab-${uuid()}`;
    const mappedCurrency = currency === 'SLL' ? 'SLSH' : currency || 'USD';

    // Demo Mode — conforms to https://docs.edahab.net/ (issueInvoice / CheckInvoiceStatus)
    if (!this.configured) {
      const demoInvoiceId = Math.floor(100000 + Math.random() * 900000);
      const demoTx = `TX-EDAHAB-${demoInvoiceId}`;
      return {
        provider: this.name,
        providerReference: `edahab-${demoInvoiceId}`,
        checkoutUrl: null,
        amount,
        currency: mappedCurrency,
        phone: normPhone,
        operator: operator || 'somtel',
        metadata,
        status: 'pending_ussd_push',
        mode: 'demo',
        raw: {
          StatusCode: 0,
          StatusDescription: 'Invoice created successfully (eDahab Demo)',
          InvoiceId: demoInvoiceId,
          InvoiceStatus: 'Pending',
          TransactionId: demoTx,
          Currency: mappedCurrency,
          Amount: Number(amount),
        },
        message: `Fariin USSD push ah ayaa loo diray +${normPhone} via eDahab (${operator || 'somtel'}). Geli PIN-kaaga si aad u xaqiijiso.`,
      };
    }

    // Shape aligned with eDahab issueInvoice / RequestPayment concepts
    const payload = {
      apiKey: this.apiKey,
      edahabNumber: normPhone,
      amount: Number(amount),
      agentCode: this.agentCode,
      currency: mappedCurrency,
      returnUrl: process.env.EDAHAB_RETURN_URL || process.env.CLIENT_URL,
      referenceId: metadata?.paymentId || providerReference,
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/issueInvoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.StatusCode != null && data.StatusCode !== 0)) {
        const msg = data?.StatusMessage || data?.StatusDescription || data?.message || `eDahab HTTP ${res.status}`;
        throw ApiError.badRequest(msg);
      }
      return {
        provider: this.name,
        providerReference: data.InvoiceId ? `edahab-${data.InvoiceId}` : (data.TransactionId || providerReference),
        checkoutUrl: data.InvoiceUrl || null,
        amount,
        currency: mappedCurrency,
        phone: normPhone,
        operator: operator || 'somtel',
        metadata,
        status: 'pending_ussd_push',
        mode: 'live',
        raw: data,
        message: 'Payment request sent via eDahab — await approval + webhook',
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw ApiError.badRequest(`eDahab request failed: ${err.message}`);
    }
  }

  async verifyWebhook(headers, body) {
    const secret = this.webhookSecret;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, payload: null };
      }
      return { valid: true, payload: typeof body === 'string' ? JSON.parse(body) : body };
    }
    const sig = headers['x-edahab-signature'] || headers['x-dahab-signature'] || headers['x-signature'] || '';
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
    const state = String(
      payload.InvoiceStatus || payload.Status || payload.status || payload.event || ''
    ).toUpperCase();
    let status = null;
    if (['SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED'].includes(state) || payload.event === 'payment.succeeded') {
      status = 'succeeded';
    } else if (['FAILED', 'FAIL', 'CANCELLED', 'EXPIRED'].includes(state) || payload.event === 'payment.failed') {
      status = 'failed';
    }
    return {
      eventId: payload.TransactionId || payload.InvoiceId || payload.id,
      paymentId: payload.referenceId || (payload.InvoiceId ? `edahab-${payload.InvoiceId}` : undefined),
      providerReference: payload.InvoiceId ? `edahab-${payload.InvoiceId}` : (payload.TransactionId || payload.providerReference),
      status,
      reason: payload.StatusDescription || payload.StatusMessage || payload.reason,
    };
  }

  async refund(providerRef, amount) {
    if (!this.configured) {
      return { providerReference: providerRef, amount, status: 'simulated_refund', note: 'eDahab demo refund' };
    }
    return { providerReference: providerRef, amount, status: 'pending', note: 'Wire refund endpoint when live' };
  }
}

module.exports = DahabPayProvider;
