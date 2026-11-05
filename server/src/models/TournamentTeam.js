const mongoose = require('mongoose');

const tournamentTeamSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    group: { type: String, trim: true }, // e.g. "A", "B"
    status: {
      type: String,
      enum: ['REGISTERED', 'CONFIRMED', 'WITHDRAWN'],
      default: 'REGISTERED',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'REFUNDED'],
      default: 'PENDING',
    },
    feePaid: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tournamentTeamSchema.index({ tournament: 1, team: 1 }, { unique: true });

module.exports = mongoose.model('TournamentTeam', tournamentTeamSchema);
