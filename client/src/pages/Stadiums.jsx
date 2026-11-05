import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiMapPin, FiSearch, FiSliders } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import StadiumCard from '../components/stadium/StadiumCard';
import CityChips from '../components/stadium/CityChips';
import FiltersModal from '../components/stadium/FiltersModal';
import EmptyState from '../components/common/EmptyState';
import WeatherAlertStrip from '../components/weather/WeatherAlertStrip';
import { fetchStadiums } from '../features/stadiums/stadiumSlice';
import { useTranslation } from '../i18n/LanguageContext';

export default function Stadiums() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { items: stadiums, status, meta } = useSelector((state) => state.stadiums);
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [cityFilter, setCityFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchStadiums({ city: searchParams.get('city') || undefined }));
  }, [dispatch, searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCityFilter('');
    dispatch(fetchStadiums({ city: city || undefined }));
  };

  const visibleStadiums = useMemo(
    () => (cityFilter ? stadiums.filter((s) => s.location?.city === cityFilter) : stadiums),
    [stadiums, cityFilter]
  );

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal dark:text-dark-text">Browse Fields</h1>
          <p className="mt-1.5 text-muted dark:text-dark-muted">Browse approved stadiums and pick a field to book.</p>
        </div>
        <Button variant="outline" size="sm" className="min-h-[44px]" icon={<FiSliders />} onClick={() => setFiltersOpen(true)}>
          {t('search.toggleFilters')}
        </Button>
      </div>

      <form onSubmit={handleSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          icon={<FiMapPin />}
          placeholder="e.g. Hargeisa, Somaliland"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Button type="submit" icon={<FiSearch />}>
          Search
        </Button>
      </form>

      <div className="mt-6">
        <CityChips stadiums={stadiums} active={cityFilter} onChange={setCityFilter} />
      </div>

      <WeatherAlertStrip cityFilter={cityFilter || city} className="mt-6" />

      <div className="mt-8">
        {status === 'loading' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-border/50 dark:bg-dark-border/40" />
            ))}
          </div>
        )}

        {status !== 'loading' && visibleStadiums.length === 0 && (
          <EmptyState
            icon={<FiMapPin size={22} />}
            title="No stadiums found"
            description="Try a different city, or check back soon as more stadiums get verified."
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStadiums.map((stadium) => (
            <StadiumCard key={stadium._id} stadium={stadium} />
          ))}
        </div>
      </div>

      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} priceBands={meta?.priceBands} />
    </PageTransition>
  );
}
