const mongoose = require('mongoose');

/**
 * Time-slot discounts — e.g. weekday mornings 20% off, or fixed $ amount.
 * Applied server-side to field base price when the slot matches.
 */
const discountSchema = new mongoose.Schema(
  {
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      index: true,
    },
    /** null / omitted = all fields at this stadium */
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', default: null },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    /** Prefer one of percentOff or amountOff (validated in service). */
    percentOff: { type: Number, min: 1, max: 100 },
    /** Fixed currency amount off the match total (same currency as field). */
    amountOff: { type: Number, min: 0 },
    /**
     * When true: ignore daysOfWeek / startTimeLocal / endTimeLocal
     * (still respects field scope + validFrom / validUntil).
     */
    applyToAllSlots: { type: Boolean, default: false },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // empty = every day
    startTimeLocal: { type: String }, // "06:00"
    endTimeLocal: { type: String }, // "12:00"
    validFrom: { type: Date },
    validUntil: { type: Date },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Discount', discountSchema);
