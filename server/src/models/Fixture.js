const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    group: { type: String, trim: true },
    round: {
      type: String,
      enum: ['GROUP', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'FINAL', 'THIRD_PLACE'],
      default: 'GROUP',
    },
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    startTime: { type: Date },
    endTime: { type: Date },
    homeScore: { type: Number, min: 0 },
    awayScore: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fixture', fixtureSchema);
