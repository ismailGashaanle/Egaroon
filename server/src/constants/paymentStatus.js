// Payment status is tracked separately from booking status, per-payer.
const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  HELD: 'HELD', // in escrow, awaiting match settlement
  SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  SETTLED: 'SETTLED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
};

module.exports = { PAYMENT_STATUS };
