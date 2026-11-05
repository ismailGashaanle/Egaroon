const mongoose = require('mongoose');

/**
 * One calendar-month subscription for a stadium (not a field).
 * Super Admin marks paid/waived until billing automation ships.
 */
const stadiumSubscriptionPeriodSchema = new mongoose.Schema(
  {
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', required: true, index: true },
    year: { type: Number, required: true, min: 2020, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    fieldsCount: { type: Number, default: 1 },
    ratePerField: { type: Number, default: 7 },
    payMethod: {
      type: String,
      enum: ['manual', 'auto_deduct', 'mobile_money', 'admin_approved', 'waived'],
      default: 'manual',
    },
    payCurrency: { type: String, default: 'USD' },
    paidAmountUsd: { type: Number, default: 0 },
    paidAmountSll: { type: Number, default: 0 },
    paymentReference: { type: String, trim: true },
    approvalStatus: {
      type: String,
      enum: ['none', 'pending_approval', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    approvalSubmittedAt: { type: Date },
    approvalNotes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['owed', 'partial', 'paid', 'waived'],
      default: 'owed',
      index: true,
    },
    paidAt: { type: Date },
    notes: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'StadiumAgreement' },
  },
  { timestamps: true }
);

stadiumSubscriptionPeriodSchema.index({ stadium: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('StadiumSubscriptionPeriod', stadiumSubscriptionPeriodSchema);
