const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: [
        'booking_escrow_credit',   // Customer paid E-Garoon Master Account -> held
        'escrow_released',         // Match check-in / played -> moved to available
        'withdrawal_locked',       // Owner requested payout -> moved to processing
        'withdrawal_disbursed',    // Department of Finance sent money -> withdrawn
        'withdrawal_refunded',     // Payout rejected -> returned to available
        'booking_refund_deduction',// Match cancelled / refunded -> deducted from held
        'subscription_deduction',  // Field subscription deducted from wallet
        'joogto_monthly_credit',   // Permanent team monthly fee received
        'adjustment',              // Manual finance adjustment
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    /** Balance category affected */
    targetBalance: {
      type: String,
      enum: ['held', 'available', 'processing', 'withdrawn'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['credit', 'debit', 'transfer'],
      required: true,
    },
    status: {
      type: String,
      enum: ['held', 'processing', 'completed', 'cancelled', 'refunded'],
      default: 'completed',
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    /** Source customer payment — with `type` forms the idempotency key for escrow credits */
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    withdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WithdrawalRequest',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    referenceCode: {
      type: String,
      trim: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ stadium: 1, createdAt: -1 });
walletTransactionSchema.index({ owner: 1, createdAt: -1 });
// One escrow credit / refund deduction per payment, even if a webhook or retry fires twice.
walletTransactionSchema.index(
  { payment: 1, type: 1 },
  { unique: true, partialFilterExpression: { payment: { $type: 'objectId' } } }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
