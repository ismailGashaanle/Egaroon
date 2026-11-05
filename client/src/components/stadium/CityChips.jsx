import clsx from 'clsx';

const FEATURED_CITIES = ['Hargeisa', 'Berbera', 'Boroma', 'Burao'];

export default function CityChips({ stadiums = [], active, onChange }) {
  const extra = Array.from(
    new Set(stadiums.map((s) => s.location?.city).filter((city) => city && !FEATURED_CITIES.includes(city)))
  ).sort();
  const cities = [...FEATURED_CITIES, ...extra];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange('')}
        className={clsx(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          !active
            ? 'bg-forest text-white dark:bg-dark-primary'
            : 'bg-warmwhite text-muted hover:text-charcoal dark:bg-dark-surface-2 dark:text-dark-muted dark:hover:text-dark-text'
        )}
      >
        All
      </button>
      {cities.map((city) => (
        <button
          key={city}
          type="button"
          onClick={() => onChange(city)}
          className={clsx(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            active === city
              ? 'bg-forest text-white dark:bg-dark-primary'
              : 'bg-warmwhite text-muted hover:text-charcoal dark:bg-dark-surface-2 dark:text-dark-muted dark:hover:text-dark-text'
          )}
        >
          {city}
        </button>
      ))}
    </div>
  );
}
