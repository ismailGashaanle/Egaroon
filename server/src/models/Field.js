const mongoose = require('mongoose');
const { FIELD_TYPES, capacityForType } = require('../constants/fieldFormats');

const PRICING_MODES = ['per_player', 'fixed'];

const fieldSchema = new mongoose.Schema(
  {
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: FIELD_TYPES, required: true },
    /** Players per side — always derived from type (5v5→5 … 11v11→11) */
    capacity: { type: Number, required: true, min: 5, max: 11 },
    images: [{ type: String }],
    pricingMode: { type: String, enum: PRICING_MODES, required: true, default: 'per_player' },
    pricePerPlayer: { type: Number, min: 0 },
    fixedPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' },
    openingTime: { type: String },
    closingTime: { type: String },
    slotDurationMinutes: { type: Number, default: 60 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    /**
     * Owner ops: online/offline for public booking on this field only.
     * Parallel to stadium isOnline — does not replace AvailabilityBlock.
     */
    isOnline: { type: Boolean, default: true, index: true },
    offlineFrom: { type: Date },
    offlineUntil: { type: Date },
    offlineReason: { type: String, trim: true },
  },
  { timestamps: true }
);

fieldSchema.pre('validate', function syncCapacityAndPricing() {
  if (this.type) {
    const expected = capacityForType(this.type);
    if (expected) this.capacity = expected;
  }
  if (this.pricingMode === 'per_player' && (this.pricePerPlayer === undefined || this.pricePerPlayer === null)) {
    throw new Error('pricePerPlayer is required when pricingMode is per_player');
  }
  if (this.pricingMode === 'fixed' && (this.fixedPrice === undefined || this.fixedPrice === null)) {
    throw new Error('fixedPrice is required when pricingMode is fixed');
  }
});

module.exports = mongoose.model('Field', fieldSchema);
module.exports.FIELD_TYPES = FIELD_TYPES;
module.exports.PRICING_MODES = PRICING_MODES;
