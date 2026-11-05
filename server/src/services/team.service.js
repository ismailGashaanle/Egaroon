const Team = require('../models/Team');
const User = require('../models/User');

/**
 * Captains can book without picking a team first.
 * Reuses their oldest team, or creates "My Team" / optional name.
 */
async function getOrCreateDefaultTeam(captainId, preferredName) {
  const existing = await Team.findOne({ captain: captainId }).sort({ createdAt: 1 });
  if (existing) {
    if (preferredName && preferredName.trim() && preferredName.trim() !== existing.name) {
      // Keep existing default; optional rename only when they have exactly one untitled-style team
      return existing;
    }
    return existing;
  }

  const captain = await User.findById(captainId).select('name');
  const name =
    (preferredName && preferredName.trim()) ||
    (captain?.name ? `${captain.name.split(' ')[0]}'s Team` : 'My Team');

  return Team.create({
    name,
    captain: captainId,
  });
}

module.exports = { getOrCreateDefaultTeam };
