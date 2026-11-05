const mongoose = require('mongoose');

/**
 * Super Admin–managed cities for outdoor play-risk weather alerts.
 * Seeded with Hargeisa, Muqdisho, Burao, Borama.
 */
const weatherCitySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    nameSo: { type: String, trim: true },
    aliases: [{ type: String, trim: true }],
    region: { type: String, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    timezone: { type: String, default: 'Africa/Mogadishu' },
    active: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    lastPlayLevel: {
      type: String,
      enum: ['good', 'caution', 'poor', 'unplayable'],
    },
    lastFetchedAt: { type: Date },
    lastSnapshot: { type: mongoose.Schema.Types.Mixed },
    outlook: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

weatherCitySchema.index({ name: 1 });
weatherCitySchema.index({ active: 1, lastPlayLevel: 1 });

module.exports = mongoose.model('WeatherCity', weatherCitySchema);
