import { useRef } from 'react';
import clsx from 'clsx';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { isoDate, venueTodayIso } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';

function addDaysIso(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

export default function DateSlider({ dates, selectedDate, onSelectDate }) {
  const { t, lang } = useTranslation();
  const scrollRef = useRef(null);
  const today = venueTodayIso();
  const tomorrow = addDaysIso(today, 1);
  const locale = lang === 'ar' ? 'ar' : lang === 'so' ? 'so-SO' : 'en-GB';

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-white text-charcoal shadow-soft hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
        aria-label="Previous dates"
      >
        <FiChevronLeft />
      </button>

      <div ref={scrollRef} className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {dates.map((d) => {
          const value = isoDate(d);
          const selected = selectedDate === value;
          const isToday = value === today;
          const isTomorrow = value === tomorrow;
          const weekday = isToday
            ? t('search.today')
            : isTomorrow
              ? t('search.tomorrow')
              : d.toLocaleDateString(locale, { weekday: 'short' });
          const month = d.toLocaleDateString(locale, { month: 'short' });

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelectDate(value)}
              className={clsx(
                'flex w-[4.6rem] shrink-0 flex-col items-center rounded-2xl border px-1.5 py-2.5 text-center transition-all',
                selected
                  ? 'border-forest bg-forest text-white shadow-soft dark:border-dark-primary dark:bg-dark-primary'
                  : isToday
                    ? 'border-forest/50 bg-forest/10 text-charcoal dark:border-dark-primary/50 dark:bg-dark-primary/10 dark:text-dark-text'
                    : 'border-border bg-white text-charcoal hover:border-forest/50 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
              )}
            >
              <span
                className={clsx(
                  'text-[10px] font-bold uppercase tracking-wide',
                  selected ? 'text-white/85' : 'text-muted dark:text-dark-muted'
                )}
              >
                {weekday}
              </span>
              <span className="mt-0.5 font-display text-xl font-black leading-none">{d.getDate()}</span>
              <span
                className={clsx(
                  'mt-0.5 text-[10px] font-semibold',
                  selected ? 'text-white/80' : 'text-muted dark:text-dark-muted'
                )}
              >
                {month}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scroll(1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-white text-charcoal shadow-soft hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
        aria-label="Next dates"
      >
        <FiChevronRight />
      </button>
    </div>
  );
}
