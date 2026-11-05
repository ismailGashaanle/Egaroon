const PlatformSettings = require('../models/PlatformSettings');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');

let cache = null;
let cacheLoadedAt = 0;

function defaultsFromEnv() {
  const priority = Number(env.business.teamBPriorityMinutes ?? env.business.teamBPaymentDeadlineMinutes ?? 12);
  return {
    key: 'default',
    platformCommissionPercent: env.business.platformCommissionPercent,
    revenueModelMode: 'flexible',
    bookingFeeEnabled: true,
    bookingFeeAmount: 1000,
    bookingFeeCurrency: 'SLL',
    bookingFeePayer: 'each_team',
    sllPerUsd: 8000,
    stadiumSubscriptionEnabled: true,
    stadiumSubscriptionAmount: 7,
    stadiumSubscriptionCurrency: 'USD',
    subscriptionGraceDays: 4,
    subscriptionAutoLockEnabled: true,
    subscriptionBlockOwnerLogin: true,
    subscriptionAutoDeductAllowed: true,
    subscriptionScope: 'field',
    commissionEnabled: false,
    allowCombineBookingFeeAndCommission: false,
    requireStadiumAgreement: false,
    fieldSubscriptionEnabled: false,
    fieldSubscriptionAmount: 7,
    fieldSubscriptionCurrency: 'USD',
    bookingHoldMinutes: env.business.bookingHoldMinutes,
    bookingHoldGraceMinutes: env.business.bookingHoldGraceMinutes,
    teamBPaymentDeadlineMinutes: priority,
    teamBPriorityMinutes: priority,
    teamBGraceMinutes: env.business.teamBGraceMinutes ?? 10,
    teamBMaxGraceExtensions: env.business.teamBMaxGraceExtensions ?? 2,
    teamBFinalGraceMinutes: env.business.teamBFinalGraceMinutes ?? 3,
    slotDemandTtlSeconds: env.business.slotDemandTtlSeconds ?? 180,
    autoRefundTeamAOnTeamBTimeout: env.business.autoRefundTeamAOnTeamBTimeout,
    preferWalletCreditOnDemandRelease: env.business.preferWalletCreditOnDemandRelease !== false,
    releaseSlotOnPartialPaymentTimeout: env.business.releaseSlotOnPartialPaymentTimeout,
    ownerPayoutDelayMinutes: env.business.ownerPayoutDelayMinutes,
    noShowGraceMinutes: env.business.noShowGraceMinutes,
    maxMatchDistanceKm: env.business.maxMatchDistanceKm,
    lineupEnabled: false,
    giftEnabled: false,
    weatherEnabled: false,
    ownerCommissionVisible: false,
    publicOwnerSignup: true,
    supportEmail: env.support.email,
    supportPhone: env.support.phone,
    supportWhatsapp: env.support.whatsapp,
  };
}

