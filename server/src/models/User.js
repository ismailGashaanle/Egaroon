const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALL_ROLES, ROLES } = require('../constants/roles');
const { verificationStatusOf } = require('../utils/ownerVerification');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
    },
    /** Optional for Google OAuth accounts until they set a password. */
    passwordHash: { type: String, select: false },
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    /** `local` = email/password; `google` = OAuth. Accounts may have both. */
    authProviders: {
      type: [String],
      default: () => ['local'],
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.TEAM_CAPTAIN,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    /** Soft-delete timestamp — excluded from lists; cannot authenticate. */
    deletedAt: { type: Date, default: null, index: true },
    // Bumped whenever we want to invalidate all existing refresh tokens
    // (e.g. password change, forced logout, suspension).
    tokenVersion: { type: Number, default: 0 },
    /** Set when Super Admin provisions a temporary password; cleared after change. */
    mustChangePassword: { type: Boolean, default: false },
    /** Stadium owner who signed up on their own (not onboarded by a Super Admin) — restricted until verified. */
    selfRegistered: { type: Boolean, default: false },
    avatarUrl: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    city: { type: String, trim: true, index: true },
    region: { type: String, trim: true, index: true },
    area: { type: String, trim: true },
    latLng: {
      lat: { type: Number },
      lng: { type: Number },
    },
    lastLoginAt: { type: Date },
    /**
     * Wallet credit (USD) for Team A when opponent window releases with credit policy.
     * Usable toward a future booking (MVP ledger; apply at payment initiate later).
     */
    walletCreditUsd: { type: Number, min: 0, default: 0 },
    walletLedger: [
      {
        amount: { type: Number, required: true },
        reason: { type: String },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    /**
     * Stadium Owner KYC & Identity Verification (National ID / Business License)
     */
    kyc: {
      idType: {
        type: String,
        enum: ['national_id', 'business_license', 'passport'],
        default: 'national_id',
      },
      idNumber: { type: String, trim: true },
      businessName: { type: String, trim: true },
      documentUrl: { type: String, trim: true },
      documentKey: { type: String, trim: true },
      status: {
        type: String,
        enum: ['unsubmitted', 'pending', 'verified', 'rejected'],
        default: 'unsubmitted',
      },
      submittedAt: { type: Date },
      verifiedAt: { type: Date },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectionReason: { type: String, trim: true },
    },
    /**
     * Stadium Owner Registered Payout Account (Telesom Zaad or Somtel eDahab)
     */
    payoutAccount: {
      operator: {
        type: String,
        enum: ['telesom', 'somtel', 'hormuud', 'golis'],
        default: 'telesom',
      },
      accountNumber: { type: String, trim: true },
      accountName: { type: String, trim: true },
      isVerified: { type: Boolean, default: false },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  // bcrypt throws "Illegal arguments: string, undefined" if hash is missing
  if (!this.passwordHash || typeof this.passwordHash !== 'string') {
    return false;
  }
  if (candidate == null || candidate === '') {
    return false;
  }
  return bcrypt.compare(String(candidate), this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    status: this.status,
    deletedAt: this.deletedAt || null,
    mustChangePassword: Boolean(this.mustChangePassword),
    avatarUrl: this.avatarUrl,
    isEmailVerified: this.isEmailVerified,
    isPhoneVerified: this.isPhoneVerified,
    city: this.city,
    region: this.region,
    area: this.area,
    latLng: this.latLng,
    walletCreditUsd: Number(this.walletCreditUsd || 0),
    kyc: this.kyc || { status: 'unsubmitted' },
    selfRegistered: Boolean(this.selfRegistered),
    verificationStatus: verificationStatusOf(this),
    payoutAccount: this.payoutAccount || {},
    authProviders: Array.isArray(this.authProviders) && this.authProviders.length
      ? this.authProviders
      : ['local'],
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
