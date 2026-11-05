const mongoose = require('mongoose');
const { PAYOUT_METHOD_VALUES } = require('../constants/payoutMethods');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EGaroonWallet',
      required: true,
      index: true,
    },
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    amountSlsh: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    exchangeRate: {
      type: Number,
      default: 8500,
    },
    payoutMethod: {
      type: String,
      enum: PAYOUT_METHOD_VALUES,
      required: true,
    },
    payoutPhone: {
      type: String,
      required: true,
      trim: true,
    },
    payoutAccountName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'pending_otp',       // Waiting for 6-digit phone OTP
        'pending_approval',  // OTP verified, queued for Department of Finance review
        'processing',        // Finance is processing payout
        'completed',         // Disbursed from E-Garoon Master Account
        'rejected',          // Rejected by Finance (funds returned to Available)
        'cancelled',         // Cancelled by owner before approval
      ],
      default: 'pending_otp',
      index: true,
    },
    otpPhone: {
      type: String,
      trim: true,
    },
    otpVerifiedAt: {
      type: Date,
    },
    /** Department of Finance approval & disbursement details */
    disbursementReference: {
      type: String,
      trim: true,
      index: true,
    },
    disbursementMasterAccount: {
      type: String,
      trim: true,
    },
    disbursedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    disbursedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ owner: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