function toPublic(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  const priority = Number(o.teamBPriorityMinutes ?? o.teamBPaymentDeadlineMinutes ?? 12);
  return {
    platformCommissionPercent: o.platformCommissionPercent,
    revenueModelMode: o.revenueModelMode || 'flexible',
    bookingFeeEnabled: o.bookingFeeEnabled !== false,
    bookingFeeAmount: Number(o.bookingFeeAmount ?? 1000),
    bookingFeeCurrency: o.bookingFeeCurrency || 'SLL',
    bookingFeePayer: o.bookingFeePayer || 'each_team',
    sllPerUsd: Number(o.sllPerUsd ?? 8000),
    stadiumSubscriptionEnabled: o.stadiumSubscriptionEnabled !== false,
    stadiumSubscriptionAmount: Number(o.stadiumSubscriptionAmount ?? 7),
    stadiumSubscriptionCurrency: o.stadiumSubscriptionCurrency || 'USD',
    subscriptionGraceDays: Number(o.subscriptionGraceDays ?? 4),
    subscriptionAutoLockEnabled: o.subscriptionAutoLockEnabled !== false,
    subscriptionBlockOwnerLogin: o.subscriptionBlockOwnerLogin !== false,
    subscriptionAutoDeductAllowed: o.subscriptionAutoDeductAllowed !== false,
    subscriptionScope: o.subscriptionScope || 'field',
    commissionEnabled: Boolean(o.commissionEnabled),
    allowCombineBookingFeeAndCommission: Boolean(o.allowCombineBookingFeeAndCommission),
    requireStadiumAgreement: Boolean(o.requireStadiumAgreement),
    policyEffectiveAt: o.policyEffectiveAt || null,
    fieldSubscriptionEnabled: Boolean(o.fieldSubscriptionEnabled),
    fieldSubscriptionAmount: Number(o.fieldSubscriptionAmount ?? 7),
    fieldSubscriptionCurrency: o.fieldSubscriptionCurrency || 'USD',
    bookingHoldMinutes: o.bookingHoldMinutes,
    bookingHoldGraceMinutes: o.bookingHoldGraceMinutes,
    teamBPaymentDeadlineMinutes: Number(o.teamBPaymentDeadlineMinutes ?? priority),
    teamBPriorityMinutes: priority,
    teamBGraceMinutes: Number(o.teamBGraceMinutes ?? 10),
    teamBMaxGraceExtensions: Number(o.teamBMaxGraceExtensions ?? 2),
    teamBFinalGraceMinutes: Number(o.teamBFinalGraceMinutes ?? 3),
    slotDemandTtlSeconds: Number(o.slotDemandTtlSeconds ?? 180),
    autoRefundTeamAOnTeamBTimeout: o.autoRefundTeamAOnTeamBTimeout !== false,
    preferWalletCreditOnDemandRelease: o.preferWalletCreditOnDemandRelease !== false,
    releaseSlotOnPartialPaymentTimeout: o.releaseSlotOnPartialPaymentTimeout !== false,
    ownerPayoutDelayMinutes: o.ownerPayoutDelayMinutes,
    noShowGraceMinutes: o.noShowGraceMinutes,
    maxMatchDistanceKm: o.maxMatchDistanceKm,
    lineupEnabled: Boolean(o.lineupEnabled),
    giftEnabled: Boolean(o.giftEnabled),
    weatherEnabled: Boolean(o.weatherEnabled),
    ownerCommissionVisible: Boolean(o.ownerCommissionVisible),
    publicOwnerSignup: Boolean(o.publicOwnerSignup),
    supportEmail: o.supportEmail,
    supportPhone: o.supportPhone,
    supportWhatsapp: o.supportWhatsapp,
    updatedAt: o.updatedAt,
    updatedBy: o.updatedBy,
  };
}

