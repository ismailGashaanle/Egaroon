const mongoose = require('mongoose');

/**
 * Super Admin free-match gift campaign (instant lottery on captain enter).
 * city/region null = platform-wide. Prize = one full-match voucher (100% off once).
 */
const freeMatchCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** null / empty = any city */
    city: { type: String, trim: true, default: null, index: true },
    /** null / empty = any region */
    region: { type: String, trim: true, default: null, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    maxWinners: { type: Number, required: true, min: 1, max: 10000 },
    /** Atomic counter of issued vouchers */
    winnersCount: { type: Number, default: 0, min: 0 },
    /**
     * Chance to win on each eligible enter (0–100).
     * Still capped by remaining maxWinners slots (crypto.randomInt).
     */
    winRatePercent: { type: Number, default: 10, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['draft', 'active', 'ended'],
      default: 'active',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

freeMatchCampaignSchema.index({ status: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('FreeMatchCampaign', freeMatchCampaignSchema);
