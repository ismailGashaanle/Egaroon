/** Somali phone helpers (Hormuud / Telesom / Somtel / Golis) — mirrors web client. */

export const SO_CARRIERS = [
  { id: 'telesom', label: 'Telesom', service: 'Zaad', prefix: '063', hint: '063 7856383', color: '#00843D', accent: '#FDB913' },
  { id: 'somtel', label: 'Somtel', service: 'eDahab', prefix: '065', hint: '065 7856383', color: '#0A66C2', accent: '#FFB800' },
  { id: 'hormuud', label: 'Hormuud', service: 'Waafi', prefix: '061', hint: '061 7856383', color: '#059669', accent: '#DC2626' },
  { id: 'golis', label: 'Golis', service: 'Sahal', prefix: '090', hint: '090 7856383', color: '#0D9488', accent: '#EA580C' },
];

export const OPERATOR_DETAILS = SO_CARRIERS;

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Detect carrier from raw input (e.g. "0637856383", "+252637856383", "25261...", "065...", "63...", etc.)
 */
export function detectCarrierFromInput(input) {
  const d = digitsOnly(input);
  if (!d) return null;
  // Intl form: 25263..., 25261..., 25265..., 25290...
  if (d.startsWith('252')) {
    const after252 = d.slice(3);
    for (const c of SO_CARRIERS) {
      const p = c.prefix.replace(/^0/, '');
      if (after252.startsWith(p)) return c;
    }
  }
  // Local form with 0: 063..., 061..., 065..., 090...
  if (d.startsWith('0')) {
    for (const c of SO_CARRIERS) {
      if (d.startsWith(c.prefix)) return c;
    }
  }
  // National prefix without 0: 63..., 61..., 65..., 90... (if length >= 8)
  if (d.length >= 8) {
    for (const c of SO_CARRIERS) {
      const p = c.prefix.replace(/^0/, '');
      if (d.startsWith(p)) return c;
    }
  }
  return null;
}

/**
 * Extract clean 7-digit local subscriber body from any input, stripping carrier prefix if present.
 */
export function extractSubscriberBody(input, expectedCarrierId) {
  let d = digitsOnly(input);
  if (!d) return '';
  if (d.startsWith('252')) {
    d = d.slice(3);
  }
  if (d.startsWith('0')) {
    d = d.slice(1);
  }
  const carrier = SO_CARRIERS.find((c) => c.id === expectedCarrierId);
  const p = carrier?.prefix?.replace(/^0/, '');
  if (p && d.startsWith(p) && d.length > 7) {
    d = d.slice(p.length);
  } else {
    for (const c of SO_CARRIERS) {
      const cp = c.prefix.replace(/^0/, '');
      if (d.startsWith(cp) && d.length > 7) {
        d = d.slice(cp.length);
        break;
      }
    }
  }
  return d.slice(0, 7);
}

export function normalizeSomaliPhone(input, opts = {}) {
  let d = digitsOnly(input);
  if (!d) return null;
  if (d.startsWith('00252')) d = d.slice(2);
  if (d.startsWith('2520')) d = `252${d.slice(4)}`;
  if (!d.startsWith('252')) {
    if (d.startsWith('0') && d.length >= 9) d = `252${d.slice(1)}`;
    else if (d.length === 9) d = `252${d}`;
    else {
      const prefix =
        opts.prefix ||
        SO_CARRIERS.find((c) => c.id === String(opts.carrierId || '').toLowerCase())?.prefix;
      if (prefix && d.length >= 6 && d.length <= 7) {
        return normalizeSomaliPhone(`${prefix}${d}`);
      }
      return null;
    }
  }
  if (!/^252\d{9}$/.test(d)) return null;
  return d;
}

export function buildPhoneFromPrefix(prefix, rest) {
  return composeSomaliPhone(null, rest, prefix);
}

/**
 * Resolve full intl / local / short body+carrier into canonical 252XXXXXXXXX.
 * Avoids double-prefix when user pastes 063… / 637… / +252… into the body field.
 */
export function composeSomaliPhone(carrierId, localNumber, prefixOverride) {
  const raw = String(localNumber || '').trim();
  if (!raw) return null;

  const direct = normalizeSomaliPhone(raw);
  if (direct) return direct;

  const d = digitsOnly(raw);
  if (!d) return null;

  const asLocal = normalizeSomaliPhone(d);
  if (asLocal) return asLocal;

  const carrier =
    SO_CARRIERS.find((c) => c.id === carrierId) ||
    SO_CARRIERS.find((c) => c.prefix === prefixOverride) ||
    SO_CARRIERS[0];
  const prefix = prefixOverride || carrier.prefix;
  const prefixNat = prefix.replace(/^0/, '');

  if (d.startsWith('252') || d.startsWith(prefix) || d.startsWith(prefixNat)) {
    const candidate = d.startsWith('0') || d.startsWith('252') ? d : `0${d}`;
    const n = normalizeSomaliPhone(candidate);
    if (n) return n;
  }

  const body = d.replace(/^0+/, '');
  if (body.length >= 6 && body.length <= 7) {
    return normalizeSomaliPhone(`${prefix}${body}`);
  }

  return normalizeSomaliPhone(`${prefix}${body}`);
}

export function toLocal0(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  return `0${n.slice(3)}`;
}

export function toE164(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  return `+${n}`;
}

/**
 * Human display that preserves carrier + body (no XXX XXX XXX scramble).
 * Example: 252637856838 → "+252 63 7856838"
 */
export function formatPhoneDisplay(normalized) {
  const n = normalizeSomaliPhone(normalized);
  if (!n) return normalized || '';
  const national = n.slice(3);
  return `+252 ${national.slice(0, 2)} ${national.slice(2)}`;
}

/** Copy-friendly share forms for Match Code WhatsApp text. */
export function formatSharePhone(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return null;
  const local0 = toLocal0(n);
  const national = n.slice(3);
  return {
    e164: `+${n}`,
    local0,
    display: formatPhoneDisplay(n),
    body: national.slice(2),
  };
}

export function detectCarrier(normalizedOrRaw) {
  const n = normalizeSomaliPhone(normalizedOrRaw);
  if (!n) return null;
  const local = `0${n.slice(3)}`;
  return SO_CARRIERS.find((c) => local.startsWith(c.prefix)) || null;
}

export function phoneMatchesOperator(phone, operatorId) {
  const carrier = detectCarrier(phone);
  if (!carrier || !operatorId) return false;
  return carrier.id === String(operatorId).toLowerCase();
}

/** Split stored +252… into carrier + local rest for SomaliPhoneInput. */
export function splitSomaliPhone(input) {
  const n = normalizeSomaliPhone(input);
  if (!n) return { carrierId: 'hormuud', localNumber: '' };
  const local = `0${n.slice(3)}`;
  const carrier = SO_CARRIERS.find((c) => local.startsWith(c.prefix)) || SO_CARRIERS[0];
  return {
    carrierId: carrier.id,
    localNumber: local.slice(carrier.prefix.length),
  };
}

export function composedPhone(carrierId, localNumber) {
  return composeSomaliPhone(carrierId, localNumber);
}
