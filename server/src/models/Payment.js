const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /** Which side this payment covers */
    side: { type: String, enum: ['teamA', 'teamB'], index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    /** Currency chosen by captain to pay: 'USD' | 'SLL' */
    payCurrency: { type: String, default: 'USD' },
    /** Amount in USD */
    amountUsd: { type: Number, min: 0 },
    /** Amount in Somaliland Shillings (SLL) */
    amountSll: { type: Number, min: 0 },
    /** Daily exchange rate applied at payment time (SLL per 1 USD) */
    exchangeRate: { type: Number, min: 1 },
    /** Stadium rent portion (owner). Separate from platform booking fee. */
    rentAmount: { type: Number, min: 0 },
    /** E-Garoon team booking fee portion. */
    platformBookingFeeAmount: { type: Number, min: 0 },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },

    /** Adapter: mock | waafipay | dahabpay */
    provider: { type: String, default: 'mock', index: true },
    /** Mobile-money operator: hormuud | telesom | somtel | golis */
    operator: { type: String, index: true },
    /** MSISDN that receives the USSD / push (normalized 252…) */
    payerPhone: { type: String, index: true },
    msisdn: { type: String, index: true },
    /** Snapshot of captain / payer display name at initiate (sanitized) */
    payerName: { type: String, trim: true, maxlength: 80 },
    /** Optional Team B captain contact (may differ from payerPhone) */
    teamBContactPhone: { type: String },
    teamBContactName: { type: String },
    /**
     * Optional Team B invite lock requested at Team A pay time.
     * Applied after split-pay success when Match Code exists (normalized 252…).
     */
    invitePhoneTeamB: { type: String, trim: true },
    /** Whether payerPhone matched a registered user at initiate time */
    payerRegistered: { type: Boolean, default: false },

    providerReference: { type: String, index: true },
    // Prevents double-processing the same client-initiated payment attempt.
    idempotencyKey: { type: String, required: true, unique: true },

    /** Processed provider webhook event ids (idempotent webhooks) */
    processedEventIds: { type: [String], default: [] },

    /** Team A paid both shares in one payment */
    coverFullMatch: { type: Boolean, default: false },

    paidAt: { type: Date },
    refundedAt: { type: Date },
    failureReason: { type: String },

    /** Admin ops review of captain payment (correct amount / method / phone). */
    adminReviewedAt: { type: Date },
    adminReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminReviewNote: { type: String, trim: true, maxlength: 300 },
    adminReviewStatus: {
      type: String,
      enum: ['pending', 'ok', 'flagged'],
      default: 'pending',
      index: true,
    },

    // Simple ledger breakdown, computed at settlement time.
    commissionPercent: { type: Number },
    commissionAmount: { type: Number },
    netToOwner: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
