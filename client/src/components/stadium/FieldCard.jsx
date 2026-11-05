import clsx from 'clsx';
import { FiUsers, FiClock, FiCheck } from 'react-icons/fi';
import CldImage from '../common/CldImage';
import { estimateTeamShare } from '../../lib/slotUtils';
import { formatFieldType, hoursLabel, capacityForType } from '../../lib/fieldFormats';
import { useTranslation } from '../../i18n/LanguageContext';

export default function FieldCard({
  field,
  onSelect,
  selected,
  availableCount,
  coverFallback,
}) {
  const { t } = useTranslation();
  const share = estimateTeamShare(field);
  const type = formatFieldType(field.type);
  const capacity = field.capacity || capacityForType(type);
  const hours = hoursLabel(field.openingTime, field.closingTime);
  const cover = field.images?.[0] || coverFallback;
  const offline = field.ops && field.ops.bookable === false;
  const openCount = Number(availableCount) || 0;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(field)}
      className={clsx(
        'w-full overflow-hidden rounded-2xl border bg-white text-left shadow-card transition-all dark:bg-dark-surface-2',
        selected
          ? 'border-forest ring-2 ring-forest dark:border-dark-primary dark:ring-dark-primary'
          : 'border-border hover:-translate-y-0.5 hover:border-forest/40 dark:border-dark-border',
        offline && 'opacity-70'
      )}
    >
      <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-forest/15 to-olive/15">
        {cover ? (
          <CldImage
            src={cover}
            alt={field.name}
            width={480}
            height={224}
            crop
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {type ? (
            <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-extrabold text-white">
              {type}
            </span>
          ) : (
            <span />
          )}
          {offline ? (
            <span className="rounded-full bg-red-700 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
              {t('stadiumDetail.closed')}
            </span>
          ) : availableCount != null ? (
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold',
                openCount > 0
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/90 text-muted dark:bg-dark-surface dark:text-dark-muted'
              )}
            >
              {openCount > 0
                ? t('stadiumDetail.openHours', { n: openCount })
                : t('stadiumDetail.noOpen')}
            </span>
          ) : null}
        </div>
        {selected ? (
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-forest text-white dark:bg-dark-primary">
            <FiCheck size={14} />
          </span>
        ) : null}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-base font-bold text-charcoal dark:text-dark-text">
            {field.name || type}
          </h4>
          {share != null && !offline ? (
            <p className="shrink-0 text-right font-display text-base font-extrabold text-forest dark:text-dark-primary">
              ${Number(share).toFixed(0)}
              <span className="block text-[10px] font-semibold uppercase text-muted">
                {t('search.perTeam')}
              </span>
            </p>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted dark:text-dark-muted">
          {capacity ? (
            <span className="inline-flex items-center gap-1">
              <FiUsers className="text-forest dark:text-dark-primary" />
              {capacity} vs {capacity}
            </span>
          ) : null}
          {hours ? (
            <span className="inline-flex items-center gap-1">
              <FiClock className="text-forest dark:text-dark-primary" />
              {hours}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
