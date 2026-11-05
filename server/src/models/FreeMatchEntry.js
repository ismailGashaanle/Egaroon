const mongoose = require('mongoose');

/**
 * One entry per user per campaign. Winners get a single-use voucher code.
 */
const freeMatchEntrySchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FreeMatchCampaign',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    won: { type: Boolean, default: false, index: true },
    voucherCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
    },
    voucherStatus: {
      type: String,
      enum: ['none', 'issued', 'redeemed', 'expired'],
      default: 'none',
      index: true,
    },
    usedAt: { type: Date },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    enteredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

freeMatchEntrySchema.index({ campaign: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('FreeMatchEntry', freeMatchEntrySchema);
