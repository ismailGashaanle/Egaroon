/**
 * Live check of the SifaloPay integration against Sifalo's STAGING gateway (no real money).
 *
 *   npm run check:sifalo
 *
 * Uses SIFALO_API_USER / SIFALO_API_KEY from .env (must be staging/sandbox keys) and Sifalo's
 * documented test wallets: https://developer.sifalopay.com/docs/sandbox
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
process.env.SIFALO_API_BASE_URL = 'https://spay-api.sifalo.net/gateway';

const assert = require('assert');
const SifaloPayProvider = require('../src/providers/payment/SifaloPayProvider');

const provider = new SifaloPayProvider();
const run = Date.now();

async function charge(account, operator, label) {
  try {
    const intent = await provider.initiate({
      amount: 1,
      currency: 'USD',
      phone: account,
      operator,
      metadata: { paymentId: `CHK-${label}-${run}` },
    });
    return { intent };
  } catch (err) {
    return { err };
  }
}

async function main() {
  assert.ok(provider.configured, 'Set SIFALO_API_USER and SIFALO_API_KEY in server/.env');

  // 601 paid (and confirmed through verify, with order id + amount)
  const paid = await charge('0631111111', 'telesom', 'paid');
  assert.ok(paid.intent, `paid wallet should succeed: ${paid.err?.message}`);
  assert.strictEqual(paid.intent.status, 'paid');
  assert.strictEqual(paid.intent.verified.status, 'succeeded');
  assert.strictEqual(paid.intent.verified.amount, 1);
  assert.strictEqual(paid.intent.verified.orderId, `CHK-paid-${run}`);
  console.log('✓ paid (601)        sid', paid.intent.providerReference);

  // 603 pending: no money yet, verify must say pending
  const pending = await charge('0633333333', 'telesom', 'pending');
  assert.ok(pending.intent, `pending wallet should be accepted: ${pending.err?.message}`);
  assert.strictEqual(pending.intent.status, 'pending_ussd_push');
  const pv = await provider.verify({ sid: pending.intent.providerReference });
  assert.strictEqual(pv.status, 'pending');
  console.log('✓ pending (603)     sid', pending.intent.providerReference);

  // lookup by order id (used when a charge timed out and we never got the sid)
  const byOrder = await provider.verify({ orderId: `CHK-paid-${run}` });
  assert.strictEqual(byOrder.status, 'succeeded');
  console.log('✓ verify by order id');

  // 600 failed, 604 insufficient
  const failed = await charge('0632222222', 'telesom', 'failed');
  assert.ok(failed.err, 'failed wallet should be rejected');
  console.log('✓ failed (600)     ', failed.err.message);
  const poor = await charge('0634444444', 'telesom', 'poor');
  assert.strictEqual(poor.err?.code, 'INSUFFICIENT_FUNDS');
  console.log('✓ insufficient (604)', poor.err.message);

  // an unknown transaction is never "paid"
  const ghost = await provider.verify({ sid: 'NOT-A-REAL-SID' });
  assert.ok(!ghost.found && ghost.status !== 'succeeded');
  const hook = await provider.verifyWebhook({}, { sid: 'NOT-A-REAL-SID', order_id: 'x', status: 'success', code: 601 });
  assert.strictEqual(hook.valid, false);
  console.log('✓ fake webhook rejected');

  console.log('\nSifaloPay staging check OK');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exitCode = 1;
});
