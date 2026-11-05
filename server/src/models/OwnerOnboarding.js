const mongoose = require('mongoose');
const { FIELD_TYPES } = require('../constants/fieldFormats');

const localizedStringSchema = new mongoose.Schema(
  {
    so: { type: String, trim: true, default: '' },
    en: { type: String, trim: true, default: '' },
    ar: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ONBOARDING_STATUSES = [
  'draft',
  'awaiting_signatures',
  'subscription_pending',
  'active',
  'cancelled',
];

const draftFieldSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    type: { type: String, enum: FIELD_TYPES, required: true },
    pricingMode: { type: String, enum: ['per_player', 'fixed'], default: 'per_player' },
    pricePerPlayer: { type: Number, min: 0 },
    fixedPrice: { type: Number, min: 0 },
    images: [{ type: String }],
    openingTime: { type: String, trim: true },
    closingTime: { type: String, trim: true },
    slotDurationMinutes: { type: Number, default: 60, min: 30, max: 180 },
  },
  { _id: true }
);

/**
 * Super Admin draft for registering a stadium owner + stadium + fields.
 * Credentials are provisioned only after dual signatures + subscription confirm.
 * Temporary password is never persisted — returned once on activate.
 */
const ownerOnboardingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ONBOARDING_STATUSES,
      default: 'draft',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    owner: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      avatarUrl: { type: String, trim: true, default: '' },
    },
    stadium: {
      name: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      region: { type: String, trim: true, default: '' },
      area: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      latLng: {
        lat: { type: Number },
        lng: { type: Number },
      },
      images: [{ type: String }],
      facilities: [{ type: String }],
      openingTime: { type: String, trim: true, default: '06:00' },
      closingTime: { type: String, trim: true, default: '23:00' },
    },
    fields: { type: [draftFieldSchema], default: [] },
    subscription: {
      /** Snapshot of platform fee at confirm time (or SA override). */
      amountPerField: { type: Number, min: 0 },
      currency: { type: String, default: 'USD', trim: true },
      monthsPaid: { type: Number, min: 1, max: 12, default: 1 },
      confirmedAt: { type: Date },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      notes: { type: String, trim: true, default: '' },
      /** Manual collection — SA confirms cash/transfer received. */
      collectionMethod: {
        type: String,
        enum: ['manual', 'waived', 'transfer', 'cash', 'other'],
        default: 'manual',
      },
    },
    agreement: {
      termsSnapshot: { type: localizedStringSchema, default: () => ({}) },
      privacySnapshot: { type: localizedStringSchema, default: () => ({}) },
      ownerAgreementSnapshot: { type: localizedStringSchema, default: () => ({}) },
      superAdminSignatureUrl: { type: String, trim: true, default: '' },
      ownerSignatureUrl: { type: String, trim: true, default: '' },
      superAdminSignedAt: { type: Date },
      ownerSignedAt: { type: Date },
      signedBySuperAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    provisioned: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      stadiumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium' },
      fieldIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
      activatedAt: { type: Date },
      /** When SA first saw the temporary password (never returned again). */
      credentialsRevealedAt: { type: Date },
    },
    cancelReason: { type: String, trim: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

ownerOnboardingSchema.index({ 'owner.email': 1 });
ownerOnboardingSchema.index({ 'owner.phone': 1 });
ownerOnboardingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('OwnerOnboarding', ownerOnboardingSchema);
module.exports.ONBOARDING_STATUSES = ONBOARDING_STATUSES;
