const mongoose = require('mongoose');

/**
 * One calendar-month subscription obligation (or payment) for a field.
 * Generated/merged by profit reports from PlatformSettings policy;
 * Super Admin can mark periods paid/waived (manual collection for MVP).
 */
const fieldSubscriptionPeriodSchema = new mongoose.Schema(
  {
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true, index: true },
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', required: true, index: true },
    year: { type: Number, required: true, min: 2020, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['owed', 'partial', 'paid', 'waived'],
      default: 'owed',
      index: true,
    },
    paidAt: { type: Date },
    notes: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

fieldSubscriptionPeriodSchema.index({ field: 1, year: 1, month: 1 }, { unique: true });
fieldSubscriptionPeriodSchema.index({ stadium: 1, year: 1, month: 1 });

module.exports = mongoose.model('FieldSubscriptionPeriod', fieldSubscriptionPeriodSchema);
