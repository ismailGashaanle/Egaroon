const PaymentProvider = require('./PaymentProvider');
const ApiError = require('../../utils/ApiError');

/**
 * SifaloPay e-Wallet adapter — Waafi/ZAAD/EVC/SAHAL, eDahab and Premier Wallet.
 * Docs: https://developer.sifalopay.com/docs/e-wallet-api
 *
 * Env:
 *   SIFALO_API_USER      HTTP Basic user
 *   SIFALO_API_KEY       HTTP Basic password
 *   SIFALO_API_BASE_URL  live    https://api.sifalopay.com/gateway   (default)
 *                        staging https://spay-api.sifalo.net/gateway (sandbox keys, test wallets)
 *   API_PUBLIC_URL       used to build the webhook URL we hand to Sifalo
 *
 * Staging and live keys are NOT interchangeable — point the base URL at the host that
 * matches the keys you hold.
 *
 * Flow: POST /gateway/ (charge): 601 paid, 603 waiting for the customer, 604 insufficient,
 * 600 failed. Sifalo calls our webhook ONCE when the charge call finishes — a later
 * pending → paid change sends nothing — so pending payments are confirmed by polling
 * verify (see payment.service reconcile). We never trust a webhook body: everything is
 * re-checked with POST /gateway/verify.php, and the order/amount come from that answer.
 */
const CODE_PAID = '601';
const CODE_PENDING = '603';
const CODE_FAILED = ['600', '604'];
// Keep well under the serverless function limit (60s) so we can still answer the customer.
const CHARGE_TIMEOUT_MS = 50000;
const VERIFY_TIMEOUT_MS = 20000;

function normalizeSomaliPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('252')) digits = `252${digits}`;
  return digits;
}

/** telesom/hormuud → waafi (ZAAD/EVC), somtel/golis → edahab */
function gatewayFor(operator) {
  const op = String(operator || '').toLowerCase();
  if (op === 'somtel' || op === 'golis' || op === 'edahab') return 'edahab';
  if (op === 'premier' || op === 'pbwallet') return 'pbwallet';
  return 'waafi';
}

/** Sifalo calls shillings SLSH; the app calls them SLL. */
function normalizeCurrency(c) {
  const v = String(c || '').toUpperCase();
  return v === 'SLL' || v === 'SLSH' ? 'SLSH' : v || 'USD';
}

function isTimeout(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError';
}

