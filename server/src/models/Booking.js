const mongoose = require('mongoose');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');

// One side of the match (Team A or Team B) and its payment state.
const bookingPartySchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    playersCount: { type: Number, required: true, min: 1 },
    amountDue: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    invitedAt: { type: Date },
    paymentDeadline: { type: Date },
    checkedInAt: { type: Date },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true, index: true },
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', required: true, index: true },

    // Stored as a UTC start/end instant, derived from date + local slot times,
    // so overlap queries and the uniqueness index are unambiguous.
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.HELD,
      required: true,
      index: true,
    },

    pricing: {
      mode: { type: String, enum: ['per_player', 'fixed'], required: true },
      unitPrice: { type: Number, required: true }, // pricePerPlayer or fixedPrice snapshot at booking time
      totalPrice: { type: Number, required: true },
      teamShare: { type: Number }, // one team's half after discount
      /** Pre-discount match total (same as totalPrice when no discount). */
      baseTotalPrice: { type: Number },
      discountAmount: { type: Number, default: 0 },
      /** Snapshot of percentOff when discount was %-based (null for fixed $ off). */
      discountPercent: { type: Number },
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      discountName: { type: String },
      currency: { type: String, default: 'USD' },
      /** Rent only — never includes E-Garoon booking fee. */
      stadiumRentTotal: { type: Number },
      /** Team share of rent + booking fee (what the captain pays). */
      payableTeamShare: { type: Number },
      /** Full match rent + both teams' booking fees. */
      payableFullMatch: { type: Number },
      /** E-Garoon service fee for one team (USD). */
      platformFee: { type: Number },
      /** E-Garoon service fee for both teams (USD). */
      platformFeeFullMatch: { type: Number },
      /** Daily exchange rate snapshot (SLL per 1 USD). */
      sllPerUsd: { type: Number, default: 8500 },
    },

    // Team A paid the full match amount (both shares) — Team B need not pay
    coveredFullMatch: { type: Boolean, default: false },

    teamA: { type: bookingPartySchema, required: true },
    teamB: { type: bookingPartySchema }, // absent until invited

    isRecurring: { type: Boolean, default: false },
    recurringRule: {
      frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'] },
      until: { type: Date },
    },

    holdExpiresAt: { type: Date }, // only relevant while status === HELD/PAYMENT_PENDING

    /** When Team A share (or full match) payment was verified HELD. */
    teamAPaidAt: { type: Date },
    /**
     * Team B must pay by this time (set when Team B is invited after Team A paid).
     * Clearest rule (BR-005): clock starts at Team B invite, duration = teamBPaymentDeadlineMinutes.
     */
    teamBPaymentDueAt: { type: Date },
    /** Idempotency: when partial-payment timeout was processed (release + refund). */
    partialPaymentTimeoutAt: { type: Date },

    commissionPercent: { type: Number },
    commissionAmount: { type: Number },
    ownerPayoutAmount: { type: Number },
    settledAt: { type: Date },

    /**
     * Frozen revenue rules at hold/confirm time. Later Super Admin policy or
     * agreement versions must not rewrite this booking's money split.
     */
    financialSnapshot: { type: mongoose.Schema.Types.Mixed },

    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String },

    // Gate / match pass — unique short code embedded in QR (valid until endTime)
    bookingCode: { type: String, unique: true, sparse: true, index: true },

    /**
     * Opponent Match Code (Team A split pay) — share with Team B to join & pay.
     * Format SG-XXXX-XXXX. Separate from bookingCode (KUL-…) used for gate QR.
     */
    matchCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true },

    /**
     * Anti-scam: phone used when Team A paid (normalized 252…).
     * Team B must enter this with Match Code to preview/join.
     */
    teamAPayerPhone: { type: String, trim: true, index: true },

    /**
     * Optional lock: expected Team B captain phone (normalized 252…).
     * When set, joiner account phone must match.
     */
    invitePhone: { type: String, trim: true, index: true },

    /**
     * Demand-based Team B payment window (after Team A split pay).
     * Replaces hard cancel at priority end — see opponentWindow.service.
     */
    opponentWindow: {
      phase: {
        type: String,
        enum: ['PRIORITY', 'GRACE', 'FINAL_GRACE', 'CLOSED'],
        default: undefined,
      },
      priorityEndsAt: { type: Date },
      graceExtensionsUsed: { type: Number, default: 0 },
      finalGraceEndsAt: { type: Date },
      /** Escalating competing Book attempts notified to Team B / open invite. */
      competingAttemptCount: { type: Number, default: 0 },
      lastDemandEvalAt: { type: Date },
      lastExtensionAt: { type: Date },
      lastAlertLevel: { type: Number, default: 0 },
    },

    /**
     * Team A funds disposition when opponent window releases the slot.
     * CREDIT → amount added to captain walletCreditUsd; REFUNDED → provider refund.
     */
    teamACredit: {
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'CREDITED', 'REFUNDED'],
        default: 'NONE',
      },
      amount: { type: Number, min: 0, default: 0 },
      reason: { type: String },
      settledAt: { type: Date },
    },

    gateCheckedInAt: { type: Date },
    gateCheckedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /**
     * Owner/manager operational acceptance (manual mode).
     * Slot is CONFIRMED once both paid; this only tracks stadium staff Accept.
     */
    needsOwnerAccept: { type: Boolean, default: false, index: true },
    ownerAcceptedAt: { type: Date },
    ownerAcceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, settledAt: 1 });
bookingSchema.index({ status: 1, startTime: 1 });

// Prevent double-booking the same field/time while a booking is "live"
// (not expired/cancelled). This is the last line of defense after the
// Redis lock — the database is the source of truth.
bookingSchema.index(
  { field: 1, startTime: 1, endTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          BOOKING_STATUS.HELD,
          BOOKING_STATUS.PAYMENT_PENDING,
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.CHECKED_IN,
          BOOKING_STATUS.IN_PROGRESS,
          BOOKING_STATUS.COMPLETED,
        ],
      },
    },
  }
);

bookingSchema.index({ stadium: 1, startTime: -1, status: 1 });
bookingSchema.index({ stadium: 1, needsOwnerAccept: 1, startTime: 1 });
bookingSchema.index({ stadium: 1, status: 1, settledAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
