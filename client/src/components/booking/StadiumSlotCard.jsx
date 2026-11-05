import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { FiMapPin, FiUsers } from 'react-icons/fi';
import Button from '../common/Button';
import SlotGrid from './SlotGrid';
import BookingSidebar from './BookingSidebar';
import {
  formatLabel,
  formatDurationMinutes,
  firstAvailableSlot,
  estimateTeamShareLabel,
  matchedSearchArea,
  venueNowMs,
} from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';

export default function StadiumSlotCard({
  stadium,
  field,
  date,
  blocks = [],
  serverSlots,
  expanded,
  onToggleExpand,
  fields,
  selectedField,
  onFieldChange,
  selectedSlot,
  onSelectSlot,
  onHoldExpired,
  isAuthenticated,
  isCaptain,
  booking,
  onContinue,
  searchFilters,
}) {
  const { t } = useTranslation();
  const availableCount = Array.isArray(serverSlots)
    ? serverSlots.filter((s) => {
        if (s.state !== 'available') return false;
        return new Date(s.startTime).getTime() > venueNowMs();
      }).length
    : 0;
  const highlightSlot = firstAvailableSlot(date, field, blocks) || {
    start: field.openingTime || '18:00',
    end: field.closingTime || '19:00',
  };
  const duration = field.slotDurationMinutes || 60;
  // List view: one-team cost only (what the booking captain pays)
  const teamPrice = estimateTeamShareLabel(field);
  const areaLabel = [stadium.location?.area || stadium.area, stadium.location?.city || stadium.city]
    .filter(Boolean)
    .join(', ');
  const matched = matchedSearchArea(stadium, searchFilters || {});

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card dark:border-dark-border dark:bg-dark-surface-2">
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-6 lg:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/15 dark:text-dark-primary">
            <FiMapPin size={24} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-charcoal dark:text-dark-text">{stadium.name}</p>
            <p className="truncate text-sm font-semibold text-forest dark:text-dark-primary">{field.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted dark:text-dark-muted">
              <span className="flex items-center gap-1">
                <FiUsers size={12} /> {field.type}
              </span>
              {areaLabel && <span>{areaLabel}</span>}
              {stadium.location?.region || stadium.region ? (
                <span>· {stadium.location?.region || stadium.region}</span>
              ) : null}
              {typeof stadium.distanceKm === 'number' && (
                <span className="font-semibold text-forest dark:text-dark-primary">
                  · {stadium.distanceKm} km
                </span>
              )}
            </p>
            {matched && (
              <span className="mt-1.5 inline-flex rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-green">
                {t('search.matchedArea')} · {matched}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center px-2 lg:max-w-xs">
          <div className="flex w-full items-center gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-charcoal dark:text-dark-text">{formatLabel(highlightSlot.start)}</p>
              <p className="text-[10px] font-medium uppercase text-muted dark:text-dark-muted">Start</p>
            </div>
            <div className="relative flex flex-1 flex-col items-center">
              <span className="text-[10px] font-semibold text-muted dark:text-dark-muted">
                {formatDurationMinutes(duration)}
              </span>
              <div className="mt-1 h-0.5 w-full rounded-full bg-border dark:bg-dark-border">
                <div className="mx-auto h-2 w-2 -translate-y-[3px] rounded-full bg-lime-accent" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-charcoal dark:text-dark-text">{formatLabel(highlightSlot.end)}</p>
              <p className="text-[10px] font-medium uppercase text-muted dark:text-dark-muted">End</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 lg:flex-col lg:items-end">
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {availableCount} {availableCount === 1 ? t('search.slotLeft') : t('search.slotsLeft')}
            </p>
            <p className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{teamPrice}</p>
            <p className="text-[10px] font-medium uppercase text-muted">{t('search.perTeam')}</p>
          </div>
          <Button
            size="sm"
            className={clsx(
              'shrink-0 px-5 uppercase tracking-wide',
              expanded ? 'bg-charcoal text-white hover:bg-charcoal/90' : 'bg-lime-accent text-charcoal hover:bg-lime-accent/90'
            )}
            onClick={onToggleExpand}
          >
            {expanded ? t('search.close') : t('search.viewSlots')}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border dark:border-dark-border"
          >
            <div className="grid gap-6 bg-warmwhite/50 p-4 lg:grid-cols-5 lg:p-6 dark:bg-dark-surface/50">
              <div className="lg:col-span-3">
                <h5 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-charcoal dark:text-dark-text">
                  {t('booking.pickTimeSlot')}
                </h5>
                <SlotGrid
                  field={selectedField || field}
                  date={date}
                  blocks={blocks}
                  serverSlots={serverSlots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={onSelectSlot}
                  onHoldExpired={onHoldExpired}
                />
              </div>
              <div className="lg:col-span-2">
                <BookingSidebar
                  fields={fields}
                  selectedField={selectedField || field}
                  onFieldChange={onFieldChange}
                  selectedSlot={selectedSlot}
                  isAuthenticated={isAuthenticated}
                  isCaptain={isCaptain}
                  loading={booking}
                  onContinue={onContinue}
                  matchedArea={matched}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
