const mongoose = require('mongoose');

const bookingChangeRequestSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['reschedule', 'cancellation'],
      default: 'reschedule',
      index: true,
    },
    requestedBy: {
      type: String,
      enum: ['captain', 'owner', 'manager'],
      required: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Current slot details (venue UTC)
    currentSlot: {
      field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
    },
    // Proposed new slot details (venue UTC)
    proposedSlot: {
      field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // Snapshot of stadium policy when request was initiated
    policySnapshot: {
      freeRescheduleWindowHours: { type: Number, default: 24 },
      rescheduleFee: { type: Number, default: 0 },
      rescheduleFeeCurrency: { type: String, default: 'USD' },
      minRescheduleNoticeHours: { type: Number, default: 6 },
      cancelRefundPercent: { type: Number, default: 100 },
    },
    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceDifference: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    responseNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    respondedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

bookingChangeRequestSchema.index({ booking: 1, status: 1 });
bookingChangeRequestSchema.index({ stadium: 1, status: 1 });

module.exports = mongoose.model('BookingChangeRequest', bookingChangeRequestSchema);
