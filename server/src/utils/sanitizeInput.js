/**
 * Input sanitizers for user-facing strings (names, free text).
 * Never use raw req.body objects in Mongo queries — whitelist + cast instead.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Letters (incl. Somali Latin), numbers, marks, spaces, apostrophe, hyphen, period. */
const PERSON_NAME_RE = /^[\p{L}\p{N}\p{M}\s'.-]{2,80}$/u;

/**
 * Strip control characters and collapse whitespace.
 * @param {unknown} value
 * @param {{ max?: number }} [opts]
 * @returns {string}
 */
function stripControlChars(value, opts = {}) {
  const max = opts.max ?? 200;
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Validate + sanitize a person / captain name.
 * @param {unknown} raw
 * @returns {string|null} sanitized name or null if invalid/empty
 */
function sanitizePersonName(raw) {
  const cleaned = stripControlChars(raw, { max: 80 });
  if (!cleaned || cleaned.length < 2) return null;
  if (!PERSON_NAME_RE.test(cleaned)) return null;
  return cleaned;
}

/**
 * Assert only allowed keys exist on body (reject NoSQL / mass-assignment junk).
 * @param {object} body
 * @param {string[]} allowed
 */
function assertAllowedFields(body, allowed) {
  const keys = Object.keys(body || {});
  const allow = new Set(allowed);
  const unexpected = keys.filter((k) => !allow.has(k));
  if (unexpected.length) {
    const err = new Error('Unexpected fields in request');
    err.code = 'UNEXPECTED_FIELDS';
    err.fields = unexpected.slice(0, 12);
    throw err;
  }
}

module.exports = {
  CONTROL_CHARS,
  PERSON_NAME_RE,
  stripControlChars,
  sanitizePersonName,
  assertAllowedFields,
};
