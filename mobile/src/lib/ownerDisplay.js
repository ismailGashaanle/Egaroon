/** Shared display helpers for owner mobile screens. */
import { formatSlotTime } from './dateUtils';

/** JS getDay() → Somali full name (0=Axad … 6=Sabti). */
export const WEEKDAYS_SO = [
  'Axad',
  'Isniin',
  'Talaado',
  'Arbaco',
  'Khamiis',
  'Jimce',
  'Sabti',
];

/** Short labels (same index as getDay). */
export const WEEKDAYS_SO_SHORT = ['Axd', 'Isn', 'Sala', 'Arb', 'Kha', 'Jim', 'Sbti'];

const MONTHS_SO = [
  'Janaayo',
  'Febraayo',
  'Maarso',
  'Abriil',
  'May',
  'Juun',
  'Luuliyo',
  'Agoosto',
  'Sebtembar',
  'Oktoobar',
  'Nofembar',
  'Disembar',
];

const MONTHS_SO_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Lul',
  'Ago',
  'Seb',
  'Okt',
  'Nof',
  'Dis',
];

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Forward booking window: starts at **today (maanta)** — whatever weekday it is —
 * then the next `count - 1` days. Never includes past/expired days.
 * Default 13 days for horizontal overflow scroll.
 */
export function buildForwardDays(count = 13, from = new Date()) {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  const todayKey = ymdLocal(base);
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const jsDay = d.getDay();
    const date = ymdLocal(d);
    days.push({
      date,
      label: WEEKDAYS_SO_SHORT[jsDay] || WEEKDAYS_SO[jsDay],
      labelFull: WEEKDAYS_SO[jsDay],
      dayNum: d.getDate(),
      monthShort: MONTHS_SO_SHORT[d.getMonth()],
      monthFull: MONTHS_SO[d.getMonth()],
      jsDay,
      isToday: date === todayKey,
      offset: i,
    });
  }
  return days;
}

/** @deprecated use buildForwardDays — kept for any callers expecting Sat-start week */
export function buildWeekFromSaturday(from = new Date()) {
  return buildForwardDays(7, from);
}

export function startOfWeekSaturday(from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const daysSinceSat = (day + 1) % 7;
  d.setDate(d.getDate() - daysSinceSat);
  return d;
}

export const WEEK_ORDER_FROM_SABTI = [6, 0, 1, 2, 3, 4, 5];

/** e.g. "Jimce, 25 Agoosto 2026 · 8:00 PM – 9:00 PM" — venue UTC clock, not device TZ. */
export function formatSlotSo(startIso, endIso) {
  if (!startIso) return '—';
  try {
    const s = new Date(startIso);
    if (Number.isNaN(s.getTime())) return String(startIso);
    const day = WEEKDAYS_SO[s.getUTCDay()] || '';
    const month = MONTHS_SO[s.getUTCMonth()] || '';
    const datePart = `${day}, ${s.getUTCDate()} ${month} ${s.getUTCFullYear()}`;
    const t0 = formatSlotTime(startIso);
    const t1 = endIso ? formatSlotTime(endIso) : '';
    return t1 ? `${datePart} · ${t0} – ${t1}` : `${datePart} · ${t0}`;
  } catch {
    return String(startIso);
  }
}

export function stadiumPlace(stadium) {
  if (!stadium) return '';
  const loc = stadium.location || {};
  return (
    [stadium.area || loc.area, stadium.city || loc.city, stadium.region || loc.region]
      .filter(Boolean)
      .join(', ') ||
    stadium.address ||
    loc.address ||
    ''
  );
}

export function coverImage(stadium) {
  const imgs = stadium?.images;
  if (Array.isArray(imgs) && imgs.length) return imgs[0];
  return null;
}

export function fieldPriceLabel(field) {
  const cap = Number(field?.capacity) || 0;
  if (field?.pricingMode === 'fixed') {
    const fixed = Number(field.fixedPrice) || 0;
    return `$${fixed.toFixed(0)} go'an · ${cap}v${cap}`;
  }
  const per = Number(field?.pricePerPlayer) || 0;
  const total = per * cap * 2;
  return `$${per.toFixed(0)}/ciyaaryahan · ${cap}v${cap} · $${total.toFixed(0)} wadarta`;
}

export function hoursLabel(entity) {
  const open = entity?.openingTime;
  const close = entity?.closingTime;
  if (!open && !close) return null;
  return `${open || '—'} – ${close || '—'}`;
}

export function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toFixed(0)}`;
}

export function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export function isSameDay(iso, ref = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/** Navigate to Scan tab from owner/manager stack detail screens. */
export function navigateToScan(navigation, params = {}) {
  const payload = Object.keys(params).length ? params : undefined;
  const state = navigation.getState?.();
  const names = state?.routeNames || [];
  if (names.includes('OwnerTabs')) {
    navigation.navigate('OwnerTabs', { screen: 'Scan', params: payload });
    return;
  }
  if (names.includes('ManagerTabs')) {
    navigation.navigate('ManagerTabs', { screen: 'Scan', params: payload });
    return;
  }
  const parent = navigation.getParent?.();
  if (parent) {
    const pNames = parent.getState?.()?.routeNames || [];
    if (pNames.includes('OwnerTabs')) {
      parent.navigate('OwnerTabs', { screen: 'Scan', params: payload });
      return;
    }
    if (pNames.includes('ManagerTabs')) {
      parent.navigate('ManagerTabs', { screen: 'Scan', params: payload });
      return;
    }
  }
  navigation.goBack();
}
