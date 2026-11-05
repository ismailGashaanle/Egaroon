const crypto = require('crypto');
const Booking = require('../models/Booking');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

function randomSegment(len = 4) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Format: SG-XXXX-XXXX (letters + digits, unpredictable). */
function formatMatchCode(a, b) {
  return `SG-${a}-${b}`;
}

function normalizeMatchCode(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
  const m = cleaned.match(/^SG-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!m) return null;
  return formatMatchCode(m[1], m[2]);
}

/**
 * Generate a unique Match Code; uniqueness checked in DB before return.
 * Retries on collision (sparse unique index is the hard guarantee).
 */
async function generateUniqueMatchCode(maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = formatMatchCode(randomSegment(4), randomSegment(4));
    // eslint-disable-next-line no-await-in-loop
    const exists = await Booking.exists({ matchCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not allocate unique match code');
}

module.exports = {
  generateUniqueMatchCode,
  normalizeMatchCode,
  formatMatchCode,
};
