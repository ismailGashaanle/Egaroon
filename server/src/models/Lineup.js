const mongoose = require('mongoose');

const lineupPlayerSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId },
    displayName: { type: String, required: true, trim: true },
    jerseyNumber: { type: Number, min: 0, max: 99 },
    position: {
      type: String,
      enum: ['GK', 'DF', 'MF', 'FW', 'SUB'],
      default: 'MF',
    },
    /** Pitch slot id when starter; empty/null when on bench */
    formationSlot: { type: String, default: '' },
    /** starter = on pitch; bench = substitute */
    status: {
      type: String,
      enum: ['starter', 'bench'],
      default: 'bench',
    },
    photoUrl: { type: String, default: '', maxlength: 2048 },
    injured: { type: Boolean, default: false },
    injuryNote: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: true }
);

/**
 * Lineup is payment-gated: only when booking is CONFIRMED (BR-007).
 * One document per (booking, team) — Team A and Team B captains each own a board.
 * Hard-deleted when match ends / COMPLETED (BR-007d) — not retained long-term.
 * See docs/05-business-rules.md BR-007 / BR-007b2 / BR-007d.
 */
const lineupSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
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
    formation: {
      type: String,
      default: '2-3-1',
      trim: true,
    },
    /** Field capacity snapshot (players per side) when saved */
    capacity: { type: Number, min: 1, max: 22 },
    /**
     * Public discovery (BR-007c). Default true on save after payment gate —
     * anyone can view when lineupEnabled + published.
     */
    published: { type: Boolean, default: true },
    players: {
      type: [lineupPlayerSchema],
      default: [],
    },
  },
  { timestamps: true }
);

lineupSchema.index({ booking: 1, team: 1 }, { unique: true });
lineupSchema.index({ team: 1, published: 1, updatedAt: -1 });

module.exports = mongoose.model('Lineup', lineupSchema);
