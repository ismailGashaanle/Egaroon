import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiLock } from 'react-icons/fi';
import HoldCountdown from '../booking/HoldCountdown';
import { formatLabel, mapServerSlot, isRecurringSlot, venueNowMs, isSlotStartPast } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { canViewLostSlots } from '../../lib/roles';

/**
 * Compact slot chips. Prefer SlotGrid when serverSlots are available.
 * Marks past, selected (hold / Team B wait), booked (both paid), and owner-blocked.
 * Selected holds show a live countdown and unlock to available when time ends.
 */
export default function SlotPicker({
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

  const baseSlots = useMemo(() => {
    if (!Array.isArray(serverSlots)) return [];
    return serverSlots.map((s) => mapServerSlot(s, clockMs));
  }, [serverSlots, clockMs]);

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

  if (!field) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
      {visibleSlots.map((slot) => {
        const isMineSelected = selectedSlot?.start === slot.start;
        const isLocked =
          slot.status === 'booked' ||
          slot.status === 'selected' ||
          slot.status === 'blocked' ||
          slot.status === 'past';

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

        const expiresAt = slot.selectedUntil || slot.holdExpiresAt;

        const lockedClass = isRecurringSlot(slot)
          ? 'cursor-not-allowed border-indigo-800 bg-indigo-600 text-white'
          : slot.status === 'blocked'
            ? 'cursor-not-allowed border-amber-700 bg-amber-600 text-white'
            : slot.status === 'selected'
              ? 'cursor-not-allowed border-sky-700 bg-sky-600 text-white'
              : slot.status === 'past'
                ? 'cursor-not-allowed border-slate-400 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                : 'cursor-not-allowed border-red-700 bg-red-600 text-white';

        return (
          <SlotPickerChip
            key={slot.start}
            slot={slot}
            isLocked={isLocked}
            isMineSelected={isMineSelected}
            lockLabel={lockLabel}
            lockedClass={lockedClass}
            expiresAt={expiresAt}
            onSelectSlot={onSelectSlot}
            onHoldExpired={handleHoldExpired}
          />
        );
      })}
    </div>
  );
}

function SlotPickerChip({
  slot,
  isLocked,
  isMineSelected,
  lockLabel,
  lockedClass,
  expiresAt,
  onSelectSlot,
  onHoldExpired,
}) {
  const { t } = useTranslation();
  const handleExpired = useCallback(() => {
    onHoldExpired?.(slot);
  }, [onHoldExpired, slot]);

  return (
    <motion.button
      type="button"
      whileTap={isLocked ? undefined : { scale: 0.95 }}
      disabled={isLocked}
      title={
        isLocked
          ? [lockLabel, slot.status === 'selected' ? t('search.payBeforeExpiry') : null]
              .filter(Boolean)
              .join(' — ')
          : undefined
      }
      onClick={() => !isLocked && onSelectSlot(slot)}
      className={clsx(
        'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition-colors sm:px-2 sm:text-sm',
        isLocked && lockedClass,
        !isLocked &&
          isMineSelected &&
          'border-forest bg-forest text-white shadow-soft dark:border-dark-primary dark:bg-dark-primary',
        !isLocked &&
          !isMineSelected &&
          'border-border bg-white text-charcoal hover:border-forest/50 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
      )}
    >
      {isLocked ? (
        <>
          <span className="flex items-center gap-1 text-[10px] font-bold leading-tight">
            <FiLock size={11} className="shrink-0" />
            {lockLabel}
          </span>
          <span className="text-[10px] opacity-90">{formatLabel(slot.start)}</span>
          {slot.status === 'selected' && expiresAt && (
            <HoldCountdown expiresAt={expiresAt} onExpired={handleExpired} compact />
          )}
        </>
      ) : (
        formatLabel(slot.start)
      )}
    </motion.button>
  );
}
