import { useEffect, useRef, useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { useTranslation } from '../../i18n/LanguageContext';

/** Format remaining ms as mm:ss */
export function formatCountdown(leftMs) {
  const totalSec = Math.max(0, Math.floor(leftMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return {
    totalSec,
    mm: String(m).padStart(2, '0'),
    ss: String(s).padStart(2, '0'),
    label: `${m}:${String(s).padStart(2, '0')}`,
  };
}

/** Live remaining ms until expiresAt; fires onExpired once when ≤ 0. */
export function useHoldRemaining(expiresAt, onExpired) {
  const [leftMs, setLeftMs] = useState(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) {
      setLeftMs(0);
      return undefined;
    }
    firedRef.current = false;
    const tick = () => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setLeftMs(ms);
      if (ms <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  return leftMs;
}

/**
 * Live countdown until holdExpiresAt / selectedUntil — then slot is free for others.
 * compact: tiny mm:ss for slot chips; full: booking details banner.
 */
export default function HoldCountdown({ expiresAt, onExpired, compact = false, showPayHint = true }) {
  const { t } = useTranslation();
  const leftMs = useHoldRemaining(expiresAt, onExpired);
  const { totalSec, label } = formatCountdown(leftMs);
  const urgent = totalSec > 0 && totalSec <= 60;

  if (totalSec <= 0) {
    if (compact) {
      return (
        <span className="text-[9px] font-semibold leading-tight opacity-95">
          {t('search.available')}
        </span>
      );
    }
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-status-cancelled-text">
        <FiClock /> {t('search.holdEnded')}
      </p>
    );
  }

  if (compact) {
    return (
      <span
        className={`flex max-w-full items-center justify-center gap-0.5 text-[9px] font-semibold leading-tight ${
          urgent ? 'opacity-100' : 'opacity-95'
        }`}
        title={t('search.payBeforeExpiry')}
      >
        <FiClock size={9} className="shrink-0" />
        <span className="truncate">{t('search.selectedCountdown', { time: label })}</span>
      </span>
    );
  }

  return (
    <div>
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${
          urgent ? 'text-status-cancelled-text' : 'text-status-pending-text'
        }`}
      >
        <FiClock />
        {t('search.selectedCountdown', { time: label })}
      </p>
      {showPayHint && (
        <p className="mt-1 text-xs text-status-pending-text">{t('search.payBeforeExpiry')}</p>
      )}
    </div>
  );
}
