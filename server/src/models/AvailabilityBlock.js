const mongoose = require('mongoose');

// Field-level or whole-stadium period that is NOT bookable by the public.
const availabilityBlockSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['field', 'stadium'],
      default: 'field',
      index: true,
    },
    stadium: { type: mongoose.Schema.Types.ObjectId, ref: 'Stadium', index: true },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', index: true },
    type: {
      type: String,
      enum: ['maintenance', 'weather', 'holiday', 'private_event', 'tournament', 'owner_block'],
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, trim: true },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

availabilityBlockSchema.index({ field: 1, startsAt: 1, endsAt: 1 });
availabilityBlockSchema.index({ stadium: 1, scope: 1, startsAt: 1, endsAt: 1 });

availabilityBlockSchema.pre('validate', function validateScope(next) {
  if (this.scope === 'stadium') {
    if (!this.stadium) {
      return next(new Error('stadium is required for stadium-wide blocks'));
    }
    this.field = undefined;
  } else if (!this.field) {
    return next(new Error('field is required for field blocks'));
  }
  return next();
});

module.exports = mongoose.model('AvailabilityBlock', availabilityBlockSchema);
