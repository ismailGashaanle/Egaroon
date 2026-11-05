/** Same palette as web `client/src/components/owner/reportBrand.js`. */
export const REPORT_BRAND = {
  forest: '#176B45',
  warm: '#F7F6F1',
  charcoal: '#18201C',
  olive: '#6B8E3A',
  orange: '#D98A3A',
};

export function formatChartDay(raw) {
  const s = String(raw || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
  return s.length > 6 ? s.slice(-5) : s;
}

export function formatHourLabel(hour) {
  const n = Number(hour);
  if (Number.isNaN(n)) {
    const s = String(hour ?? '');
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const h = Number(s.split(':')[0]);
      if (!Number.isNaN(h)) return formatHourLabel(h);
    }
    return s;
  }
  const suffix = n >= 12 ? 'PM' : 'AM';
  const hr = n % 12 || 12;
  return `${hr}${suffix}`;
}

const STATUS_SO = {
  HELD: 'Dooran',
  PAYMENT_PENDING: 'Sugaya lacag',
  PENDING: 'Sugaya',
  CONFIRMED: 'Kiraystay',
  CHECKED_IN: 'Check-in',
  IN_PROGRESS: 'Socda',
  COMPLETED: 'Dhammaystay',
  SETTLED: 'Settled',
  SUCCESS: 'La bixiyay',
  APPROVED: 'Oggolaaday',
  ACTIVE: 'Active',
  EXPIRED: 'Dhacay',
  CANCELLED: 'Joojiyay',
  NO_SHOW: 'No-show',
  FAILED: 'Fashilmay',
  REJECTED: 'Diiday',
  SUSPENDED: 'Xanniban',
  DISPUTED: 'Muransan',
  PROCESSING: 'Socda',
  REFUNDED: 'Celis',
};

export function labelForStatus(status) {
  const key = String(status || '').toUpperCase();
  return STATUS_SO[key] || status || '—';
}

export function statusTone(status) {
  const group = String(status || '').toUpperCase();
  if (/CANCEL|EXPIRE|NO_SHOW|FAIL|REJECT/.test(group)) return REPORT_BRAND.orange;
  if (/HOLD|PEND/.test(group)) return REPORT_BRAND.olive;
  return REPORT_BRAND.forest;
}
