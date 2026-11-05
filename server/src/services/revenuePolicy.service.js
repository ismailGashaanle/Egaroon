const ApiError = require('../utils/ApiError');
const {
  REVENUE_MODELS,
  REVENUE_POLICY_MODES,
  SUBSCRIPTION_SCOPE,
  DEFAULT_SLL_PER_USD,
} = require('../constants/revenue');
const { getBusiness } = require('./platformSettings.service');

function moneyRound(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function policyFromBusiness(biz = getBusiness()) {
  const mode = biz.revenueModelMode || REVENUE_POLICY_MODES.FLEXIBLE;
  return {
    revenueModelMode: mode,
    bookingFeeEnabled: biz.bookingFeeEnabled !== false,
    bookingFeeAmount: Number(biz.bookingFeeAmount ?? 1000),
    bookingFeeCurrency: biz.bookingFeeCurrency || 'SLL',
    bookingFeePayer: biz.bookingFeePayer || 'each_team',
    stadiumSubscriptionEnabled: biz.stadiumSubscriptionEnabled !== false,
    stadiumSubscriptionAmount: Number(biz.stadiumSubscriptionAmount ?? 7),
    stadiumSubscriptionCurrency: biz.stadiumSubscriptionCurrency || 'USD',
    subscriptionScope: biz.subscriptionScope || SUBSCRIPTION_SCOPE.STADIUM,
    fieldSubscriptionEnabled: Boolean(biz.fieldSubscriptionEnabled),
    fieldSubscriptionAmount: Number(biz.fieldSubscriptionAmount ?? 7),
    fieldSubscriptionCurrency: biz.fieldSubscriptionCurrency || 'USD',
    commissionEnabled: Boolean(biz.commissionEnabled),
    platformCommissionPercent: Number(biz.platformCommissionPercent ?? 4),
    allowCombineBookingFeeAndCommission: Boolean(biz.allowCombineBookingFeeAndCommission),
    requireStadiumAgreement: Boolean(biz.requireStadiumAgreement),
    sllPerUsd: Number(biz.sllPerUsd || DEFAULT_SLL_PER_USD),
    policyEffectiveAt: biz.policyEffectiveAt || null,
  };
}

function allowedModels(policy = policyFromBusiness()) {
  const models = [];
  const feeOn = Boolean(policy.bookingFeeEnabled) || Boolean(policy.stadiumSubscriptionEnabled);
  const commOn = Boolean(policy.commissionEnabled);
  if (policy.revenueModelMode === REVENUE_POLICY_MODES.COMMISSION) {
    if (commOn) models.push(REVENUE_MODELS.COMMISSION);
    return models;
  }
  if (policy.revenueModelMode === REVENUE_POLICY_MODES.BOOKING_FEE_SUBSCRIPTION) {
    if (feeOn) models.push(REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION);
    return models;
  }
  if (feeOn) models.push(REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION);
  if (commOn) models.push(REVENUE_MODELS.COMMISSION);
  if (policy.allowCombineBookingFeeAndCommission && feeOn && commOn) {
    models.push(REVENUE_MODELS.COMBINED);
  }
  return models;
}

function defaultModel(policy = policyFromBusiness()) {
  const allowed = allowedModels(policy);
  if (policy.revenueModelMode === REVENUE_POLICY_MODES.COMMISSION) {
    return REVENUE_MODELS.COMMISSION;
  }
  if (allowed.includes(REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION)) {
    return REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION;
  }
  return allowed[0] || REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION;
}

function rulesFromPolicy(policy = policyFromBusiness(), model) {
  const chosen = model || defaultModel(policy);
  const combined = chosen === REVENUE_MODELS.COMBINED;
  const commissionOnly = chosen === REVENUE_MODELS.COMMISSION;
  const feeModel = chosen === REVENUE_MODELS.BOOKING_FEE_SUBSCRIPTION || combined;

  if (!policy.allowCombineBookingFeeAndCommission && combined) {
    throw ApiError.badRequest('Combined booking fee + commission is not allowed by platform policy');
  }

  return {
    model: chosen,
    bookingFeeEnabled: feeModel ? Boolean(policy.bookingFeeEnabled) : false,
    bookingFeeAmount: Number(policy.bookingFeeAmount ?? 1000),
    bookingFeeCurrency: policy.bookingFeeCurrency || 'SLL',
    bookingFeePayer: policy.bookingFeePayer || 'each_team',
    subscriptionEnabled: feeModel ? Boolean(policy.stadiumSubscriptionEnabled) : false,
    subscriptionAmount: Number(policy.stadiumSubscriptionAmount ?? 7),
    subscriptionCurrency: policy.stadiumSubscriptionCurrency || 'USD',
    subscriptionScope: policy.subscriptionScope || SUBSCRIPTION_SCOPE.STADIUM,
    subscriptionInterval: 'monthly',
    commissionEnabled: commissionOnly || combined ? Boolean(policy.commissionEnabled) : false,
    commissionPercent: Number(policy.platformCommissionPercent ?? 4),
    commissionTakenFrom: 'stadium_rent',
    sllPerUsd: Number(policy.sllPerUsd || DEFAULT_SLL_PER_USD),
  };
}

function validateRulesAgainstPolicy(rules, policy = policyFromBusiness()) {
  const allowed = allowedModels(policy);
  if (!allowed.includes(rules.model)) {
    throw ApiError.badRequest(
      `Revenue model ${rules.model} is not enabled in platform policy. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }
  if (
    rules.bookingFeeEnabled &&
    rules.commissionEnabled &&
    !policy.allowCombineBookingFeeAndCommission
  ) {
    throw ApiError.badRequest(
      'Cannot charge booking fee and commission together unless Super Admin enables combined policy'
    );
  }
  return true;
}

function toUsd(amount, currency, sllPerUsd = DEFAULT_SLL_PER_USD) {
  const n = Number(amount || 0);
  const cur = String(currency || 'USD').toUpperCase();
  if (cur === 'USD') return moneyRound(n);
  if (cur === 'SLL' || cur === 'SLSH') {
    const rate = Number(sllPerUsd) > 0 ? Number(sllPerUsd) : DEFAULT_SLL_PER_USD;
    return moneyRound(n / rate);
  }
  return moneyRound(n);
}

function policyPreview(policy = policyFromBusiness()) {
  const rules = rulesFromPolicy(policy);
  const feeUsd = rules.bookingFeeEnabled
    ? toUsd(rules.bookingFeeAmount, rules.bookingFeeCurrency, rules.sllPerUsd)
    : 0;
  return {
    mode: policy.revenueModelMode,
    allowedModels: allowedModels(policy),
    defaultModel: defaultModel(policy),
    bookingFee: rules.bookingFeeEnabled
      ? `${rules.bookingFeeAmount} ${rules.bookingFeeCurrency} per team (~$${feeUsd.toFixed(2)})`
      : 'off',
    subscription: rules.subscriptionEnabled
      ? `$${Number(rules.subscriptionAmount).toFixed(2)} / ${rules.subscriptionScope} / month`
      : 'off',
    commission: rules.commissionEnabled ? `${rules.commissionPercent}% of stadium rent` : 'off',
    note: policy.allowCombineBookingFeeAndCommission
      ? 'Combined fee + commission is allowed when a stadium agreement selects it.'
      : 'Booking fee and commission are not charged together unless a combined policy is enabled.',
    rules,
  };
}

module.exports = {
  moneyRound,
  policyFromBusiness,
  allowedModels,
  defaultModel,
  rulesFromPolicy,
  validateRulesAgainstPolicy,
  toUsd,
  policyPreview,
};
