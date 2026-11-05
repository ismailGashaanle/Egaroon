import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { FiAlertTriangle, FiCloudRain } from 'react-icons/fi';
import { weatherApi } from '../../api/weatherApi';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { useTranslation } from '../../i18n/LanguageContext';

const TONE = {
  caution: 'border-[#D98A3A]/40 bg-[#D98A3A]/10 text-[#7a4e16]',
  poor: 'border-[#a33a32]/35 bg-[#a33a32]/10 text-[#8a2e28]',
  unplayable: 'border-[#a33a32]/50 bg-[#a33a32]/15 text-[#7a1f1a]',
};

function matchesCity(alert, filter) {
  if (!filter) return true;
  const values = Array.isArray(filter) ? filter : String(filter).split(/[\s,]+/);
  const needles = values.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (!needles.length) return true;
  const hay = [alert.city, alert.citySo, alert.slug, alert.region].map((v) => String(v || '').toLowerCase());
  return needles.some((f) => hay.some((s) => s && (s === f || s.includes(f) || f.includes(s))));
}

/**
 * Live play-risk alerts for tracked cities (rain, storm, wind, heat).
 * Hidden when weatherEnabled is off or there is nothing risky.
 */
export default function WeatherAlertStrip({ cityFilter = '', className = '' }) {
  const { weatherEnabled, loaded } = useAuthFeatures();
  const { lang } = useTranslation();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!loaded || !weatherEnabled) {
      setAlerts([]);
      return undefined;
    }
    let cancelled = false;
    weatherApi
      .alerts()
      .then(({ data }) => {
        if (!cancelled) setAlerts(data?.data?.alerts || []);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, weatherEnabled]);

  const visible = useMemo(
    () => (alerts || []).filter((a) => matchesCity(a, cityFilter)),
    [alerts, cityFilter]
  );

  if (!weatherEnabled || !visible.length) return null;

  return (
    <div className={clsx('space-y-2', className)} role="status">
      {visible.map((a) => (
        <div
          key={a.id}
          className={clsx(
            'flex items-start gap-3 rounded-2xl border px-4 py-3',
            TONE[a.level] || TONE.caution
          )}
        >
          {a.level === 'unplayable' ? (
            <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <FiCloudRain className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">
              Digniin cimilo · {a.citySo || a.city}
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {lang === 'en' ? a.headline : a.headlineSo || a.headline}
            </p>
            {a.risks?.[0] ? (
              <p className="mt-0.5 text-xs opacity-80">
                {a.risks[0].titleSo || a.risks[0].title}
                {a.summary?.rainMm != null ? ` · ${Number(a.summary.rainMm).toFixed(1)} mm` : ''}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
