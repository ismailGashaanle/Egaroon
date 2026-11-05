/**
 * Pure lineup player normalization / validation (no DB).
 * Used by lineup.service and scripts/assert-lineup-rules.js.
 */
const ApiError = require('./ApiError');
const { expectedStarters, slotIdsForFormation } = require('./formations');

/** Soft cap — extras belong on bench; keep squads sane. */
const MAX_BENCH = 30;

/** Prefer Cloudinary/CDN http(s) URLs — reject base64 blobs in Mongo. */
function sanitizePhotoUrl(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw !== 'string') {
    throw ApiError.badRequest('photoUrl must be a string URL');
  }
  const url = raw.trim().slice(0, 2048);
  if (!url) return '';
  if (/^data:/i.test(url)) {
    throw ApiError.badRequest(
      'Player photos must be uploaded via Cloudinary (use POST /api/uploads), not base64 data URLs'
    );
  }
  // Reject non-hosted schemes before the http(s) check
  if (/^(about:|blob:|file:)/i.test(url)) {
    throw ApiError.badRequest('photoUrl must be a hosted http(s) URL (Cloudinary)');
  }
  if (!/^https?:\/\//i.test(url)) {
    throw ApiError.badRequest('photoUrl must be an http(s) URL');
  }
  return url;
}

/**
 * Normalize + validate players for a capacity-scoped formation.
 * Does not invent default/fake players. Empty display names fail validation.
 *
 * @param {Array} rawPlayers
 * @param {number} capacity - field players-per-side
 * @param {string} [formationKey] - when set, starter slots must match that formation
 */
function normalizePlayers(rawPlayers = [], capacity, formationKey) {
  const list = Array.isArray(rawPlayers) ? rawPlayers : [];

  for (let i = 0; i < list.length; i += 1) {
    const name = String(list[i]?.displayName || '').trim();
    if (!name) {
      throw ApiError.badRequest(
        `Player at index ${i} needs a display name (empty names are not allowed)`
      );
    }
  }

  const players = list.map((p) => {
    const injured = Boolean(p.injured);
    let status = p.status === 'starter' ? 'starter' : 'bench';
    let formationSlot =
      status === 'starter' && p.formationSlot ? String(p.formationSlot).trim() : '';
    if (injured) {
      status = 'bench';
      formationSlot = '';
    } else if (formationSlot) {
      status = 'starter';
    }
    return {
      playerId: p.playerId || undefined,
      displayName: String(p.displayName || '').trim(),
      jerseyNumber: p.jerseyNumber != null ? Number(p.jerseyNumber) : undefined,
      position: status === 'bench' ? 'SUB' : p.position || 'MF',
      formationSlot,
      status,
      photoUrl: sanitizePhotoUrl(p.photoUrl),
      injured,
      injuryNote: String(p.injuryNote || '').slice(0, 200),
    };
  });

  const starters = players.filter((p) => p.status === 'starter');
  const bench = players.filter((p) => p.status === 'bench');

  if (bench.length > MAX_BENCH) {
    throw ApiError.badRequest(`Bench cannot exceed ${MAX_BENCH} players (got ${bench.length})`);
  }

  const slots = new Set();
  for (const s of starters) {
    if (!s.formationSlot) {
      throw ApiError.badRequest('Every starter needs a formation slot');
    }
    if (slots.has(s.formationSlot)) {
      throw ApiError.badRequest(`Duplicate formation slot: ${s.formationSlot}`);
    }
    slots.add(s.formationSlot);
  }

  // Fit for match: starters must equal field capacity (e.g. 7v7 → 7)
  if (starters.length !== capacity) {
    throw ApiError.badRequest(
      `Lineup must have exactly ${capacity} starters for this field (got ${starters.length}). Put extras on the bench.`
    );
  }

  if (formationKey) {
    const expected = expectedStarters(formationKey, capacity);
    if (expected !== capacity) {
      throw ApiError.badRequest(`Formation must use ${capacity} pitch slots`);
    }
    const allowed = slotIdsForFormation(formationKey, capacity);
    if (allowed) {
      const allowedSet = new Set(allowed);
      for (const s of starters) {
        if (!allowedSet.has(s.formationSlot)) {
          throw ApiError.badRequest(
            `Slot ${s.formationSlot} is not valid for formation ${formationKey}`
          );
        }
      }
      if (allowed.length !== starters.length) {
        throw ApiError.badRequest(
          `Formation ${formationKey} expects ${allowed.length} starters for ${capacity}-a-side`
        );
      }
    }
  }

  return players;
}

module.exports = {
  MAX_BENCH,
  sanitizePhotoUrl,
  normalizePlayers,
};
