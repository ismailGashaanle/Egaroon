const mongoose = require('mongoose');

/**
 * E-Garoon Stadium Owner Wallet (Escrow & Settlement Ledger).
 * Operates like Uber/Airbnb escrow:
 * - When booking is paid by customer, funds land in E-Garoon Master Accounts (Zaad / eDahab).
 * - Stadium's net rent is placed in `balanceHeld` (Escrow) until match check-in or completion.
 * - Once match is verified/played, funds move to `balanceAvailable` (Ready for withdrawal).
 * - When owner requests payout, funds move to `balanceProcessing` pending OTP & Finance approval.
 * - When Finance disburses payout from Master Account, funds move to `totalWithdrawn`.
 */
const egaroonWalletSchema = new mongoose.Schema(
  {
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Escrow balance held until match check-in or completion */
    balanceHeld: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Available funds that owner can withdraw right now */
    balanceAvailable: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Funds locked in pending withdrawal requests awaiting Department of Finance payout */
    balanceProcessing: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Total cumulative payouts disbursed to owner's Zaad/eDahab account */
    totalWithdrawn: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Lifetime total earned by this stadium */
    totalEarned: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['active', 'frozen', 'under_review'],
      default: 'active',
    },
    freezeReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

egaroonWalletSchema.index({ owner: 1, stadium: 1 });

module.exports = mongoose.model('EGaroonWallet', egaroonWalletSchema);