/** Sync business rules — uses cache, falls back to env until hydrate. */
function getBusiness() {
  if (!cache) {
    const priority = Number(env.business.teamBPriorityMinutes ?? env.business.teamBPaymentDeadlineMinutes ?? 12);
    return {
      ...env.business,
      teamBPaymentDeadlineMinutes: priority,
      teamBPriorityMinutes: priority,
      teamBGraceMinutes: env.business.teamBGraceMinutes ?? 10,
      teamBMaxGraceExtensions: env.business.teamBMaxGraceExtensions ?? 2,
      teamBFinalGraceMinutes: env.business.teamBFinalGraceMinutes ?? 3,
      slotDemandTtlSeconds: env.business.slotDemandTtlSeconds ?? 180,
      preferWalletCreditOnDemandRelease: env.business.preferWalletCreditOnDemandRelease !== false,
      fieldSubscriptionEnabled: false,
      fieldSubscriptionAmount: 7,
      fieldSubscriptionCurrency: 'USD',
      revenueModelMode: 'flexible',
      bookingFeeEnabled: true,
      bookingFeeAmount: 1000,
      bookingFeeCurrency: 'SLL',
      bookingFeePayer: 'each_team',
      sllPerUsd: 8000,
      stadiumSubscriptionEnabled: true,
      stadiumSubscriptionAmount: 7,
      stadiumSubscriptionCurrency: 'USD',
      subscriptionGraceDays: 4,
      subscriptionAutoLockEnabled: true,
      subscriptionBlockOwnerLogin: true,
      subscriptionAutoDeductAllowed: true,
      subscriptionScope: 'field',
      commissionEnabled: false,
      allowCombineBookingFeeAndCommission: false,
      requireStadiumAgreement: false,
      lineupEnabled: false,
      giftEnabled: false,
      weatherEnabled: false,
      ownerCommissionVisible: false,
      publicOwnerSignup: true,
      support: { ...env.support },
    };
  }
  const priority = Number(cache.teamBPriorityMinutes ?? cache.teamBPaymentDeadlineMinutes ?? 12);
  return {
    platformCommissionPercent: cache.platformCommissionPercent,
    revenueModelMode: cache.revenueModelMode || 'flexible',
    bookingFeeEnabled: cache.bookingFeeEnabled !== false,
    bookingFeeAmount: Number(cache.bookingFeeAmount ?? 1000),
    bookingFeeCurrency: cache.bookingFeeCurrency || 'SLL',
    bookingFeePayer: cache.bookingFeePayer || 'each_team',
    sllPerUsd: Number(cache.sllPerUsd ?? 8000),
    stadiumSubscriptionEnabled: cache.stadiumSubscriptionEnabled !== false,
    stadiumSubscriptionAmount: Number(cache.stadiumSubscriptionAmount ?? 7),
    stadiumSubscriptionCurrency: cache.stadiumSubscriptionCurrency || 'USD',
    subscriptionGraceDays: Number(cache.subscriptionGraceDays ?? 4),
    subscriptionAutoLockEnabled: cache.subscriptionAutoLockEnabled !== false,
    subscriptionBlockOwnerLogin: cache.subscriptionBlockOwnerLogin !== false,
    subscriptionAutoDeductAllowed: cache.subscriptionAutoDeductAllowed !== false,
    subscriptionScope: cache.subscriptionScope || 'field',
    commissionEnabled: Boolean(cache.commissionEnabled),
    allowCombineBookingFeeAndCommission: Boolean(cache.allowCombineBookingFeeAndCommission),
    requireStadiumAgreement: Boolean(cache.requireStadiumAgreement),
    policyEffectiveAt: cache.policyEffectiveAt || null,
    fieldSubscriptionEnabled: Boolean(cache.fieldSubscriptionEnabled),
    fieldSubscriptionAmount: Number(cache.fieldSubscriptionAmount ?? 7),
    fieldSubscriptionCurrency: cache.fieldSubscriptionCurrency || 'USD',
    bookingHoldMinutes: cache.bookingHoldMinutes,
    bookingHoldGraceMinutes: cache.bookingHoldGraceMinutes,
    teamBPaymentDeadlineMinutes: Number(cache.teamBPaymentDeadlineMinutes ?? priority),
    teamBPriorityMinutes: priority,
    teamBGraceMinutes: Number(cache.teamBGraceMinutes ?? 10),
    teamBMaxGraceExtensions: Number(cache.teamBMaxGraceExtensions ?? 2),
    teamBFinalGraceMinutes: Number(cache.teamBFinalGraceMinutes ?? 3),
    slotDemandTtlSeconds: Number(cache.slotDemandTtlSeconds ?? 180),
    autoRefundTeamAOnTeamBTimeout: cache.autoRefundTeamAOnTeamBTimeout !== false,
    preferWalletCreditOnDemandRelease: cache.preferWalletCreditOnDemandRelease !== false,
    releaseSlotOnPartialPaymentTimeout: cache.releaseSlotOnPartialPaymentTimeout !== false,
    ownerPayoutDelayMinutes: cache.ownerPayoutDelayMinutes,
    noShowGraceMinutes: cache.noShowGraceMinutes,
    maxMatchDistanceKm: cache.maxMatchDistanceKm,
    lineupEnabled: Boolean(cache.lineupEnabled),
    giftEnabled: Boolean(cache.giftEnabled),
    weatherEnabled: Boolean(cache.weatherEnabled),
    ownerCommissionVisible: Boolean(cache.ownerCommissionVisible),
    publicOwnerSignup: Boolean(cache.publicOwnerSignup),
    support: {
      email: cache.supportEmail,
      phone: cache.supportPhone,
      whatsapp: cache.supportWhatsapp,
    },
  };
}

