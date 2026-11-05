/** Shared slot helpers for booking pickers (client UI only — server validates availability). */

export function buildSlots(openingTime = '06:00', closingTime = '23:00', durationMinutes = 60) {
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const slots = [];
  let cursor = openH * 60 + openM;
  const end = closeH * 60 + closeM;

  while (cursor + durationMinutes <= end) {
    const startH = Math.floor(cursor / 60);
    const startM = cursor % 60;
    const endCursor = cursor + durationMinutes;
    const endH = Math.floor(endCursor / 60);
    const endM = endCursor % 60;
    slots.push({
      start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    });
    cursor += durationMinutes;
  }
  return slots;
}

export function formatLabel(time24) {
  if (!time24 || typeof time24 !== 'string') return '—';
  const [h, m] = time24.split(':').map(Number);
  if (Number.isNaN(h)) return '—';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')} ${period}`;
}

/**
 * Calendar YYYY-MM-DD from the user's local day (not UTC).
 * Slot hours themselves stay venue wall-clock encoded as UTC clock hours.
 */
export function isoDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Venue wall-clock HH:mm from a slot ISO (`T20:00:00.000Z` → `20:00`). */
export function wallClockHHMM(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Somalia stadium TZ — wall-clock encoded as UTC hours, same as server venueClock. */
export const VENUE_TZ = 'Africa/Mogadishu';

function venuePartNumber(parts, type) {
  return Number(parts.find((p) => p.type === type)?.value);
}

/**
 * Stadium wall-clock "now" as a UTC-encoded Date.
 * 11:07 AM in Mogadishu → `…T11:07:00.000Z` so `T09:00:00.000Z` is past.
 * Does not shift slot ISOs (joogto Friday 20:00 stays T20:00:00.000Z).
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

/** Today's calendar date (YYYY-MM-DD) on the stadium clock — the earliest date anyone can book. */
export function venueTodayIso(from = new Date()) {
  return venueNow(from).toISOString().slice(0, 10);
}

export function venueNowMs(from = Date.now()) {
  return venueNow(from).getTime();
}

/** Live stadium wall-clock + calendar date (Africa/Mogadishu). */
export function venueClockSnapshot(from = new Date()) {
  const now = venueNow(from);
  const time = wallClockHHMM(now);
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  return {
    tz: VENUE_TZ,
    venueNow: now.toISOString(),
    date,
    time,
    timeLabel: formatLabel(time),
  };
}

export function isSlotStartPast(startTime, from = Date.now()) {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return true;
  return start.getTime() <= venueNowMs(from);
}

/** Bari-style display date: DD-MM-YYYY */
export function bariDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Accept ISO YYYY-MM-DD or Bari DD-MM-YYYY → ISO */
/** Booking dates can never be in the past: earlier dates snap to today. */
function clampToToday(iso) {
  const today = venueTodayIso();
  return iso < today ? today : iso;
}

export function parseSearchDate(value) {
  if (!value) return venueTodayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return clampToToday(value);
  const bari = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (bari) {
    const [, dd, mm, yyyy] = bari;
    return clampToToday(`${yyyy}-${mm}-${dd}`);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return clampToToday(isoDate(parsed));
  return venueTodayIso();
}

export function upcomingDates(count = 14) {
  const dates = [];
  // Start from today on the stadium clock, never from a past day.
  const [y, m, d] = venueTodayIso().split('-').map(Number);
  const start = new Date(y, m - 1, d, 12, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function slotRangeOnDate(dateStr, slot) {
  const start = new Date(`${dateStr}T${slot.start}:00.000Z`);
  const end = new Date(`${dateStr}T${slot.end}:00.000Z`);
  return { start, end };
}

export function slotOverlapsBlock(dateStr, slot, block) {
  const { start, end } = slotRangeOnDate(dateStr, slot);
  const blockStart = new Date(block.startsAt);
  const blockEnd = new Date(block.endsAt);
  return start < blockEnd && end > blockStart;
}

export function isRecurringSlot(slot) {
  if (!slot) return false;
  if (slot.labelHint === 'RECURRING' || slot.isRecurring) return true;
  if (slot.state === 'recurring') return true;
  return String(slot.reason || '').startsWith('RECURRING');
}

/** Captains / walk-in may only pick a free hour. Joogto is occupied. */
export function isSlotSelectable(slot) {
  if (!slot) return false;
  if (isRecurringSlot(slot)) return false;
  const s = slot.status || slot.state;
  return s === 'available';
}

export function recurringTeamName(slot) {
  if (!slot) return null;
  if (slot.teamName) return slot.teamName;
  const reason = String(slot.reason || '');
  if (reason.startsWith('RECURRING:')) {
    const name = reason.slice('RECURRING:'.length).trim();
    if (name && name !== 'permanent') return name;
  }
  return null;
}

/**
 * Map server slot payload → UI slot (backend is source of truth).
 * selected/held = temporary lock (not fully paid); booked = paid match OR joogto (weekly team).
 */
export function mapServerSlot(s, clockMs = venueNowMs()) {
  const start = new Date(s.startTime);
  const startLabel = s.startLabel || wallClockHHMM(s.startTime);
  const endLabel = s.endLabel || wallClockHHMM(s.endTime);
  const realNow = Date.now();
  const isPast = s.state === 'past' || start.getTime() <= clockMs;

  // Keep booked / held / blocked even after kickoff so owners can see history
  // vs lost empty hours. Captains still cannot pick any of those states.
  const recurring = isRecurringSlot(s);

  let status = 'available';
  if (recurring) status = 'booked';
  else if (s.state === 'booked') status = 'booked';
  else if (s.state === 'selected' || s.state === 'held') status = 'selected';
  else if (s.state === 'blocked' || s.state === 'recurring') status = 'blocked';
  else if (isPast || s.state === 'past') status = 'past';
  else if (s.state !== 'available') status = 'selected';

  const selectedUntil = s.selectedUntil || s.holdExpiresAt || null;

  // Hold / Team B wait already ended — treat as free (do not show booked/selected).
  if (status === 'selected' && selectedUntil && new Date(selectedUntil).getTime() <= realNow) {
    status = start.getTime() <= clockMs ? 'past' : 'available';
  }

  let holdMinutesLeft = null;
  if (selectedUntil && status === 'selected') {
    holdMinutesLeft = Math.max(0, Math.ceil((new Date(selectedUntil).getTime() - realNow) / 60000));
  }

  const teamName = recurringTeamName(s);

  return {
    start: startLabel,
    end: endLabel,
    status,
    reason: status === 'available' ? null : s.reason,
    labelHint: status === 'available' ? null : s.labelHint,
    labelSo: s.labelSo || null,
    teamName,
    isRecurring: recurring && status !== 'available',
    selectedUntil: status === 'selected' ? selectedUntil : null,
    holdExpiresAt: status === 'selected' ? s.holdExpiresAt || selectedUntil : null,
    holdMinutesLeft,
    startISO: s.startTime,
    endISO: s.endTime,
    pricing: s.pricing || null,
    bookingId: s.bookingId ? String(s.bookingId) : null,
    waitingTeamB: Boolean(s.waitingTeamB),
  };
}

export function getSlotStatuses(dateStr, field, blocks = []) {
  const now = venueNowMs();
  const slots = buildSlots(field?.openingTime, field?.closingTime, field?.slotDurationMinutes || 60);
  return slots.map((slot) => {
    const { start } = slotRangeOnDate(dateStr, slot);
    if (start.getTime() <= now) {
      return { ...slot, status: 'past' };
    }
    const hit = blocks.find((b) => slotOverlapsBlock(dateStr, slot, b));
    if (!hit) return { ...slot, status: 'available' };
    // AvailabilityBlock docs use startsAt; treat anything else as booked hold
    const isOwnerBlock = hit.type || hit.startsAt;
    return { ...slot, status: isOwnerBlock ? 'blocked' : 'booked', reason: hit.type || hit.reason };
  });
}

export function countAvailableSlots(dateStr, field, blocks = []) {
  return getSlotStatuses(dateStr, field, blocks).filter((s) => s.status === 'available').length;
}

export function firstAvailableSlot(dateStr, field, blocks = []) {
  return getSlotStatuses(dateStr, field, blocks).find((s) => s.status === 'available') || null;
}

/**
 * List / card price: what ONE captain pays (their team share).
 * Per-player: capacity × pricePerPlayer
 * Fixed field: fixedPrice / 2
 */
export function estimateTeamShare(field) {
  if (!field) return null;
  if (field.pricingMode === 'per_player') {
    const perSide = Number(field.capacity) || 0;
    const unit = Number(field.pricePerPlayer) || 0;
    return Math.round(unit * perSide * 100) / 100;
  }
  return Math.round((Number(field.fixedPrice || 0) / 2) * 100) / 100;
}

/** Full match (both teams) — for receipts / owner reports only */
export function estimateMatchTotal(field) {
  if (!field) return null;
  if (field.pricingMode === 'per_player') {
    return Math.round(estimateTeamShare(field) * 2 * 100) / 100;
  }
  return Number(field.fixedPrice || 0);
}

/** @deprecated Prefer estimateTeamShareLabel — listings show one-team cost */
export function estimateFieldPrice(field) {
  const share = estimateTeamShare(field);
  if (share == null) return '—';
  return `$${Number(share).toFixed(2)}`;
}

export function estimateTeamShareLabel(field) {
  const share = estimateTeamShare(field);
  if (share == null) return '—';
  return `$${Number(share).toFixed(2)}`;
}

export function formatTeamPricingBreakdown(field, slotPricing = null) {
  const share = estimateTeamShare(field);
  const total = estimateMatchTotal(field);
  if (share == null) return null;

  if (slotPricing && slotPricing.totalPrice != null) {
    const matchTotal = Number(slotPricing.totalPrice);
    const teamShare =
      slotPricing.teamShare != null
        ? Number(slotPricing.teamShare)
        : Math.round((matchTotal / 2) * 100) / 100;
    const baseTotal =
      slotPricing.baseTotalPrice != null ? Number(slotPricing.baseTotalPrice) : matchTotal;
    const discountAmount = Number(slotPricing.discountAmount || 0);
    const discountPercent =
      slotPricing.discountPercent != null ? Number(slotPricing.discountPercent) : null;
    const platformFee = Number(slotPricing.platformFee || 0);
    const payableTeamShare = Number(slotPricing.payableTeamShare ?? (teamShare + platformFee));
    const payableFullMatch = Number(slotPricing.payableFullMatch ?? (matchTotal + platformFee * 2));
    return {
      teamA: payableTeamShare,
      teamB: payableTeamShare,
      rentTeamA: teamShare,
      rentTeamB: teamShare,
      platformFee,
      payableTeamShare,
      payableFullMatch,
      matchTotal,
      baseTotal,
      discountAmount,
      discountPercent,
      discountName: slotPricing.discountName || null,
      hasDiscount: discountAmount > 0 && baseTotal > matchTotal,
      perPlayer: field.pricingMode === 'per_player' ? Number(field.pricePerPlayer || 0) : null,
      capacity: Number(field.capacity) || 0,
      mode: field.pricingMode,
    };
  }

  return {
    teamA: share,
    teamB: share,
    matchTotal: total,
    baseTotal: total,
    discountAmount: 0,
    discountPercent: null,
    discountName: null,
    hasDiscount: false,
    perPlayer: field.pricingMode === 'per_player' ? Number(field.pricePerPlayer || 0) : null,
    capacity: Number(field.capacity) || 0,
    mode: field.pricingMode,
  };
}

/** Stadium area matched the captain's search (city / area / region). */
export function matchedSearchArea(stadium, filters = {}) {
  const needles = [filters.to, filters.from, filters.region]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  if (!needles.length) return null;

  const hay = [
    stadium.area,
    stadium.city,
    stadium.region,
    stadium.location?.area,
    stadium.location?.city,
    stadium.location?.region,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  for (const h of hay) {
    const hl = h.toLowerCase();
    if (needles.some((n) => hl.includes(n) || n.includes(hl))) {
      return h;
    }
  }
  return null;
}

export function formatDurationMinutes(minutes = 60) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
