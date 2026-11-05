/** E-GAROON brand — used on owner reports (not hotel teal/gold). */
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
  if (Number.isNaN(n)) return String(hour ?? '');
  const suffix = n >= 12 ? 'PM' : 'AM';
  const hr = n % 12 || 12;
  return `${hr}${suffix}`;
}

export function money(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
