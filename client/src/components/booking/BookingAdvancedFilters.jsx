import clsx from 'clsx';
import { FiX, FiSearch } from 'react-icons/fi';
import { FIELD_TYPES } from '../../lib/fieldFormats';
import { useTranslation } from '../../i18n/LanguageContext';

export const SEARCH_FACILITIES = ['parking', 'lighting', 'showers', 'seating', 'changing_rooms', 'cafeteria'];
export const RADIUS_OPTIONS_KM = [5, 10, 20, 30];

const selectClass =
  'mt-1 block w-full rounded-xl border border-border bg-white px-3 py-3 text-base font-medium text-charcoal shadow-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text';

/**
 * Advanced browse filters as a simple labeled form (dropdowns, not chips).
 */
export default function BookingAdvancedFilters({
  filters,
  onChange,
  onClear,
  priceBands,
  nearMeActive,
  onSearch,
  showSearchButton = false,
  className,
}) {
  const { t } = useTranslation();
  const types = filters.types || [];
  const facilities = filters.facilities || [];
  const lowMax = priceBands?.lowMax ?? 20;
  const midMax = priceBands?.midMax ?? 40;

  const selectedType = types.length === 1 ? types[0] : '';
  const selectedFacility = facilities.length === 1 ? facilities[0] : '';

  const hasAdvanced =
    filters.priceBand ||
    filters.minPrice ||
    filters.maxPrice ||
    types.length ||
    facilities.length ||
    filters.openNow ||
    (filters.sort && filters.sort !== 'newest') ||
    nearMeActive ||
    (filters.radiusKm && filters.radiusKm !== 20);

  return (
    <div className={clsx('space-y-4 p-3 sm:p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-charcoal dark:text-dark-text">
          {t('search.advancedFiltersTitle')}
        </p>
        {hasAdvanced && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-forest hover:bg-forest/5 dark:text-dark-primary"
          >
            <FiX size={16} />
            {t('search.clearFilters')}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-charcoal dark:text-dark-text">
          {t('search.priceBand')}
          <select
            value={filters.priceBand || ''}
            onChange={(e) => onChange({ priceBand: e.target.value, minPrice: '', maxPrice: '' })}
            className={selectClass}
          >
            <option value="">{t('search.anyPrice')}</option>
            <option value="low">
              {t('search.priceLow')} (≤${lowMax})
            </option>
            <option value="mid">
              {t('search.priceMid')} (${lowMax}–${midMax})
            </option>
            <option value="high">
              {t('search.priceHigh')} (&gt;${midMax})
            </option>
          </select>
        </label>

        <label className="block text-sm font-medium text-charcoal dark:text-dark-text">
          {t('search.format')}
          <select
            value={selectedType}
            onChange={(e) => onChange({ types: e.target.value ? [e.target.value] : [] })}
            className={selectClass}
          >
            <option value="">{t('search.anyFormat')}</option>
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {ft}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted dark:text-dark-muted">
            {t('search.formatHint')}
          </span>
        </label>

        <label className="block text-sm font-medium text-charcoal dark:text-dark-text">
          {t('search.radius')}
          <select
            value={filters.radiusKm || 20}
            onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
            className={selectClass}
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {t('search.radiusUpTo', { km })}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted dark:text-dark-muted">
            {nearMeActive ? t('search.radiusNearMeActive') : t('search.radiusHint')}
          </span>
        </label>

        <label className="block text-sm font-medium text-charcoal dark:text-dark-text">
          {t('search.sort')}
          <select
            value={filters.sort || 'newest'}
            onChange={(e) => onChange({ sort: e.target.value })}
            className={selectClass}
          >
            <option value="newest">{t('search.sortNewest')}</option>
            <option value="nearest">{t('search.sortNearest')}</option>
            <option value="price_asc">{t('search.sortPriceAsc')}</option>
            <option value="price_desc">{t('search.sortPriceDesc')}</option>
            <option value="rating">{t('search.sortRating')}</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-charcoal dark:text-dark-text sm:col-span-2">
          {t('search.facilities')}
          <select
            value={selectedFacility}
            onChange={(e) => onChange({ facilities: e.target.value ? [e.target.value] : [] })}
            className={selectClass}
          >
            <option value="">{t('search.anyFacility')}</option>
            {SEARCH_FACILITIES.map((f) => (
              <option key={f} value={f}>
                {t(`search.facility.${f}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-white px-3 py-3 text-sm font-medium text-charcoal dark:border-dark-border dark:bg-dark-surface dark:text-dark-text">
        <input
          type="checkbox"
          checked={Boolean(filters.openNow)}
          onChange={(e) => onChange({ openNow: e.target.checked })}
          className="h-5 w-5 shrink-0 rounded border-border text-forest focus:ring-forest"
        />
        {t('search.openNow')}
      </label>

      {showSearchButton && onSearch && (
        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="focus-ring inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 text-base font-bold text-white transition-colors hover:bg-black sm:w-auto"
        >
          <FiSearch size={18} />
          {t('search.search')}
        </button>
      )}
    </div>
  );
}