async function hydrate() {
  let doc = await PlatformSettings.findOne({ key: 'default' });
  if (!doc) {
    doc = await PlatformSettings.create(defaultsFromEnv());
  }
  cache = doc.toObject();
  cacheLoadedAt = Date.now();
  return toPublic(doc);
}

/**
 * Serverless instances each keep their own settings cache, so a change saved through one
 * instance would otherwise stay invisible to the others. Re-read at most once per `maxAgeMs`.
 */
async function refreshIfStale(maxAgeMs = 30000) {
  if (cache && Date.now() - cacheLoadedAt < maxAgeMs) return;
  await hydrate();
}

async function getSettings() {
  if (!cache) await hydrate();
  const doc = await PlatformSettings.findOne({ key: 'default' });
  const publicDoc = toPublic(doc || cache);
  try {
    const { policyPreview } = require('./revenuePolicy.service');
    publicDoc.revenuePreview = policyPreview(getBusiness());
  } catch {
    publicDoc.revenuePreview = null;
  }
  return publicDoc;
}

const EDITABLE = [
  'platformCommissionPercent',
  'revenueModelMode',
  'bookingFeeEnabled',
  'bookingFeeAmount',
  'bookingFeeCurrency',
  'bookingFeePayer',
  'sllPerUsd',
  'stadiumSubscriptionEnabled',
  'stadiumSubscriptionAmount',
  'stadiumSubscriptionCurrency',
  'subscriptionGraceDays',
  'subscriptionAutoLockEnabled',
  'subscriptionBlockOwnerLogin',
  'subscriptionAutoDeductAllowed',
  'subscriptionScope',
  'commissionEnabled',
  'allowCombineBookingFeeAndCommission',
  'requireStadiumAgreement',
  'policyEffectiveAt',
  'fieldSubscriptionEnabled',
  'fieldSubscriptionAmount',
  'fieldSubscriptionCurrency',
  'bookingHoldMinutes',
  'bookingHoldGraceMinutes',
  'teamBPaymentDeadlineMinutes',
  'teamBPriorityMinutes',
  'teamBGraceMinutes',
  'teamBMaxGraceExtensions',
  'teamBFinalGraceMinutes',
  'slotDemandTtlSeconds',
  'autoRefundTeamAOnTeamBTimeout',
  'preferWalletCreditOnDemandRelease',
  'releaseSlotOnPartialPaymentTimeout',
  'ownerPayoutDelayMinutes',
  'noShowGraceMinutes',
  'maxMatchDistanceKm',
  'lineupEnabled',
  'giftEnabled',
  'weatherEnabled',
  'ownerCommissionVisible',
  'publicOwnerSignup',
  'supportEmail',
  'supportPhone',
  'supportWhatsapp',
];

