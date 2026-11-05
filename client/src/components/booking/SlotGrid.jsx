import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { FiCheck, FiLock } from 'react-icons/fi';
import HoldCountdown from './HoldCountdown';
import { formatLabel, mapServerSlot, isRecurringSlot, venueNowMs, isSlotStartPast } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { canViewLostSlots } from '../../lib/roles';

function lockStyles(status, isRecurring) {
  if (isRecurring) {
    return 'cursor-not-allowed border-indigo-800 bg-indigo-600 text-white shadow-sm';
  }
  if (status === 'blocked') {
    return 'cursor-not-allowed border-amber-700 bg-amber-600 text-white shadow-sm';
  }
  if (status === 'selected') {
    return 'cursor-not-allowed border-sky-700 bg-sky-600 text-white shadow-sm';
  }
  if (status === 'past') {
    return 'cursor-not-allowed border-slate-400 bg-slate-200 text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';
  }
  return 'cursor-not-allowed border-red-700 bg-red-600 text-white shadow-sm';
}

function SelectedSlotCell({
  slot,
  isMineSelected,
  lockLabel,
  onSelectSlot,
  onHoldExpired,
}) {
  const { t } = useTranslation();
  const expiresAt = slot.selectedUntil || slot.holdExpiresAt;

  const handleExpired = useCallback(() => {
    onHoldExpired?.(slot);
  }, [onHoldExpired, slot]);

  const isLocked =
    slot.status === 'booked' ||
    slot.status === 'selected' ||
    slot.status === 'blocked' ||
    slot.status === 'past';

  const title = isLocked
    ? [lockLabel, expiresAt ? t('search.payBeforeExpiry') : null, slot.reason].filter(Boolean).join(' — ')
    : undefined;

  return (
    <button
      type="button"
      disabled={isLocked}
      title={title}
      onClick={() => !isLocked && onSelectSlot(slot)}
      className={clsx(
        'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-transform active:scale-95',
        isLocked && lockStyles(slot.status, isRecurringSlot(slot)),
        !isLocked && isMineSelected && 'border-orange-600 bg-orange-500 text-white shadow-sm',
        !isLocked &&
          !isMineSelected &&
          'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-200'
      )}
    >
      {isLocked ? (
        <>
          <span className="flex items-center gap-1 text-[11px] font-bold leading-tight">
            <FiLock size={12} className="shrink-0" />
            {lockLabel}
          </span>
          <span className="text-[10px] font-semibold opacity-90">{formatLabel(slot.start)}</span>
          {slot.status === 'selected' && expiresAt && (
            <HoldCountdown expiresAt={expiresAt} onExpired={handleExpired} compact />
          )}
        </>
      ) : (
        <>
          <span className="text-xs font-bold">{formatLabel(slot.start)}</span>
          {slot.pricing?.discountAmount > 0 && (
            <span
              className={clsx(
                'text-[10px] font-semibold',
                !isMineSelected && 'text-emerald-700 dark:text-emerald-300'
              )}
            >
              ${Number(slot.pricing.teamShare).toFixed(0)}
            </span>
          )}
          {isMineSelected && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold opacity-90">
              <FiCheck size={11} /> {t('search.selected')}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export default function SlotGrid({
  field,
  date,
  blocks = [],
  serverSlots,
  selectedSlot,
  onSelectSlot,
  onHoldExpired,
  showLostSlots,
}) {
  const { t } = useTranslation();
  const { role } = useAuth();
  const showLost = showLostSlots ?? canViewLostSlots(role);
  const [unlockedStarts, setUnlockedStarts] = useState(() => new Set());
  const [clockMs, setClockMs] = useState(() => venueNowMs());
  const toastedRef = useRef(new Set());

  useEffect(() => {
    const id = setInterval(() => setClockMs(venueNowMs()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setUnlockedStarts(new Set());
    toastedRef.current = new Set();
  }, [serverSlots, date, field?._id]);

  // Server payload only — never invent green hours if the API failed or has not loaded.
  const baseSlots = useMemo(
    () => (Array.isArray(serverSlots) ? serverSlots.map((s) => mapServerSlot(s, clockMs)) : []),
    [serverSlots, clockMs]
  );

  const slots = useMemo(
    () =>
      baseSlots.map((slot) => {
        if (unlockedStarts.has(slot.start) && slot.status === 'selected') {
          const past = isSlotStartPast(slot.startISO, clockMs);
          return {
            ...slot,
            status: past ? 'past' : 'available',
            selectedUntil: null,
            holdExpiresAt: null,
            holdMinutesLeft: null,
            labelHint: null,
            reason: null,
          };
        }
        return slot;
      }),
    [baseSlots, unlockedStarts, clockMs]
  );

  const visibleSlots = useMemo(
    () => (showLost ? slots : slots.filter((s) => s.status !== 'past')),
    [slots, showLost]
  );

  useEffect(() => {
    if (showLost || !selectedSlot) return;
    const stillOpen = visibleSlots.some((s) => s.start === selectedSlot.start);
    if (!stillOpen) onSelectSlot?.(null);
  }, [showLost, selectedSlot, visibleSlots, onSelectSlot]);

  const handleHoldExpired = useCallback(
    (slot) => {
      const already = toastedRef.current.has(slot.start);
      if (!already) {
        toastedRef.current.add(slot.start);
        toast(t('search.holdEnded'));
      }
      setUnlockedStarts((prev) => {
        if (prev.has(slot.start)) return prev;
        const next = new Set(prev);
        next.add(slot.start);
        return next;
      });
      if (!already) onHoldExpired?.(slot);
    },
    [onHoldExpired, t]
  );

  const legend = [
    {
      key: 'available',
      label: t('search.available'),
      className: 'bg-emerald-500 border-emerald-600',
    },
    {
      key: 'selected',
      label: t('search.dooran'),
      className: 'bg-sky-600 border-sky-700',
    },
    {
      key: 'booked',
      label: t('search.booked'),
      className: 'bg-red-600 border-red-700',
    },
    {
      key: 'blocked',
      label: t('search.blocked'),
      className: 'bg-amber-600 border-amber-700',
    },
    {
      key: 'weekly',
      label: t('search.weeklyTeam'),
      className: 'bg-indigo-600 border-indigo-800',
    },
  ];
  if (showLost) {
    legend.push({
      key: 'past',
      label: t('search.past'),
      className: 'bg-slate-400 border-slate-500',
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        {legend.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs font-medium text-muted dark:text-dark-muted">
            <span className={clsx('h-4 w-4 rounded border', item.className)} />
            {item.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleSlots.map((slot) => {
          const isMineSelected = selectedSlot?.start === slot.start;

          let lockLabel = t('search.booked');
          if (isRecurringSlot(slot)) {
            lockLabel =
              slot.labelSo ||
              (slot.teamName
                ? `${t('search.weeklyTeam')} · ${slot.teamName}`
                : t('search.weeklyTeam'));
          } else if (slot.status === 'past') lockLabel = t('search.past');
          else if (slot.status === 'blocked') lockLabel = t('search.blocked');
          else if (slot.status === 'selected') lockLabel = t('search.dooran');

          return (
            <SelectedSlotCell
              key={slot.start}
              slot={slot}
              isMineSelected={isMineSelected}
              lockLabel={lockLabel}
              onSelectSlot={onSelectSlot}
              onHoldExpired={handleHoldExpired}
            />
          );
        })}
      </div>

      {visibleSlots.length === 0 && (
        <p className="text-sm text-muted dark:text-dark-muted">{t('search.noOpenHours')}</p>
      )}
    </div>
  );
}
