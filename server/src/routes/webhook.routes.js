const express = require('express');
const ctrl = require('../controllers/payment.controller');

const router = express.Router();

/**
 * Provider webhooks (docs/11-api-contract.md):
 *   POST /api/webhooks/payments/waafipay
 *   POST /api/webhooks/payments/dahabpay
 *   POST /api/webhooks/payments/mock
 *
 * Register these URLs with Waafi / eDahab dashboards.
 * Signature verified via adapter + WAAFI_WEBHOOK_SECRET / EDAHAB_WEBHOOK_SECRET.
 */
router.post('/payments/:provider', ctrl.providerWebhook);

module.exports = router;
