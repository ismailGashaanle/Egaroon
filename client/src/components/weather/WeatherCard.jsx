import clsx from 'clsx';
import { FiCloudRain, FiSun, FiWind, FiAlertTriangle, FiThermometer, FiDroplet } from 'react-icons/fi';

const PLAY = {
  good: 'bg-[#176B45]/10 text-[#176B45] dark:bg-[#176B45]/20 dark:text-[#7dcaa6]',
  caution: 'bg-[#D98A3A]/15 text-[#94652a] dark:text-[#e8b06a]',
  poor: 'bg-[#a33a32]/12 text-[#a33a32]',
  unplayable: 'bg-[#a33a32]/18 text-[#a33a32]',
};

function n(v, suffix = '') {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Math.round(Number(v))}${suffix}`;
}

export default function WeatherCard({ weather, compact = false, className = '' }) {
  if (!weather?.summary) return null;
  const s = weather.summary;
  const play = weather.play || {};
  const place = weather.place || {};
  const Icon = Number(s.rainMm) >= 1 || Number(s.rainChance) >= 40 ? FiCloudRain : FiSun;

  return (
    <section
      className={clsx(
        'rounded-2xl border border-black/[0.05] bg-white p-4 shadow-card dark:border-dark-border dark:bg-dark-surface',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#176B45] dark:text-dark-primary">
            Cimilada · {weather.date}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[#18201C] dark:text-dark-text">
            {place.name || place.city || 'Goobta'}
            {place.region ? ` · ${place.region}` : ''}
          </p>
        </div>
        <span
          className={clsx(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
            PLAY[play.level] || PLAY.good
          )}
        >
          {play.labelSo || play.label || '—'}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <Icon className="mb-1 h-8 w-8 text-[#176B45] dark:text-dark-primary" />
        <p className="font-display text-3xl font-bold leading-none text-[#18201C] dark:text-dark-text">
          {n(s.tempMax, '°')}
          <span className="ms-1 text-base font-semibold text-muted">/ {n(s.tempMin, '°')}</span>
        </p>
        <p className="mb-0.5 text-sm font-medium text-muted dark:text-dark-muted">
          {s.conditionSo || s.condition}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-[#F7F6F1] px-2.5 py-2 dark:bg-dark-surface-2">
          <dt className="flex items-center gap-1 text-muted">
            <FiDroplet /> Roob
          </dt>
          <dd className="mt-0.5 font-bold text-[#18201C] dark:text-dark-text">
            {s.rainMm != null ? `${Number(s.rainMm).toFixed(1)} mm` : '—'}
            {s.rainChance != null ? ` · ${n(s.rainChance, '%')}` : ''}
          </dd>
        </div>
        <div className="rounded-xl bg-[#F7F6F1] px-2.5 py-2 dark:bg-dark-surface-2">
          <dt className="flex items-center gap-1 text-muted">
            <FiWind /> Dabayl
          </dt>
          <dd className="mt-0.5 font-bold text-[#18201C] dark:text-dark-text">{n(s.windKmh, ' km/h')}</dd>
        </div>
        <div className="rounded-xl bg-[#F7F6F1] px-2.5 py-2 dark:bg-dark-surface-2">
          <dt className="flex items-center gap-1 text-muted">
            <FiThermometer /> Dareen
          </dt>
          <dd className="mt-0.5 font-bold text-[#18201C] dark:text-dark-text">{n(s.feelsMax ?? s.tempNow, '°')}</dd>
        </div>
      </dl>

      {!compact && weather.risks?.length ? (
        <ul className="mt-3 space-y-1.5">
          {weather.risks.map((r) => (
            <li
              key={r.code}
              className="flex items-start gap-2 text-sm text-[#18201C] dark:text-dark-text"
            >
              <FiAlertTriangle
                className={clsx(
                  'mt-0.5 shrink-0',
                  r.severity === 'high' ? 'text-[#a33a32]' : 'text-[#D98A3A]'
                )}
              />
              <span>
                <span className="font-semibold">{r.titleSo || r.title}</span>
                {r.detail ? <span className="text-muted"> — {r.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!compact && weather.hours?.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {weather.hours
            .filter((h) => h.hour % 3 === 0)
            .map((h) => (
              <div
                key={h.time}
                className="min-w-[4.25rem] rounded-xl bg-[#F7F6F1] px-2 py-2 text-center dark:bg-dark-surface-2"
              >
                <p className="text-[10px] font-bold text-muted">{String(h.hour).padStart(2, '0')}:00</p>
                <p className="text-sm font-extrabold text-[#18201C] dark:text-dark-text">{n(h.temp, '°')}</p>
                <p className="text-[10px] text-muted">{h.rainMm ? `${Number(h.rainMm).toFixed(1)}mm` : '—'}</p>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
