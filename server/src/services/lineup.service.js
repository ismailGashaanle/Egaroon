const Lineup = require('../models/Lineup');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const {
  normalizeCapacity,
  defaultFormation,
  expectedStarters,
  isFormationAllowed,
} = require('../utils/formations');
const { normalizePlayers, sanitizePhotoUrl } = require('../utils/lineupPlayers');
const { getBusiness } = require('./platformSettings.service');
const { getIO } = require('../sockets');

/** Lineup GET/PUT only while match is still live (not ended). */
const LINEUP_ALLOWED = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
];

/** Statuses where lineups must not be retained (hard-delete targets). */
const LINEUP_ENDED_STATUSES = [
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.SETTLED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.EXPIRED,
  BOOKING_STATUS.NO_SHOW,
];

function assertLineupFeatureEnabled() {
  if (!getBusiness().lineupEnabled) {
    throw ApiError.forbidden(
      'Lineup / formation is disabled by platform settings (lineupEnabled=false)'
    );
  }
}

function assertCaptainOnBooking(booking, userId) {
  const isA = booking.teamA?.captain?.toString() === userId;
  const isB = booking.teamB?.captain?.toString() === userId;
  if (!isA && !isB) throw ApiError.forbidden('Only booking captains can manage lineups');
  return isA ? 'teamA' : 'teamB';
}

function paid(status) {
  return status === 'HELD' || status === 'SUCCESS' || status === 'SETTLED';
}

/**
 * Match is ended when endTime has passed or booking is in a terminal status.
 * Lineups are stored only while the match has not ended (BR-007d).
 */
function isMatchEnded(booking, now = new Date()) {
  if (!booking) return true;
  if (LINEUP_ENDED_STATUSES.includes(booking.status)) return true;
  if (booking.endTime && new Date(booking.endTime) <= now) return true;
  return false;
}

function isLineupBookingActive(booking, now = new Date()) {
  if (!booking) return false;
  if (!LINEUP_ALLOWED.includes(booking.status)) return false;
  if (booking.endTime && new Date(booking.endTime) <= now) return false;
  return true;
}

/**
 * Hard-delete all Lineup docs for a booking (Team A + Team B).
 * Safe to call repeatedly; returns deletedCount.
 */
async function deleteLineupsForBooking(bookingId) {
  if (!bookingId) return { deletedCount: 0 };
  const result = await Lineup.deleteMany({ booking: bookingId });
  return { deletedCount: result.deletedCount || 0 };
}

/**
 * Periodic / on-demand cleanup: hard-delete lineups whose booking has ended
 * (endTime <= now OR status COMPLETED/CANCELLED/EXPIRED/SETTLED/NO_SHOW).
 */
async function cleanupEndedLineups({ limit = 500 } = {}) {
  const now = new Date();
  const bookingIds = await Lineup.distinct('booking');
  if (!bookingIds.length) {
    return { scanned: 0, deletedCount: 0, bookingIds: [] };
  }

  const capped = bookingIds.slice(0, Math.min(Math.max(Number(limit) || 500, 1), 2000));
  const ended = await Booking.find({
    _id: { $in: capped },
    $or: [{ endTime: { $lte: now } }, { status: { $in: LINEUP_ENDED_STATUSES } }],
  })
    .select('_id')
    .lean();

  if (!ended.length) {
    return { scanned: capped.length, deletedCount: 0, bookingIds: [] };
  }

  const ids = ended.map((b) => b._id);
  const result = await Lineup.deleteMany({ booking: { $in: ids } });
  return {
    scanned: capped.length,
    deletedCount: result.deletedCount || 0,
    bookingIds: ids.map((id) => String(id)),
  };
}

/**
 * BR-007: lineup only when booking is CONFIRMED (or later live match states)
 * and required payments are verified (coveredFullMatch OR both sides paid).
 * BR-007d: reject once match has ended / COMPLETED.
 */
