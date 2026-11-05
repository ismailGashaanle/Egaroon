const mongoose = require('mongoose');
const { AGREEMENT_STATUS, REVENUE_MODELS, SUBSCRIPTION_SCOPE } = require('../constants/revenue');

const revenueRuleSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      enum: Object.values(REVENUE_MODELS),
      required: true,
    },
    bookingFeeEnabled: { type: Boolean, default: true },
    bookingFeeAmount: { type: Number, min: 0, default: 1000 },
    bookingFeeCurrency: { type: String, default: 'SLL', trim: true },
    bookingFeePayer: {
      type: String,
      enum: ['each_team', 'team_a_only', 'split'],
      default: 'each_team',
    },
    subscriptionEnabled: { type: Boolean, default: true },
    subscriptionAmount: { type: Number, min: 0, default: 7 },
    subscriptionCurrency: { type: String, default: 'USD', trim: true },
    subscriptionScope: {
      type: String,
      enum: Object.values(SUBSCRIPTION_SCOPE),
      default: SUBSCRIPTION_SCOPE.STADIUM,
    },
    subscriptionInterval: {
      type: String,
      enum: ['monthly'],
      default: 'monthly',
    },
    commissionEnabled: { type: Boolean, default: false },
    commissionPercent: { type: Number, min: 0, max: 50, default: 3 },
    commissionTakenFrom: {
      type: String,
      enum: ['stadium_rent'],
      default: 'stadium_rent',
    },
    sllPerUsd: { type: Number, min: 1, default: 8000 },
  },
  { _id: false }
);

const stadiumAgreementSchema = new mongoose.Schema(
  {
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', required: true, index: true },
    version: { type: Number, required: true, min: 1, default: 1 },
    status: {
      type: String,
      enum: Object.values(AGREEMENT_STATUS),
      default: AGREEMENT_STATUS.DRAFT,
      index: true,
    },
    rules: { type: revenueRuleSchema, required: true },
    notes: { type: String, trim: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectReason: { type: String, trim: true },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'StadiumAgreement' },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'StadiumAgreement' },
    policySnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

stadiumAgreementSchema.index({ stadium: 1, version: -1 });
stadiumAgreementSchema.index({ stadium: 1, status: 1, effectiveFrom: -1 });

module.exports = mongoose.model('StadiumAgreement', stadiumAgreementSchema);
