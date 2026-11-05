const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema(
  {
    winner: { type: String },
    runnerUp: { type: String },
    thirdPlace: { type: String },
    notes: { type: String },
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
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
    fields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
    maxTeams: { type: Number, required: true, min: 2, max: 64 },
    registrationFee: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    matchDurationMinutes: { type: Number, default: 60, min: 30 },
    format: {
      type: String,
      enum: ['GROUP_STAGE', 'KNOCKOUT', 'GROUP_AND_KNOCKOUT'],
      default: 'GROUP_AND_KNOCKOUT',
    },
    rules: { type: String },
    prize: { type: prizeSchema },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tournament', tournamentSchema);
