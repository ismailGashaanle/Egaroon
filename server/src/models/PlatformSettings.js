const mongoose = require('mongoose');

/**
 * Singleton platform config (key = "default").
 * Super Admin editable — BR-009 commission + settlement window, etc.
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    platformCommissionPercent: { type: Number, min: 0, max: 50, default: 4 },
    /**
     * Dynamic revenue policy. Super Admin toggles models without a code change.
     * Default start: booking fee + stadium subscription; commission off.
     */
    revenueModelMode: {
      type: String,
      enum: ['booking_fee_subscription', 'commission', 'flexible'],
      default: 'flexible',
    },
    bookingFeeEnabled: { type: Boolean, default: true },
    bookingFeeAmount: { type: Number, min: 0, max: 1e9, default: 1000 },
    bookingFeeCurrency: { type: String, default: 'SLL', trim: true },
    bookingFeePayer: {
      type: String,
      enum: ['each_team', 'team_a_only', 'split'],
      default: 'each_team',
    },
    sllPerUsd: { type: Number, min: 1, max: 1e7, default: 8000 },
    stadiumSubscriptionEnabled: { type: Boolean, default: true },
    stadiumSubscriptionAmount: { type: Number, min: 0, max: 10000, default: 7 },
    stadiumSubscriptionCurrency: { type: String, default: 'USD', trim: true },
    subscriptionGraceDays: { type: Number, min: 0, max: 30, default: 4 },
    subscriptionAutoLockEnabled: { type: Boolean, default: true },
    subscriptionBlockOwnerLogin: { type: Boolean, default: true },
    subscriptionAutoDeductAllowed: { type: Boolean, default: true },
    subscriptionScope: {
      type: String,
      enum: ['stadium', 'field'],
      default: 'field',
    },
    commissionEnabled: { type: Boolean, default: false },
    allowCombineBookingFeeAndCommission: { type: Boolean, default: false },
    requireStadiumAgreement: { type: Boolean, default: false },
    policyEffectiveAt: { type: Date },
    /**
     * Monthly subscription fee per active field (USD). Used when subscriptionScope=field.
     */
    fieldSubscriptionEnabled: { type: Boolean, default: false },
    fieldSubscriptionAmount: { type: Number, min: 0, max: 10000, default: 7 },
    fieldSubscriptionCurrency: { type: String, default: 'USD', trim: true },
    /**
     * Joogto (Permanent recurring matches) platform monetization & grace rules.
     */
    joogtoPlatformFeeUsd: { type: Number, min: 0, max: 1000, default: 4 },
    joogtoPlatformFeePercent: { type: Number, min: 0, max: 50, default: 3.5 },
    joogtoFeeMode: {
      type: String,
      enum: ['fixed', 'percent', 'none'],
      default: 'fixed',
    },
    joogtoGracePeriodDaysDefault: { type: Number, min: 0, max: 30, default: 3 },
    /** First captain slot hold (Team A select → pay / invite window). */
    bookingHoldMinutes: { type: Number, min: 1, max: 120, default: 10 },
    bookingHoldGraceMinutes: { type: Number, min: 0, max: 30, default: 2 },
    /**
     * Legacy alias — prefer teamBPriorityMinutes (demand-based window).
     * Kept for older clients / env; synced when either is updated.
     */
    teamBPaymentDeadlineMinutes: { type: Number, min: 2, max: 120, default: 12 },
    /**
     * After Team A split-pay: minimum priority minutes for Team B (BR-005b).
     * At end: demand check — extend or final grace — NOT hard cancel.
     */
    teamBPriorityMinutes: { type: Number, min: 2, max: 120, default: 12 },
    /** Extra minutes when no genuine demand at priority/grace end. */
    teamBGraceMinutes: { type: Number, min: 1, max: 60, default: 10 },
    /** Max no-demand extensions (e.g. 2 → 12+10+10). */
    teamBMaxGraceExtensions: { type: Number, min: 0, max: 10, default: 2 },
    /** Final countdown when competing demand appears. */
    teamBFinalGraceMinutes: { type: Number, min: 1, max: 30, default: 3 },
    /** ACTIVE SlotDemand TTL (seconds). */
    slotDemandTtlSeconds: { type: Number, min: 30, max: 900, default: 180 },
    /** Refund Team A HELD payments when Team B window times out (no credit path). */
    autoRefundTeamAOnTeamBTimeout: { type: Boolean, default: true },
    /**
     * On demand-forced release (5th competing attempt): credit wallet instead of provider refund.
     * Normal timeout still uses autoRefundTeamAOnTeamBTimeout when preferWalletCreditOnDemandRelease is false
     * for that path — demand path always credits when this is true.
     */
    preferWalletCreditOnDemandRelease: { type: Boolean, default: true },
    /** Mark booking EXPIRED so the slot is bookable again. */
    releaseSlotOnPartialPaymentTimeout: { type: Boolean, default: true },
    ownerPayoutDelayMinutes: { type: Number, min: 5, max: 60 * 24 * 7, default: 60 },
    noShowGraceMinutes: { type: Number, min: 0, max: 120, default: 15 },
    maxMatchDistanceKm: { type: Number, min: 5, max: 500, default: 30 },
    /**
     * Captain formation / lineup boards (BR-007 + BR-007a).
     * Default OFF to avoid DB writes until Super Admin enables.
     */
    lineupEnabled: { type: Boolean, default: false },
    /**
     * Free-match gift campaigns (BR-009b + BR-009c).
     * Default OFF until Super Admin enables; captains cannot enter when false.
     */
    giftEnabled: { type: Boolean, default: false },
    /**
     * Outdoor play-risk alerts for Super Admin–tracked cities (rain, storm, wind, heat).
     * Default OFF until Super Admin enables. Data from Open-Meteo (no API key).
     */
    weatherEnabled: { type: Boolean, default: false },
    /**
     * Whether stadium owners see platform commission amount / % (BR-009d).
     * Visibility only — settlement math is unchanged. Default hidden.
     */
    ownerCommissionVisible: { type: Boolean, default: false },
    /**
     * When true, public register / Google OAuth may choose stadium_owner.
     * Default OFF — owners are onboarded by Super Admin (BR-015a).
     * Self-signup always defaults to team_captain.
     */
    publicOwnerSignup: { type: Boolean, default: true },
    supportEmail: { type: String, trim: true, default: 'support@e-garoon.com' },
    supportPhone: { type: String, trim: true, default: '0610000000' },
    supportWhatsapp: { type: String, trim: true, default: '252610000000' },
    brandName: { type: String, trim: true, default: 'E-Garoon' },
    /**
     * E-Garoon Central Master Collection Accounts (Escrow Platform Accounts).
     * All customer booking payments flow into these 2 master accounts.
     */
    masterAccounts: {
      telesom: {
        operator: { type: String, default: 'telesom' },
        name: { type: String, default: 'Telesom Zaad' },
        merchantNumber: { type: String, default: '202020' },
        accountNumber: { type: String, default: '0634000000' },
        accountName: { type: String, default: 'E-Garoon Master ZAAD' },
        isActive: { type: Boolean, default: true },
      },
      somtel: {
        operator: { type: String, default: 'somtel' },
        name: { type: String, default: 'Somtel eDahab' },
        merchantNumber: { type: String, default: 'ED-7070' },
        accountNumber: { type: String, default: '0659000000' },
        accountName: { type: String, default: 'E-Garoon Master eDahab' },
        isActive: { type: Boolean, default: true },
      },
    },
    minWithdrawalUsd: { type: Number, min: 1, default: 10 },
    escrowReleaseTrigger: {
      type: String,
      enum: ['on_checkin', 'on_match_end', 'manual'],
      default: 'on_checkin',
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
