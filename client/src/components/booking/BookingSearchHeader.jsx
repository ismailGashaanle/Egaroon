import { venueTodayIso } from '../../lib/slotUtils';
import { useState } from 'react';
import { FiSearch, FiMapPin, FiRefreshCw, FiNavigation, FiSliders, FiChevronUp } from 'react-icons/fi';
import Input from '../common/Input';
import Button from '../common/Button';
import BookingAdvancedFilters from './BookingAdvancedFilters';
import { useTranslation } from '../../i18n/LanguageContext';

/**
 * Search: city, area/neighborhood, region, date + near-me GPS + collapsible advanced filters.
 */
export default function BookingSearchHeader({
  filters,
  onChange,
  onSearch,
  onNearMe,
  locating,
  onClearAdvanced,
  priceBands,
  nearMeActive,
}) {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  const swapFromTo = () => {
    onChange({ from: filters.to || '', to: filters.from || '' });
  };

  const hasAdvancedHint =
    filters.priceBand ||
    (filters.types && filters.types.length) ||
    (filters.facilities && filters.facilities.length) ||
    filters.openNow ||
    (filters.sort && filters.sort !== 'newest') ||
    nearMeActive;

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl bg-brand-gradient shadow-lifted"
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2 sm:p-4">
        <div className="relative min-w-0 flex-1 basis-[140px]">
          <Input
            label={t('search.city')}
            icon={<FiMapPin />}
            placeholder="Hargeisa"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            containerClassName="[&_label]:text-white/90"
            className="border-transparent bg-white font-medium"
          />
        </div>

        <button
          type="button"
          onClick={swapFromTo}
          title="Swap"
          className="focus-ring mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-navy shadow sm:mb-0.5 sm:self-end"
        >
          <FiRefreshCw size={16} />
        </button>

        <div className="min-w-0 flex-1 basis-[140px]">
          <Input
            label={t('search.area')}
            icon={<FiMapPin />}
            placeholder="Hodan / Wadnaha"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            containerClassName="[&_label]:text-white/90"
            className="border-transparent bg-white font-medium"
          />
        </div>

        <div className="min-w-0 flex-1 basis-[120px]">
          <Input
            label={t('search.region')}
            icon={<FiMapPin />}
            placeholder="Banadir"
            value={filters.region || ''}
            onChange={(e) => onChange({ region: e.target.value })}
            containerClassName="[&_label]:text-white/90"
            className="border-transparent bg-white font-medium"
          />
        </div>

        <div className="min-w-0 flex-1 basis-[140px]">
          <Input
            label={t('search.matchDate')}
            type="date"
            min={venueTodayIso()}
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value && e.target.value < venueTodayIso() ? venueTodayIso() : e.target.value })}
            containerClassName="[&_label]:text-white/90"
            className="border-transparent bg-white font-medium"
          />
        </div>

        <button
          type="submit"
          className="focus-ring inline-flex min-h-[44px] h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-navy px-8 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-black sm:mb-0.5"
        >
          <FiSearch size={16} />
          {t('search.search')}
        </button>
      </div>

      <div className="border-t border-white/20 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {onNearMe && (
            <Button
              type="button"
              size="md"
              variant="outline"
              className="min-h-[44px] border-white/40 bg-white/10 text-white hover:bg-white/20"
              icon={<FiNavigation />}
              loading={locating}
              onClick={onNearMe}
            >
              {t('search.nearMe')}
            </Button>
          )}

          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? <FiChevronUp size={18} /> : <FiSliders size={16} />}
            {t('search.toggleFilters')}
            {hasAdvancedHint && !advancedOpen && (
              <span className="h-2 w-2 rounded-full bg-brand-green" aria-hidden />
            )}
          </button>

          {nearMeActive && (
            <span className="text-sm font-medium text-white/90">
              {t('search.usingGps')} · {t('search.radiusUpTo', { km: filters.radiusKm || 20 })}
            </span>
          )}
        </div>

        {advancedOpen && (
          <div className="mt-3 rounded-xl bg-white/95 dark:bg-dark-surface/95">
            <BookingAdvancedFilters
              filters={filters}
              onChange={onChange}
              onClear={onClearAdvanced}
              priceBands={priceBands}
              nearMeActive={nearMeActive}
              onSearch={onSearch}
              showSearchButton
            />
          </div>
        )}
      </div>
    </form>
  );
}
