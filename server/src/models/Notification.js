const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'TEAM_B_INVITE',
        'PAYMENT_DUE',
        'BOOKING_CONFIRMED',
        'BOOKING_HELD',
        'BOOKING_EXPIRED',
        'PAYMENT_RECEIVED',
        'AWAITING_ACCEPTANCE',
        'GATE_CHECKED_IN',
        'MATCH_STARTED',
        'PAYOUT',
        'OPPONENT_WINDOW_EXTENDED',
        'OPPONENT_DEMAND_ALERT',
        'OPPONENT_FINAL_GRACE',
        'TEAM_A_CREDIT',
        'MATCH_CODE_READY',
        'WEATHER_RISK',
        'GENERAL',
      ],
      default: 'GENERAL',
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    readAt: { type: Date },
    meta: { type: mongoose.Schema.Types.Mixed },
    /**
     * Dedupe key for idempotent alerts (e.g. gate_checked_in:<bookingId>:<userId>).
     * Unique only when set — never index null/missing (avoids E11000 on every 2nd notify).
     */
    dedupeKey: { type: String, trim: true },
  },
  { timestamps: true }
);

// Sparse unique on { user, dedupeKey } treated missing dedupeKey as null and blocked
// a second notification for the same user → gate check-in 409 "Resource already exists".
notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  {
    unique: true,
    name: 'user_1_dedupeKey_1_partial',
    partialFilterExpression: { dedupeKey: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