async function postJson(url, body, { auth, timeoutMs }) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (auth) headers.Authorization = `Basic ${Buffer.from(auth).toString('base64')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

class SifaloPayProvider extends PaymentProvider {
  get name() {
    return 'sifalopay';
  }

  get configured() {
    return Boolean(process.env.SIFALO_API_USER && process.env.SIFALO_API_KEY);
  }

  get baseUrl() {
    return (process.env.SIFALO_API_BASE_URL || 'https://api.sifalopay.com/gateway').replace(/\/$/, '');
  }

  get webhookUrl() {
    const base = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
    // Sifalo requires a public HTTPS URL; skip it for local development.
    return base.startsWith('https://') ? `${base}/api/webhooks/payments/sifalopay` : undefined;
  }

  async checkBalance({ phone }) {
    return { ok: true, simulated: true, phone, note: 'Balance enforced at customer approval' };
  }

  async initiate({ amount, currency, metadata, phone, operator }) {
    if (!this.configured) {
      throw ApiError.internal('SifaloPay is not configured (set SIFALO_API_USER and SIFALO_API_KEY)');
    }

    const account = normalizeSomaliPhone(phone);
    const mappedCurrency = normalizeCurrency(currency) === 'SLSH' ? 'SLSH' : 'USD';
    const gateway = gatewayFor(operator);

    const payload = {
      account,
      gateway,
      amount: String(amount),
      currency: mappedCurrency,
      order_id: metadata?.paymentId || metadata?.bookingId,
    };
    if (this.webhookUrl) payload.webhook_url = this.webhookUrl;

    const base = {
      provider: this.name,
      checkoutUrl: null,
      amount,
      currency: mappedCurrency,
      phone: account,
      operator: operator || null,
      metadata,
      mode: this.baseUrl.includes('sifalo.net') ? 'sandbox' : 'live',
    };

    let data;
    try {
      ({ data } = await postJson(`${this.baseUrl}/`, payload, {
        auth: `${process.env.SIFALO_API_USER}:${process.env.SIFALO_API_KEY}`,
        timeoutMs: CHARGE_TIMEOUT_MS,
      }));
    } catch (err) {
      if (isTimeout(err)) {
        // The customer may still approve: keep the payment pending (found later by order_id)
        // instead of failing it and refunding nothing.
        return {
          ...base,
          providerReference: null,
          status: 'pending_ussd_push',
          unconfirmed: true,
          message: `Fariin USSD push ah ayaa loo diray +${account}. Geli PIN-kaaga si aad u xaqiijiso.`,
        };
      }
      throw ApiError.badRequest(`SifaloPay request failed: ${err.message}`);
    }

    const code = String(data.code ?? '');
    if (code === '604') {
      const err = ApiError.badRequest(data.response || 'Insufficient balance');
      err.code = 'INSUFFICIENT_FUNDS';
      throw err;
    }
    if (code === '0' || code === '') {
      // Sifalo answers code 0 when it rejects our API credentials (wrong keys, or sandbox keys on the
      // live host / live keys on the sandbox host). The customer can't fix that — tell the operator.
      console.error(
        `[sifalopay] credentials rejected by ${this.baseUrl} (code 0). ` +
          'Check SIFALO_API_USER / SIFALO_API_KEY match this host (sandbox keys need SIFALO_API_BASE_URL=https://spay-api.sifalo.net/gateway).'
      );
      throw ApiError.serviceUnavailable
        ? ApiError.serviceUnavailable('Payments are temporarily unavailable. Please try again shortly or contact support.')
        : ApiError.badRequest('Payments are temporarily unavailable. Please try again shortly or contact support.');
    }
    if (code !== CODE_PAID && code !== CODE_PENDING) {
      throw ApiError.badRequest(data.response || `SifaloPay declined the charge (code ${code || 'unknown'})`);
    }

    if (code === CODE_PAID) {
      // Never trust the charge reply alone: confirm it (and the amount) with verify.
      const v = await this.verify({ sid: data.sid }).catch(() => null);
      if (v?.status === 'succeeded') {
        return {
          ...base,
          providerReference: data.sid,
          status: 'paid',
          verified: v,
          raw: data,
          message: 'Lacagta waa la helay.',
        };
      }
    }

    return {
      ...base,
      providerReference: data.sid,
      status: 'pending_ussd_push',
      raw: data,
      message: `Fariin USSD push ah ayaa loo diray +${account}. Geli PIN-kaaga si aad u xaqiijiso.`,
    };
  }

  /**
   * Authoritative status of a charge. Look up by `sid` (preferred) or `orderId`.
   * Returns { found, status: 'succeeded'|'failed'|'pending', sid, orderId, amount, currency, raw }.
   */
  async verify({ sid, orderId }) {
    const body = sid ? { sid } : { order_id: orderId };
    const { data } = await postJson(`${this.baseUrl}/verify.php`, body, { timeoutMs: VERIFY_TIMEOUT_MS });
    const code = String(data.code ?? '');
    const found = Boolean(data.sid);

    let status = 'pending';
    if (data.status === 'success' && code === CODE_PAID) status = 'succeeded';
    else if (data.status === 'failed' || CODE_FAILED.includes(code)) status = 'failed';

    return {
      found,
      status,
      sid: data.sid || null,
      orderId: data.order_id || null,
      amount: data.amount != null ? Number(data.amount) : null,
      currency: data.currency ? normalizeCurrency(data.currency) : null,
      message: data.response || null,
      raw: data,
    };
  }

  /**
   * Sifalo documents no webhook signature, so the body is only a hint: we re-verify the
   * sid and rebuild the payload from Sifalo's own answer (order, amount, currency).
   */
  async verifyWebhook(_headers, body) {
    const payload = typeof body === 'string' ? JSON.parse(body) : body || {};
    if (!payload.sid || !this.configured) return { valid: false, payload: null };

    try {
      const v = await this.verify({ sid: payload.sid });
      if (!v.found) return { valid: false, payload: null };
      return {
        valid: true,
        payload: {
          sid: v.sid,
          order_id: v.orderId, // from Sifalo, never from the request body
          verifiedStatus: v.status, // 'succeeded' | 'failed' | 'pending'
          amount: v.amount,
          currency: v.currency,
          response: v.message,
        },
      };
    } catch {
      return { valid: false, payload: null };
    }
  }

  parseWebhookEvent(body) {
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    return {
      eventId: `sifalo-${payload.sid}-${payload.verifiedStatus}`,
      paymentId: payload.order_id || payload.sid,
      providerReference: payload.sid,
      status: payload.verifiedStatus, // pending is ignored by the service (no state change)
      amount: payload.amount,
      currency: payload.currency,
      reason: payload.response,
    };
  }

  async refund(providerRef, amount) {
    // Refund endpoint is documented on Sifalo's separate Refunds page, not wired yet.
    return { providerReference: providerRef, amount, status: 'pending', note: 'SifaloPay refund not wired — process manually' };
  }
}

module.exports = SifaloPayProvider;
module.exports.normalizeCurrency = normalizeCurrency;
