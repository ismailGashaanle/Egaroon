const mongoose = require('mongoose');

/**
 * Payment and Billing sub-schema for monthly recurring memberships.
 */
const joogtoPaymentRecordSchema = new mongoose.Schema(
  {
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['USD', 'SLSH'], default: 'USD' },
    amountSlsh: { type: Number, default: 0 },
    kulansiiyeFee: { type: Number, default: 0 },
    stadiumShare: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'bank', 'waafipay', 'edahab'],
      default: 'cash',
    },
    paidAt: { type: Date, default: Date.now },
    paidBy: { type: String, trim: true },
    reference: { type: String, trim: true },
    receiptNumber: { type: String, trim: true, index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { _id: true, timestamps: true }
);

/**
 * Attendance Scan record when the stadium manager scans the pass.
 */
const joogtoScanRecordSchema = new mongoose.Schema(
  {
    scannedAt: { type: Date, default: Date.now },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: {
      type: String,
      enum: ['allowed', 'grace_warning', 'rejected'],
      required: true,
    },
    reason: { type: String, trim: true },
  },
  { _id: true }
);

/**
 * Recurring Permanent Match (Ciyaar Joogto ah) Schema.
 * Includes Anti-Scam digital card, dynamic grace period, monthly fees,
 * manager verification QR code, and E-Garoon platform profit integration.
 */
const recurringBookingSchema = new mongoose.Schema(
  {
    // Digital Card & Identity
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    securityPin: {
      type: String,
      required: true,
      trim: true,
    },
    qrSignature: {
      type: String,
      trim: true,
    },

    // Venues & Owners
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: true,
      index: true,
    },
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Customer & Team
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName: { type: String, required: true, trim: true },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    captainName: { type: String, trim: true, default: '' },
    captainPhone: { type: String, trim: true, default: '' },

    // Schedule Rules
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      default: 'weekly',
    },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0=Sun, 1=Mon, ..., 6=Sat
    additionalDays: [{ type: Number, min: 0, max: 6 }], // For teams that play multiple days/week
    startTimeLocal: { type: String, required: true }, // "17:00"
    endTimeLocal: { type: String, required: true }, // "18:30"
    startDate: { type: Date, required: true },
    endDate: { type: Date },

    // Pricing & Currency
    monthlyFee: { type: Number, required: true, default: 100, min: 0 },
    currency: { type: String, enum: ['USD', 'SLSH'], default: 'USD' },
    exchangeRate: { type: Number, default: 8000 },
    kulansiiyeFee: { type: Number, default: 4, min: 0 }, // E-Garoon platform revenue per month
    stadiumShare: { type: Number, default: 96, min: 0 },

    // Grace Period & Card Lifecycle
    gracePeriodDays: { type: Number, default: 3, min: 0, max: 30 },
    billingCycle: {
      startDate: { type: Date },
      endDate: { type: Date },
      gracePeriodEndsAt: { type: Date },
      lastPaymentDate: { type: Date },
      receiptNumber: { type: String, trim: true },
    },

    paymentStatus: {
      type: String,
      enum: ['paid', 'grace_period', 'overdue', 'unpaid'],
      default: 'paid',
      index: true,
    },
    cardStatus: {
      type: String,
      enum: ['active', 'grace_period', 'expired', 'blocked'],
      default: 'active',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended'],
      default: 'active',
      index: true,
    },

    // Privacy & Anti-Scam Protection
    hidePublicInfo: {
      type: Boolean,
      default: true, // Hides team name from public search to avoid impersonation
    },

    // Financial & Attendance History
    payments: [joogtoPaymentRecordSchema],
    attendanceHistory: [joogtoScanRecordSchema],

    note: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecurringBooking', recurringBookingSchema);
