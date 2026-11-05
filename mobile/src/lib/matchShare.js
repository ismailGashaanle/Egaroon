import { formatSharePhone } from './somaliPhone';

/**
 * Safe Match Code share package (no tokens / secrets).
 * Params: code + teamAPhone only.
 */

const MATCH_CODE_RE = /^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const NAME_SAFE_RE = /^[\p{L}\p{M}\s'.-]{1,80}$/u;

function escapePlain(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>"`]/g, '')
    .trim();
}

export function sanitizeShareName(raw) {
  const cleaned = escapePlain(raw).replace(/\s+/g, ' ').slice(0, 80);
  if (!cleaned || !NAME_SAFE_RE.test(cleaned)) return null;
  return cleaned;
}

const WEB_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_URL) ||
  'https://egaroon.com';

export function buildJoinMatchUrl({ code, teamAPhone, baseUrl = WEB_BASE } = {}) {
  const safeCode = escapePlain(code).toUpperCase().replace(/\s+/g, '');
  const share = formatSharePhone(teamAPhone);
  const phone = share?.e164 || escapePlain(teamAPhone).replace(/[^\d+]/g, '');
  if (!MATCH_CODE_RE.test(safeCode) || !phone) return null;
  const origin = String(baseUrl || '').replace(/\/$/, '');
  if (!origin) return null;
  const qs = new URLSearchParams();
  qs.set('code', safeCode);
  qs.set('teamAPhone', phone);
  return `${origin}/app/join-match?${qs.toString()}`;
}

export function buildJoinMatchDeepLink({ code, teamAPhone } = {}) {
  const safeCode = escapePlain(code).toUpperCase().replace(/\s+/g, '');
  const share = formatSharePhone(teamAPhone);
  const phone = share?.e164 || escapePlain(teamAPhone).replace(/[^\d+]/g, '');
  if (!MATCH_CODE_RE.test(safeCode) || !phone) return null;
  const qs = new URLSearchParams();
  qs.set('code', safeCode);
  qs.set('teamAPhone', phone);
  return `kulansiiye://join-match?${qs.toString()}`;
}

export function resolveTeamAShareName(booking) {
  return (
    sanitizeShareName(booking?.teamA?.team?.name) ||
    sanitizeShareName(booking?.teamA?.captain?.name) ||
    sanitizeShareName(booking?.teamA?.teamName) ||
    null
  );
}

/**
 * Somali-first safe share text for Copy / WhatsApp.
 */
export function buildMatchSharePackage({
  code,
  teamAPhone,
  teamAName,
  baseUrl,
  includeDeepLink = true,
} = {}) {
  const safeCode = escapePlain(code).toUpperCase().replace(/\s+/g, '');
  const share = formatSharePhone(teamAPhone);
  const e164 = share?.e164 || null;
  const local0 = share?.local0 || null;
  const pretty = share?.display || null;
  const name = sanitizeShareName(teamAName);
  const joinUrl = buildJoinMatchUrl({
    code: safeCode,
    teamAPhone: e164 || teamAPhone,
    baseUrl,
  });
  const deepLink = includeDeepLink
    ? buildJoinMatchDeepLink({ code: safeCode, teamAPhone: e164 || teamAPhone })
    : null;

  const phoneForms = [e164, local0].filter(Boolean);
  const phonePrimary = phoneForms.length ? phoneForms.join(' · ') : pretty;

  const lines = ['E-Garoon — casuumid Team B', ''];

  if (name) {
    lines.push(`Kooxda: ${name}`);
  }
  if (phonePrimary) {
    lines.push(`Telefoonka lacag-bixiyaha (Team A): ${phonePrimary}`);
  } else {
    lines.push('Telefoonka lacag-bixiyaha (Team A): ka weydii kabtanka A');
  }

  lines.push(`Match Code: *${safeCode}*`, '');
  lines.push(
    'Tallaabooyinka Team B:',
    '1) App ama web → Dhammee lacagta',
    `2) Geli Match Code-ka: ${safeCode}`,
    '3) Geli telefoonka Team A ee kor ku xusan',
    '4) Bixi qaybtaada'
  );

  if (joinUrl) lines.push('', `Link: ${joinUrl}`);
  if (deepLink) lines.push(`App: ${deepLink}`);
  lines.push(
    '',
    'Code kaliya kuma filna — Match Code + telefoonka Team A (anti-scam).',
    'Ha dirin OTP, password, ama token.'
  );

  return {
    code: safeCode,
    teamAName: name,
    teamAPhoneE164: e164,
    teamAPhoneLocal: local0,
    teamAPhoneDisplay: pretty,
    joinUrl,
    deepLink,
    text: lines.join('\n'),
    steps: [
      'App ama web → Dhammee lacagta',
      `Geli Match Code-ka: ${safeCode}`,
      'Geli telefoonka Team A ee lacagta lagu bixiyay',
      'Bixi qaybtaada',
    ],
  };
}

export function whatsAppShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(String(text || ''))}`;
}

/**
 * Short Somali Match Pass share (gate-safe fields only — no tokens/secrets).
 * Used when image share to WhatsApp is unavailable.
 */
export function buildMatchPassShareText({
  stadiumName,
  fieldName,
  slotLabel,
  bookingCode,
  teamAName,
  teamBName,
} = {}) {
  const place = [escapePlain(stadiumName), escapePlain(fieldName)].filter(Boolean).join(' · ');
  const a = sanitizeShareName(teamAName) || 'Team A';
  const b = sanitizeShareName(teamBName) || 'Team B';
  const code = escapePlain(bookingCode).toUpperCase().replace(/\s+/g, '');
  const when = escapePlain(slotLabel);

  const lines = ['E-Garoon — Match Pass ✓', ''];
  if (place) lines.push(place);
  if (when) lines.push(`Wakhti: ${when}`);
  if (code) lines.push(`Code: ${code}`);
  lines.push(`${a} vs ${b}`, '');
  lines.push(
    'Kaarka QR waa ku jira app-ka (Keydi gallery).',
    'Tus manager-ka albaabka — ha dirin OTP/password.'
  );
  return lines.join('\n');
}
