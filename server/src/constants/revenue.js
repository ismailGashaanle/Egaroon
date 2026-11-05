const REVENUE_MODELS = {
  BOOKING_FEE_SUBSCRIPTION: 'booking_fee_subscription',
  COMMISSION: 'commission',
  COMBINED: 'combined',
};

const REVENUE_POLICY_MODES = {
  BOOKING_FEE_SUBSCRIPTION: 'booking_fee_subscription',
  COMMISSION: 'commission',
  FLEXIBLE: 'flexible',
};

const AGREEMENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  SUPERSEDED: 'SUPERSEDED',
};

const SUBSCRIPTION_SCOPE = {
  STADIUM: 'stadium',
  FIELD: 'field',
};

const LEDGER_TYPES = {
  BOOKING_FEE: 'booking_fee',
  COMMISSION: 'commission',
  OWNER_RENT: 'owner_rent',
  SUBSCRIPTION: 'subscription',
};

const DEFAULT_SLL_PER_USD = 8000;

module.exports = {
  REVENUE_MODELS,
  REVENUE_POLICY_MODES,
  AGREEMENT_STATUS,
  SUBSCRIPTION_SCOPE,
  LEDGER_TYPES,
  DEFAULT_SLL_PER_USD,
};
