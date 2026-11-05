const mongoose = require('mongoose');

const stadiumSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }],
    // Flat address fields — avoids legacy 2dsphere index conflicts on a nested `location` path.
    address: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    region: { type: String, trim: true, index: true },
    area: { type: String, trim: true },
    latLng: {
      lat: { type: Number },
      lng: { type: Number },
    },
    facilities: [{ type: String }], // e.g. parking, lighting, showers, seating
    openingTime: { type: String }, // "06:00"
    closingTime: { type: String }, // "23:00"
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    /**
     * When owner receives payout after a match ends.
     * after_match + delayMinutes 20 → ~20 min after endTime
     * fixed_hours + delayMinutes 1440 → 24 hours after endTime
     */
    payoutPolicy: {
      mode: {
        type: String,
        enum: ['after_match', 'fixed_hours'],
        default: 'after_match',
      },
      delayMinutes: {
        type: Number,
        min: 5,
        max: 60 * 24 * 7,
        default: 20,
      },
    },
    /**
     * After both teams pay (or coverFullMatch):
     * - auto: ownerAcceptedAt set immediately; slot already CONFIRMED
     * - manual: CONFIRMED for slot lock, but needsOwnerAccept until staff Accept
     */
    bookingAcceptMode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
    },
    /**
     * Owner ops: online/offline for public booking.
     * isOnline=false → closed (optional offlineUntil for auto-reopen countdown).
     * offlineFrom–offlineUntil → scheduled closed window.
     */
    isOnline: { type: Boolean, default: true, index: true },
    offlineFrom: { type: Date },
    offlineUntil: { type: Date },
    offlineReason: { type: String, trim: true },
    subscriptionAutoDeduct: { type: Boolean, default: false },
    isSubscriptionLocked: { type: Boolean, default: false },

    /**
     * Complete Stadium Booking Rules, Policies & Agreements Manager.
     * Managed by Stadium Owner within Super Admin guardrails.
     */
    bookingPolicy: {
      // Status & Versioning
      policyStatus: { type: String, enum: ['PUBLISHED', 'DRAFT'], default: 'PUBLISHED' },
      policyVersion: { type: Number, default: 1, min: 1 },
      publishedAt: { type: Date, default: Date.now },
      venueTimeZone: { type: String, default: 'Africa/Mogadishu' },

      // 01 Booking & Availability
      slotDurationMinutes: { type: Number, default: 60, enum: [30, 60, 90, 120] },
      minBookingNoticeMinutes: { type: Number, default: 30, min: 0 },
      maxBookingAdvanceDays: { type: Number, default: 30, min: 1, max: 90 },
      slotBufferMinutes: { type: Number, default: 0, min: 0, max: 30 },
      prepTimeMinutes: { type: Number, default: 0, min: 0, max: 60 },
      maxSpectators: { type: Number, default: 50, min: 0 },
      autoConfirm: { type: Boolean, default: true },
      manualApproval: { type: Boolean, default: false },

      // 02 Pricing & Fees
      depositRequired: { type: Boolean, default: false },
      depositPercent: { type: Number, default: 0, min: 0, max: 100 },
      depositFixedAmount: { type: Number, default: 0, min: 0 },
      damageDepositRequired: { type: Boolean, default: false },
      damageDepositAmount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', trim: true },

      // 03 Team Cancellation & Refunds
      cancellationAllowed: { type: Boolean, default: true },
      cancelRefundWindowHours: { type: Number, default: 24, min: 0, max: 720 },
      cancelRefundPercent: { type: Number, default: 100, min: 0, max: 100 },
      cancelRefundTiers: {
        type: [
          {
            hoursBefore: { type: Number, required: true },
            refundPercent: { type: Number, required: true },
            label: { type: String },
          },
        ],
        default: [
          { hoursBefore: 24, refundPercent: 100, label: '> 24 saacadood' },
          { hoursBefore: 12, refundPercent: 75, label: '12 – 24 saacadood' },
          { hoursBefore: 3, refundPercent: 50, label: '3 – 12 saacadood' },
          { hoursBefore: 0, refundPercent: 0, label: '< 3 saacadood' },
        ],
      },
      ownerCancelPenaltyPercent: { type: Number, default: 100, min: 100, max: 200 },

      // 04 Rescheduling
      rescheduleAllowed: { type: Boolean, default: true },
      freeRescheduleWindowHours: { type: Number, default: 24, min: 0, max: 720 },
      rescheduleFee: { type: Number, default: 0, min: 0, max: 20 },
      rescheduleFeeCurrency: { type: String, default: 'USD', trim: true },
      maxReschedulesPerBooking: { type: Number, default: 1, min: 1, max: 5 },
      minRescheduleNoticeHours: { type: Number, default: 6, min: 1, max: 168 },
      ownerRescheduleNoticeHours: { type: Number, default: 12, min: 1, max: 168 },

      // 05 Late Arrival & No-Show
      lateArrivalGraceMinutes: { type: Number, default: 15, min: 5, max: 30 },
      lateArrivalConsequence: {
        type: String,
        enum: ['time_lost_no_extension', 'allowed_if_next_free'],
        default: 'time_lost_no_extension',
      },
      lateCheckInRequired: { type: Boolean, default: true },
      noShowWaitMinutes: { type: Number, default: 15, min: 10, max: 45 },
      noShowRefundPercent: { type: Number, default: 0, min: 0, max: 50 },
      noShowReliabilityWarning: { type: Boolean, default: true },

      // 06 Owner Cancellation & Service Failure
      ownerServiceFailureRefundPercent: { type: Number, default: 100, min: 100, max: 100 },
      ownerCompensateAlternativeSlot: { type: Boolean, default: true },
      ownerCancellationNoticeMinHours: { type: Number, default: 4, min: 1 },

      // 07 Weather & Emergencies (Force Majeure)
      weatherPolicyType: {
        type: String,
        enum: ['full_refund_or_reschedule', 'reschedule_only', 'partial_refund'],
        default: 'full_refund_or_reschedule',
      },
      weatherRefundPercent: { type: Number, default: 100, min: 50, max: 100 },
      emergencyClosureNoticeHours: { type: Number, default: 1, min: 0 },

      // 08 Damage & Conduct
      pitchDamageEvidenceRequired: { type: Boolean, default: true },
      litterCleanFee: { type: Number, default: 0, min: 0 },
      prohibitedItemsPolicy: {
        type: String,
        default: 'Sigaarka, hubka, iyo qashinka waa mamnuuc garoonka.',
      },
      bannedFootwearPolicy: {
        type: String,
        default: 'Kaba biraha leh waa mamnuuc; kaliya kuwa caagga/turf-ka ah ayaa la oggol yahay.',
      },

      // 09 Roster & Team Rules
      minPlayersPerTeam: { type: Number, default: 5, min: 1 },
      maxPlayersPerTeam: { type: Number, default: 15, min: 5 },
      substitutesAllowed: { type: Boolean, default: true },
      captainChangeAllowed: { type: Boolean, default: true },

      // 10 Overtime & Extensions
      overtimeAllowed: { type: Boolean, default: true },
      overtimeRequiresNextSlotFree: { type: Boolean, default: true },
      overtimeNoticeMinutes: { type: Number, default: 10, min: 5 },
      overtimeChargePer15Min: { type: Number, default: 5, min: 0 },

      // 11 Complaints & Disputes
      disputeWindowHours: { type: Number, default: 24, min: 6, max: 72 },
      disputeResolutionDays: { type: Number, default: 3, min: 1, max: 14 },
      ownerResponseWindowHours: { type: Number, default: 24, min: 6, max: 48 },

      // Localized Notices
      policyNoticeSo: { type: String, trim: true },
      policyNoticeEn: { type: String, trim: true },

      // Draft & History
      draftPolicy: { type: mongoose.Schema.Types.Mixed, default: null },
      policyHistory: {
        type: [
          {
            version: { type: Number, required: true },
            publishedAt: { type: Date, default: Date.now },
            publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            snapshot: { type: mongoose.Schema.Types.Mixed },
          },
        ],
        default: [],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// API compatibility — clients send/receive `location` as a nested object.
stadiumSchema.virtual('location').get(function locationVirtual() {
  return {
    address: this.address,
    city: this.city,
    region: this.region,
    area: this.area,
    latLng: this.latLng,
  };
});

stadiumSchema.index({ city: 1, region: 1 });

function mapLocationInput(location = {}) {
  if (!location || typeof location !== 'object') return {};
  let latLng = location.latLng || location.coordinates;
  if (!latLng && (location.lat != null || location.lng != null)) {
    latLng = {
      lat: location.lat != null ? Number(location.lat) : undefined,
      lng: location.lng != null ? Number(location.lng) : undefined,
    };
  }
  return {
    address: location.address,
    city: location.city,
    region: location.region,
    area: location.area,
    latLng,
  };
}

function attachLocation(stadium) {
  if (!stadium) return stadium;
  const obj = typeof stadium.toObject === 'function'
    ? stadium.toObject({ virtuals: true })
    : { ...stadium };
  if (!obj.location) {
    obj.location = {
      address: obj.address,
      city: obj.city,
      region: obj.region,
      area: obj.area,
      latLng: obj.latLng,
    };
  }
  const { getStadiumOpsStatus } = require('../utils/stadiumAvailability');
  obj.ops = getStadiumOpsStatus(obj);
  return obj;
}

module.exports = mongoose.model('Stadium', stadiumSchema);
module.exports.mapLocationInput = mapLocationInput;
module.exports.attachLocation = attachLocation;
