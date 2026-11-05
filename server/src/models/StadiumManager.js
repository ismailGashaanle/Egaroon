const mongoose = require('mongoose');

/**
 * Scoped stadium manager — assigned by stadium owner (docs/06-roles-permissions.md §4).
 * Not a free public registration role.
 */
const stadiumManagerSchema = new mongoose.Schema(
  {
    stadium: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stadium',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permissions: {
      type: [String],
      default: [
        'bookings.read',
        'availability.manage',
        'fields.read',
        'checkin',
        'blocks.manage',
      ],
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
  },
  { timestamps: true }
);

stadiumManagerSchema.index({ stadium: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('StadiumManager', stadiumManagerSchema);
