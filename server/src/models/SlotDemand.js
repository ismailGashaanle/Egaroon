const mongoose = require('mongoose');

/**
 * Authentic captain intent to book a slot (Level 2+).
 * Created on createHold attempt against an occupied waiting-for-Team-B slot.
 * NOT created for mere search/view.
 */
const slotDemandSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true, index: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    /** Booking that currently holds the slot (Team A waiting for Team B). */
    targetBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CONVERTED'],
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// Idempotent: one ACTIVE demand per user+field+startTime
slotDemandSchema.index(
  { user: 1, field: 1, startTime: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  }
);

slotDemandSchema.index({ field: 1, startTime: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('SlotDemand', slotDemandSchema);
