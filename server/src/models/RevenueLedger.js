const mongoose = require('mongoose');
const { LEDGER_TYPES } = require('../constants/revenue');

const revenueLedgerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(LEDGER_TYPES),
      required: true,
      index: true,
    },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', index: true },
    agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'StadiumAgreement' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    party: {
      type: String,
      enum: ['platform', 'stadium_owner', 'team'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'posted', 'reversed'],
      default: 'posted',
      index: true,
    },
    note: { type: String, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

revenueLedgerSchema.index({ stadium: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('RevenueLedger', revenueLedgerSchema);
