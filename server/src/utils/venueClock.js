/**
 * E-GAROON venue clock.
 *
 * Field hours and joogto `startTimeLocal` / `endTimeLocal` are venue wall-clock
 * HH:mm (what the stadium clock says). They are encoded as UTC clock hours —
 * not converted from EAT (UTC+3).
 *
 * Owner sets Friday 8:00 PM–9:00 PM → `20:00`–`21:00` → slot ISO
 * `YYYY-MM-DDT20:00:00.000Z`–`T21:00:00.000Z` → the 20:00–21:00 cell.
 *
 * Clients MUST label slots with `startLabel`/`endLabel` or `getUTCHours()`.
 * Never use device/browser local time (`getHours` / `toLocaleTimeString`).
 *
 * Past detection: do NOT compare those stamps to raw Date.now() (real UTC).
 * At 11:07 AM on the stadium clock, real UTC is 08:07 — `T09:00:00.000Z`
 * would still look future. `venueNow()` reads Africa/Mogadishu wall-clock
 * and encodes it the same way as slot hours (`T11:07:00.000Z`) so 09:00
 * and 10:00 expire. Slot ISOs themselves are never EAT-shifted.
 */

const VENUE_TZ = 'Africa/Mogadishu';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function wallClockHHMM(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function formatWallClock12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h)) return null;
  const min = Number.isNaN(m) ? 0 : m;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(min)} ${period}`;
}

function partNumber(parts, type) {
  return Number(parts.find((p) => p.type === type)?.value);
}

/**
 * Stadium wall-clock "now" encoded as a UTC Date (same convention as slot
 * startTime). 11:07 AM in Mogadishu → `…T11:07:00.000Z`.
 */
function venueNow(from = new Date()) {
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

  let hour = partNumber(parts, 'hour');
  if (hour === 24) hour = 0;

  return new Date(
    Date.UTC(
      partNumber(parts, 'year'),
      partNumber(parts, 'month') - 1,
      partNumber(parts, 'day'),
      hour,
      partNumber(parts, 'minute'),
      partNumber(parts, 'second'),
      real.getUTCMilliseconds()
    )
  );
}

function venueNowMs(from = Date.now()) {
  return venueNow(from).getTime();
}

/** True when slot.startTime <= venue now (hour already started or over). */
function isSlotStartPast(startTime, from = new Date()) {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return true;
  return start.getTime() <= venueNow(from).getTime();
}

function venueClockSnapshot(from = new Date()) {
  const now = venueNow(from);
  const time = wallClockHHMM(now);
  const date = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
  return {
    tz: VENUE_TZ,
    venueNow: now.toISOString(),
    date,
    time,
    timeLabel: formatWallClock12(time),
  };
}

module.exports = {
  VENUE_TZ,
  wallClockHHMM,
  formatWallClock12,
  venueNow,
  venueNowMs,
  isSlotStartPast,
  venueClockSnapshot,
};