function assertPaymentGate(booking) {
  if (isMatchEnded(booking)) {
    throw ApiError.forbidden(
      'Lineup is no longer available — the match has ended and lineup data was removed'
    );
  }

  if (!LINEUP_ALLOWED.includes(booking.status)) {
    throw ApiError.forbidden(
      'Lineup is only available after the booking is CONFIRMED (both shares paid or Team A covered full match)'
    );
  }

  if (!booking.coveredFullMatch && !paid(booking.teamA?.paymentStatus)) {
    throw ApiError.forbidden('Team A payment is not verified yet');
  }
  if (!booking.coveredFullMatch && booking.teamB && !paid(booking.teamB.paymentStatus)) {
    throw ApiError.forbidden('Team B payment is not verified yet');
  }
}

function emitLineupUpdate(bookingId, lineups) {
  try {
    const io = getIO();
    io.to(`booking:${bookingId}`).emit('lineup:updated', { bookingId, lineups });
  } catch {
    /* sockets optional in tests */
  }
}

function publicPlayerView(p) {
  return {
    displayName: p.displayName,
    jerseyNumber: p.jerseyNumber,
    position: p.position,
    formationSlot: p.formationSlot || '',
    status: p.status,
    photoUrl: p.photoUrl || '',
    injured: Boolean(p.injured),
  };
}

/** Public board payload — no captain ids / internal refs beyond team + booking id */
function toPublicLineup(doc) {
  const players = (doc.players || []).map(publicPlayerView);
  return {
    id: doc._id,
    team: doc.team
      ? {
          _id: doc.team._id || doc.team,
          name: doc.team.name,
          logoUrl: doc.team.logoUrl,
        }
      : null,
    formation: doc.formation,
    capacity: normalizeCapacity(doc.capacity),
    published: doc.published !== false,
    updatedAt: doc.updatedAt,
    bookingId: doc.booking?._id || doc.booking,
    starters: players.filter((p) => p.status === 'starter'),
    bench: players.filter((p) => p.status === 'bench'),
    players,
  };
}

