import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSliders } from 'react-icons/fi';
import Modal from '../common/Modal';
import Button from '../common/Button';
import BookingAdvancedFilters from '../booking/BookingAdvancedFilters';
import { bariDate } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';

/**
 * Browse-page filters → navigate to /search-fields with shareable query params.
 */
export default function FiltersModal({ open, onClose, priceBands }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    priceBand: '',
    minPrice: '',
    maxPrice: '',
    types: [],
    facilities: [],
    sort: 'newest',
    radiusKm: 20,
    openNow: false,
  });

  const apply = () => {
    const params = new URLSearchParams();
    const today = new Date();
    params.set('date', bariDate(today.toISOString()));
    if (filters.priceBand) params.set('priceBand', filters.priceBand);
    if (filters.minPrice !== '') params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== '') params.set('maxPrice', String(filters.maxPrice));
    if (filters.types?.length) params.set('types', filters.types.join(','));
    if (filters.facilities?.length) params.set('facilities', filters.facilities.join(','));
    if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
    if (filters.openNow) params.set('openNow', '1');
    if (filters.radiusKm && filters.radiusKm !== 20) params.set('radiusKm', String(filters.radiusKm));
    onClose();
    navigate(`/search-fields?${params.toString()}`);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('search.advancedFiltersTitle')}>
      <div className="-mx-1">
        <BookingAdvancedFilters
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClear={() =>
            setFilters({
              priceBand: '',
              minPrice: '',
              maxPrice: '',
              types: [],
              facilities: [],
              sort: 'newest',
              radiusKm: 20,
              openNow: false,
            })
          }
          priceBands={priceBands}
        />
      </div>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="min-h-[48px]" onClick={onClose}>
          {t('search.close')}
        </Button>
        <Button className="min-h-[48px]" icon={<FiSliders />} onClick={apply}>
          {t('search.search')}
        </Button>
      </div>
    </Modal>
  );
}
