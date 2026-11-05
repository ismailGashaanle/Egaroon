/**
 * Somali mobile helpers — Hormuud 061, Telesom 063, Somtel 065, Golis 090.
 * Canonical store/lookup: 252XXXXXXXXX (9 digits after 252).
 *
 * Display rule: never group national digits as XXX XXX XXX (e.g. +252 637 856 838).
 * That scramble-looking layout hides the carrier+body shape and causes Team B mistypes
 * (7856383 vs 7856838). Prefer +252 63 7856838 / 0637856838 / +252637856838.
 */

const CARRIERS = [
  { id: 'hormuud', label: 'Hormuud', prefixes: ['061', '77'], countryPrefix: '252' },
  { id: 'telesom', label: 'Telesom', prefixes: ['063'], countryPrefix: '252' },
  { id: 'somtel', label: 'Somtel', prefixes: ['065', '62'], countryPrefix: '252' },
  { id: 'golis', label: 'Golis', prefixes: ['090', '90'], countryPrefix: '252' },
];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function getCarrierById(operatorId) {
  return CARRIERS.find((c) => c.id === String(operatorId || '').toLowerCase()) || null;
}

/**
 * Normalize to 252XXXXXXXXX when possible.
 * @param {string} input
 * @param {{ carrierId?: string, prefix?: string }} [opts] — for short local body (6–7 digits)
 */
function normalizeSomaliPhone(input, opts = {}) {
  let d = digitsOnly(input);
  if (!d) return null;

  if (d.startsWith('00252')) d = d.slice(2);
  if (d.startsWith('2520')) d = `252${d.slice(4)}`;

  if (d.startsWith('252')) {
    // ok
  } else if (d.startsWith('0') && d.length >= 9) {
    d = `252${d.slice(1)}`;
  } else if (d.length === 9) {
    d = `252${d}`;
  } else {
    const prefix =
      opts.prefix ||
      getCarrierById(opts.carrierId)?.prefixes?.find((p) => /^0\d{2}$/.test(p)) ||
      null;
    if (prefix && d.length >= 6 && d.length <= 7) {
      return normalizeSomaliPhone(`${prefix}${d}`);
    }
    return null;
  }

  if (!/^252\d{9}$/.test(d)) return null;
  return d;
}

function detectCarrier(normalizedOrRaw) {
  const n = normalizeSomaliPhone(normalizedOrRaw) || digitsOnly(normalizedOrRaw);
  if (!n) return null;
  const local = n.startsWith('252') ? `0${n.slice(3)}` : n.startsWith('0') ? n : `0${n}`;
  for (const c of CARRIERS) {
    if (c.prefixes.some((p) => local.startsWith(p) || local.slice(0, 3) === p)) {
      return c;
    }
  }
  const nat = local.startsWith('0') ? local : `0${local}`;
  for (const c of CARRIERS) {
    if (c.prefixes.some((p) => nat.startsWith(p))) return c;
  }
  return null;
}

/** Local 0-form: 0637856838 */
function toLocal0(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  return `0${n.slice(3)}`;
}

/**
 * Human display that preserves carrier + body (no digit scramble / no XXX XXX XXX).
 * Example: 252637856838 → "+252 63 7856838"
 */
function formatDisplay(normalized) {
  const n = normalizeSomaliPhone(normalized);
  if (!n) return normalized || '';
  const national = n.slice(3); // 9 digits
  const ndc = national.slice(0, 2);
  const body = national.slice(2);
  return `+252 ${ndc} ${body}`;
}

/** Compact E.164 for copy/paste: +252637856838 */
function toE164(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  return `+${n}`;
}

/**
 * Copy-friendly share forms for Match Code WhatsApp text.
 * @returns {{ e164: string, local0: string, display: string, body: string } | null}
 */
function formatSharePhone(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  const local0 = toLocal0(n);
  const national = n.slice(3);
  return {
    e164: `+${n}`,
    local0,
    display: formatDisplay(n),
    body: national.slice(2),
  };
}

/**
 * Lookup / compare variants for one MSISDN (canonical + local + E.164 forms).
 * Short 7-digit body is included only after successful normalize (carrier-known).
 */
function phoneLookupVariants(input, opts = {}) {
  const n = normalizeSomaliPhone(input, opts);
  if (!n) {
    const d = digitsOnly(input);
    return d ? [...new Set([d, input && String(input).trim()].filter(Boolean))] : [];
  }
  const national9 = n.slice(3);
  const national0 = `0${national9}`;
  const bodyAfterCarrier = national9.length > 2 ? national9.slice(2) : '';
  const share = formatSharePhone(n);
  return [
    ...new Set(
      [
        n,
        national9,
        national0,
        `+${n}`,
        share?.display?.replace(/\s/g, ''),
        share?.e164,
        share?.local0,
        bodyAfterCarrier,
      ].filter(Boolean)
    ),
  ];
}

/** Canonical set for comparison (always 252…). */
function canonicalPhoneSet(input, opts = {}) {
  const out = new Set();
  const n = normalizeSomaliPhone(input, opts);
  if (n) out.add(n);
  for (const v of phoneLookupVariants(input, opts)) {
    const nv = normalizeSomaliPhone(v);
    if (nv) out.add(nv);
  }
  return out;
}

/**
 * True when two phone inputs refer to the same Somali MSISDN
 * (variant set intersection on canonical forms).
 */
function phonesEquivalent(a, b, opts = {}) {
  const left = canonicalPhoneSet(a, opts);
  if (left.size === 0) return false;
  const right = canonicalPhoneSet(b, opts);
  for (const c of left) {
    if (right.has(c)) return true;
  }
  return false;
}

/**
 * True when entered matches any expected stored phone (raw or normalized).
 * Uses full variant intersection (canonical + local + E.164 + body).
 * @param {string} entered
 * @param {Iterable<string>} expectedPhones
 * @param {{ carrierId?: string, prefix?: string }} [opts]
 */
function phoneMatchesAny(entered, expectedPhones, opts = {}) {
  if (!entered || !expectedPhones) return false;
  const enteredCanons = canonicalPhoneSet(entered, opts);
  if (enteredCanons.size === 0) return false;

  for (const expected of expectedPhones) {
    if (!expected) continue;
    const expectedCanons = canonicalPhoneSet(expected);
    for (const c of enteredCanons) {
      if (expectedCanons.has(c)) return true;
    }
    const enteredVars = new Set(phoneLookupVariants(entered, opts));
    for (const v of phoneLookupVariants(expected)) {
      if (enteredVars.has(v)) return true;
      const nv = normalizeSomaliPhone(v);
      if (nv && enteredCanons.has(nv)) return true;
    }
  }
  return false;
}

/** True when normalized phone belongs to the chosen operator (061/063/065/090). */
function phoneMatchesOperator(phone, operatorId) {
  const carrier = detectCarrier(phone);
  if (!carrier || !operatorId) return false;
  return carrier.id === String(operatorId).toLowerCase();
}

module.exports = {
  CARRIERS,
  normalizeSomaliPhone,
  detectCarrier,
  formatDisplay,
  formatSharePhone,
  toLocal0,
  toE164,
  phoneLookupVariants,
  canonicalPhoneSet,
  phonesEquivalent,
  phoneMatchesAny,
  phoneMatchesOperator,
  getCarrierById,
  digitsOnly,
};