async function updateSettings(patch, userId) {
  const updates = {};
  for (const key of EDITABLE) {
    if (patch[key] !== undefined && patch[key] !== null && patch[key] !== '') {
      updates[key] = patch[key];
    }
  }
  // Booleans may be explicitly false — include when key is present
  for (const boolKey of [
    'lineupEnabled',
    'giftEnabled',
    'weatherEnabled',
    'ownerCommissionVisible',
    'publicOwnerSignup',
    'fieldSubscriptionEnabled',
    'bookingFeeEnabled',
    'stadiumSubscriptionEnabled',
    'subscriptionAutoLockEnabled',
    'subscriptionBlockOwnerLogin',
    'subscriptionAutoDeductAllowed',
    'commissionEnabled',
    'allowCombineBookingFeeAndCommission',
    'requireStadiumAgreement',
    'autoRefundTeamAOnTeamBTimeout',
    'preferWalletCreditOnDemandRelease',
    'releaseSlotOnPartialPaymentTimeout',
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, boolKey)) {
      updates[boolKey] = Boolean(patch[boolKey]);
    }
  }
  if (!Object.keys(updates).length) {
    throw ApiError.badRequest('No valid settings fields provided');
  }

  if (updates.platformCommissionPercent != null) {
    updates.platformCommissionPercent = Number(updates.platformCommissionPercent);
  }
  if (updates.fieldSubscriptionAmount != null) {
    updates.fieldSubscriptionAmount = Number(updates.fieldSubscriptionAmount);
  }
  if (updates.bookingFeeAmount != null) updates.bookingFeeAmount = Number(updates.bookingFeeAmount);
  if (updates.sllPerUsd != null) updates.sllPerUsd = Number(updates.sllPerUsd);
  if (updates.stadiumSubscriptionAmount != null) {
    updates.stadiumSubscriptionAmount = Number(updates.stadiumSubscriptionAmount);
  }
  if (updates.subscriptionGraceDays != null) {
    updates.subscriptionGraceDays = Number(updates.subscriptionGraceDays);
  }
  if (updates.policyEffectiveAt) updates.policyEffectiveAt = new Date(updates.policyEffectiveAt);
  for (const k of [
    'bookingHoldMinutes',
    'bookingHoldGraceMinutes',
    'teamBPaymentDeadlineMinutes',
    'teamBPriorityMinutes',
    'teamBGraceMinutes',
    'teamBMaxGraceExtensions',
    'teamBFinalGraceMinutes',
    'slotDemandTtlSeconds',
    'ownerPayoutDelayMinutes',
    'noShowGraceMinutes',
    'maxMatchDistanceKm',
  ]) {
    if (updates[k] != null) updates[k] = Number(updates[k]);
  }

  // Keep legacy deadline and priority in sync when either is set
  if (updates.teamBPriorityMinutes != null && updates.teamBPaymentDeadlineMinutes == null) {
    updates.teamBPaymentDeadlineMinutes = updates.teamBPriorityMinutes;
  }
  if (updates.teamBPaymentDeadlineMinutes != null && updates.teamBPriorityMinutes == null) {
    updates.teamBPriorityMinutes = updates.teamBPaymentDeadlineMinutes;
  }

  updates.updatedBy = userId;

  const before = await PlatformSettings.findOne({ key: 'default' }).lean();

  const doc = await PlatformSettings.findOneAndUpdate(
    { key: 'default' },
    { $set: updates, $setOnInsert: { key: 'default' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
  );

  cache = doc.toObject();
  try {
    const { recordAudit } = require('./auditLog.service');
    await recordAudit({
      actorId: userId,
      action: 'platform_settings.update',
      entityType: 'PlatformSettings',
      entityId: 'default',
      before: before ? toPublic(before) : null,
      after: toPublic(doc),
    });
  } catch (err) {
    console.warn('[settings] audit failed', err.message);
  }
  return toPublic(doc);
}

/**
 * Stadium owners see commission only when Super Admin enables the flag.
 * Managers never see commission (same as payout already hidden for them).
 */
function ownerCanSeeCommission(user) {
  if (!user || user.role !== ROLES.STADIUM_OWNER) return false;
  return Boolean(getBusiness().ownerCommissionVisible);
}

/** Super Admin flag — public self-signup as stadium owner. Default off. */
function isPublicOwnerSignupEnabled() {
  return Boolean(getBusiness().publicOwnerSignup);
}

/**
 * Public register / OAuth may only become captain or (when enabled) owner.
 * Admin / super_admin / manager are never self-assigned.
 */
function resolvePublicSignupRole(requested, { rejectOwnerIfDisabled = false } = {}) {
  const wantOwner = requested === ROLES.STADIUM_OWNER;
  if (wantOwner && !isPublicOwnerSignupEnabled()) {
    if (rejectOwnerIfDisabled) {
      throw ApiError.forbidden(
        'Public stadium owner signup is off. Super Admin can enable it in Platform Settings, or onboard the owner from Owner onboarding.',
        { code: 'PUBLIC_OWNER_SIGNUP_DISABLED' }
      );
    }
    return ROLES.TEAM_CAPTAIN;
  }
  if (wantOwner) return ROLES.STADIUM_OWNER;
  return ROLES.TEAM_CAPTAIN;
}

module.exports = {
  hydrate,
  refreshIfStale,
  getSettings,
  updateSettings,
  getBusiness,
  toPublic,
  ownerCanSeeCommission,
  isPublicOwnerSignupEnabled,
  resolvePublicSignupRole,
};