async function upsertLineup({ bookingId, captainId, formation, players, published }) {
  assertLineupFeatureEnabled();

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');

  assertPaymentGate(booking);

  const field = await Field.findById(booking.field).select('capacity type name');
  if (!field) throw ApiError.notFound('Field not found');

  const capacity = normalizeCapacity(field.capacity);
  const formationKey = formation || defaultFormation(capacity);
  if (!isFormationAllowed(formationKey, capacity)) {
    throw ApiError.badRequest(
      `Formation ${formationKey} is not valid for ${capacity}-a-side. Pick a matching formation.`
    );
  }

  const expected = expectedStarters(formationKey, capacity);
  if (expected !== capacity) {
    throw ApiError.badRequest(`Formation must use ${capacity} pitch slots`);
  }

  const side = assertCaptainOnBooking(booking, captainId);
  const party = booking[side];
  // No default/fake players — captain payload only; names + capacity + formation slots enforced
  const normalized = normalizePlayers(players, capacity, formationKey);
  // Publish-on-save default true (BR-007c); captain may pass published: false
  const isPublished = published === false ? false : true;

  const lineup = await Lineup.findOneAndUpdate(
    { booking: bookingId, team: party.team },
    {
      booking: bookingId,
      team: party.team,
      captain: captainId,
      formation: formationKey,
      capacity,
      published: isPublished,
      players: normalized,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const all = await Lineup.find({ booking: bookingId }).populate('team', 'name logoUrl');
  emitLineupUpdate(bookingId, all);

  return lineup;
}

async function getLineupsForBooking(bookingId, requesterId) {
  assertLineupFeatureEnabled();

  const booking = await Booking.findById(bookingId).populate('field', 'name capacity type');
  if (!booking) throw ApiError.notFound('Booking not found');
  assertPaymentGate(booking);
  if (requesterId) {
    assertCaptainOnBooking(booking, requesterId);
  }
  const lineups = await Lineup.find({ booking: bookingId }).populate('team', 'name logoUrl');
  return {
    lineups,
    capacity: normalizeCapacity(booking.field?.capacity),
    fieldType: booking.field?.type,
    fieldName: booking.field?.name,
  };
}

/**
 * Latest lineup for a team whose booking is still active (not ended).
 * Skips stale docs (cleanup job removes them; this filters until then).
 */
async function findLatestActiveLineupForTeam(teamId, { publishedOnly = false } = {}) {
  const now = new Date();
  const filter = { team: teamId };
  if (publishedOnly) filter.published = { $ne: false };

  const candidates = await Lineup.find(filter)
    .sort({ updatedAt: -1 })
    .limit(15)
    .populate('team', 'name logoUrl')
    .populate('booking', 'endTime status')
    .lean();

  return candidates.find((doc) => isLineupBookingActive(doc.booking, now)) || null;
}

/**
 * Public discovery: search teams by name → latest published lineup each.
 * Requires lineupEnabled only (no payment gate / auth).
 * Only returns lineups whose booking has not ended (BR-007d).
 */
async function searchPublishedLineups(q, { limit = 12 } = {}) {
  assertLineupFeatureEnabled();

  const query = String(q || '').trim();
  if (query.length < 2) {
    throw ApiError.badRequest('Search query must be at least 2 characters');
  }

  const max = Math.min(Math.max(Number(limit) || 12, 1), 30);
  const teams = await Team.find({
    name: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  })
    .select('name logoUrl')
    .limit(max)
    .lean();

  if (!teams.length) {
    return { results: [], query };
  }

  const results = [];
  for (const team of teams) {
    const lineup = await findLatestActiveLineupForTeam(team._id, { publishedOnly: true });
    if (lineup) {
      results.push(toPublicLineup(lineup));
    }
  }

  return { results, query };
}

/** Latest published lineup for a team (public when lineupEnabled). Active matches only. */
async function getPublishedLineupForTeam(teamId) {
  assertLineupFeatureEnabled();

  const team = await Team.findById(teamId).select('name logoUrl');
  if (!team) throw ApiError.notFound('Team not found');

  const lineup = await findLatestActiveLineupForTeam(teamId, { publishedOnly: true });

  if (!lineup) {
    throw ApiError.notFound('No published lineup for this team');
  }

  return { lineup: toPublicLineup(lineup) };
}

/**
 * Authenticated: latest lineup board(s) for teams the user captains.
 * Includes unpublished (owner view). Only active (not-ended) bookings.
 */
async function listMyLineups(userId, { limit = 20 } = {}) {
  assertLineupFeatureEnabled();

  const max = Math.min(Math.max(Number(limit) || 20, 1), 40);
  const teams = await Team.find({ captain: userId }).select('name logoUrl').lean();

  if (!teams.length) {
    return { results: [], teams: [], query: 'mine' };
  }

  const results = [];
  for (const team of teams) {
    const lineup = await findLatestActiveLineupForTeam(team._id, { publishedOnly: false });
    if (lineup) {
      results.push(toPublicLineup(lineup));
    }
  }

  results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return {
    results: results.slice(0, max),
    teams: teams.map((t) => ({
      _id: t._id,
      name: t.name,
      logoUrl: t.logoUrl,
    })),
    query: 'mine',
  };
}

module.exports = {
  upsertLineup,
  getLineupsForBooking,
  searchPublishedLineups,
  getPublishedLineupForTeam,
  listMyLineups,
  deleteLineupsForBooking,
  cleanupEndedLineups,
  isMatchEnded,
  isLineupBookingActive,
  toPublicLineup,
  LINEUP_ALLOWED,
  LINEUP_ENDED_STATUSES,
  assertLineupFeatureEnabled,
  // Exported for scripts / focused asserts (pure helpers live in utils/lineupPlayers)
  normalizePlayers,
  sanitizePhotoUrl,
};
