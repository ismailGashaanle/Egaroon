/** YYYY-MM-DD from Date (local calendar day). */
export function toIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toIsoDate(dt);
}

/** Chip label: Maanta / Berri / weekday short. */
export function dateChipLabel(iso) {
  const today = toIsoDate();
  const tomorrow = addDaysIso(today, 1);
  if (iso === today) return 'Maanta';
  if (iso === tomorrow) return 'Berri';
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('so-SO', { weekday: 'short', day: 'numeric' });
}

export function buildDateStrip(fromIso = toIsoDate(), count = 13) {
  return Array.from({ length: count }, (_, i) => addDaysIso(fromIso, i));
}

export function countOpenSlots(slots, from = Date.now()) {
  return (slots || []).filter((s) => effectiveSlotState(s, from) === 'available').length;
}

/** Venue wall-clock HH:mm from slot ISO (`T20:00:00.000Z` → `20:00`). Never device TZ. */
export function wallClockHHMM(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function formatLabel12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—';
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h)) return '—';
  const min = Number.isNaN(m) ? 0 : m;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}

/**
 * Slot cell time. Prefer server `startLabel` (venue wall clock).
 * Fallback: UTC hours of the ISO — same convention as web mapServerSlot.
 */
export function formatSlotTime(iso, startLabel) {
  const hhmm =
    startLabel && /^\d{1,2}:\d{2}$/.test(String(startLabel).trim())
      ? String(startLabel).trim()
      : wallClockHHMM(iso);
  return formatLabel12(hhmm);
}

export function formatMoney(n, currency = 'USD') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const cur = String(currency || 'USD').toUpperCase();
  if (cur === 'SLL' || cur === 'SLSH') {
    return `${Number(n || 0).toLocaleString()} SlSh`;
  }
  return `$${Number(n || 0).toFixed(2)}`;
}

export function formatSll(n) {
  return `${Number(n || 0).toLocaleString()} SlSh`;
}

export function formatDualMoney(amountUsd, sllPerUsd = 8500) {
  const usd = Number(amountUsd || 0);
  const sll = Math.round(usd * Number(sllPerUsd || 8500));
  return `$${usd.toFixed(2)} (${sll.toLocaleString()} SlSh)`;
}

/** Somalia stadium TZ — wall-clock encoded as UTC hours (same as web/server). */
export const VENUE_TZ = 'Africa/Mogadishu';

function venuePartNumber(parts, type) {
  return Number(parts.find((p) => p.type === type)?.value);
}

/**
 * Stadium wall-clock "now" as a UTC-encoded Date.
 * 11:07 AM in Mogadishu → `…T11:07:00.000Z` so `T09:00:00.000Z` is past.
 */
export function venueNow(from = new Date()) {
  const real = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(real.getTime())) return new Date(NaN);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VENUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(real);
  let hour = venuePartNumber(parts, 'hour');
  if (hour === 24) hour = 0;
  return new Date(
    Date.UTC(
      venuePartNumber(parts, 'year'),
      venuePartNumber(parts, 'month') - 1,
      venuePartNumber(parts, 'day'),
      hour,
      venuePartNumber(parts, 'minute'),
      venuePartNumber(parts, 'second'),
      real.getUTCMilliseconds()
    )
  );
}

export function venueNowMs(from = Date.now()) {
  return venueNow(from).getTime();
}

/** Live stadium wall-clock + calendar date (Africa/Mogadishu). */
export function venueClockSnapshot(from = new Date()) {
  const now = venueNow(from);
  const time = wallClockHHMM(now);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return {
    tz: VENUE_TZ,
    venueNow: now.toISOString(),
    date: `${y}-${m}-${d}`,
    time,
    timeLabel: formatLabel12(time),
  };
}

export function isSlotStartPast(startTime, from = Date.now()) {
  if (!startTime) return false;
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return true;
  return start.getTime() <= venueNowMs(from);
}

/**
 * Occupied states stay occupied. Empty hours whose start <= venue now become past.
 */
export function effectiveSlotState(slot, from = Date.now()) {
  if (!slot) return 'available';
  const state = slot.state || slot.status;
  if (state === 'booked' || state === 'selected' || state === 'blocked' || state === 'held') {
    return state === 'held' ? 'selected' : state;
  }
  if (state === 'past' || isSlotStartPast(slot.startTime || slot.start, from)) return 'past';
  return state || 'available';
}
