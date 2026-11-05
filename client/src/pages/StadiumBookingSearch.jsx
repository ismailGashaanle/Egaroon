import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { FiMapPin } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import EmptyState from '../components/common/EmptyState';
import BookingSearchHeader from '../components/booking/BookingSearchHeader';
import DateSlider from '../components/booking/DateSlider';
import StadiumSlotCard from '../components/booking/StadiumSlotCard';
import { fetchStadiums } from '../features/stadiums/stadiumSlice';
import { fetchMyTeams } from '../features/teams/teamSlice';
import { createBooking } from '../features/bookings/bookingSlice';
import { stadiumApi, fieldApi } from '../api/stadiumApi';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../lib/roles';
import { bariDate, parseSearchDate, upcomingDates, estimateTeamShare, venueNowMs } from '../lib/slotUtils';
import { FIELD_TYPES } from '../lib/fieldFormats';
import { useTranslation } from '../i18n/LanguageContext';

function cardKey(stadiumId, fieldId) {
  return `${stadiumId}:${fieldId}`;
}

function parseCsvParam(value) {
  if (!value) return [];
  return [...new Set(String(value).split(',').map((v) => v.trim()).filter(Boolean))];
}

function filtersFromParams(searchParams) {
  const types = parseCsvParam(searchParams.get('types') || searchParams.get('type')).filter((t) =>
    FIELD_TYPES.includes(t)
  );
  return {
    from: searchParams.get('from') || searchParams.get('city') || '',
    to: searchParams.get('to') || searchParams.get('area') || '',
    region: searchParams.get('region') || '',
    date: parseSearchDate(searchParams.get('date')),
    priceBand: searchParams.get('priceBand') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    types,
    facilities: parseCsvParam(searchParams.get('facilities')),
    sort: searchParams.get('sort') || 'newest',
    radiusKm: Number(searchParams.get('radiusKm')) || 20,
    openNow: searchParams.get('openNow') === '1' || searchParams.get('openNow') === 'true',
  };
}

/**
 * Bari-style field search (UC-005 → UC-008).
 * URL example:
 *   /search-fields?from=Hargeisa&date=23-08-2026&types=7v7&priceBand=mid&sort=price_asc
 */
export default function StadiumBookingSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, role, user } = useAuth();
  const { t } = useTranslation();
  const { items: stadiums, status, meta } = useSelector((state) => state.stadiums);
  const { items: teams } = useSelector((state) => state.teams);

  const dateChips = useMemo(() => upcomingDates(14), []);

  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [fieldsByStadium, setFieldsByStadium] = useState({});
  const [blocksByField, setBlocksByField] = useState({});
  const [slotsByField, setSlotsByField] = useState({});
  const [loadingFields, setLoadingFields] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState({});
  const [teamIds, setTeamIds] = useState({});
  const [teamNames, setTeamNames] = useState({});
  const [bookingKey, setBookingKey] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [nearMe, setNearMe] = useState(() => {
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, radiusKm: Number(searchParams.get('radiusKm')) || 20 };
    }
    return null;
  });

  const isCaptain = isAuthenticated && role === ROLES.TEAM_CAPTAIN;

  const buildQuery = useCallback((f, geo) => {
    const params = {
      date: bariDate(`${f.date}T12:00:00`),
    };
    if (f.from?.trim()) params.from = f.from.trim();
    if (f.to?.trim()) params.to = f.to.trim();
    if (f.region?.trim()) params.region = f.region.trim();
    if (f.priceBand) params.priceBand = f.priceBand;
    if (f.minPrice !== '' && f.minPrice != null) params.minPrice = String(f.minPrice);
    if (f.maxPrice !== '' && f.maxPrice != null) params.maxPrice = String(f.maxPrice);
    if (f.types?.length) params.types = f.types.join(',');
    if (f.facilities?.length) params.facilities = f.facilities.join(',');
    if (f.sort && f.sort !== 'newest') params.sort = f.sort;
    if (f.openNow) params.openNow = '1';
    if (geo?.lat != null && geo?.lng != null) {
      params.lat = String(geo.lat);
      params.lng = String(geo.lng);
      params.radiusKm = String(geo.radiusKm || f.radiusKm || 20);
      if (!f.sort || f.sort === 'newest') params.sort = 'nearest';
    } else if (f.radiusKm && f.radiusKm !== 20) {
      params.radiusKm = String(f.radiusKm);
    }
    return params;
  }, []);

  const runSearch = useCallback(
    (nextFilters = filters, geo = nearMe) => {
      const apiParams = {};
      if (nextFilters.from?.trim()) apiParams.city = nextFilters.from.trim();
      if (nextFilters.to?.trim()) apiParams.area = nextFilters.to.trim();
      if (nextFilters.region?.trim()) apiParams.region = nextFilters.region.trim();
      if (nextFilters.priceBand) apiParams.priceBand = nextFilters.priceBand;
      if (nextFilters.minPrice !== '' && nextFilters.minPrice != null) {
        apiParams.minPrice = nextFilters.minPrice;
      }
      if (nextFilters.maxPrice !== '' && nextFilters.maxPrice != null) {
        apiParams.maxPrice = nextFilters.maxPrice;
      }
      if (nextFilters.types?.length) apiParams.types = nextFilters.types.join(',');
      if (nextFilters.facilities?.length) {
        apiParams.facilities = nextFilters.facilities.join(',');
      }
      if (nextFilters.openNow) apiParams.openNow = 'true';

      const activeGeo = geo?.lat != null && geo?.lng != null ? geo : null;
      if (activeGeo) {
        apiParams.lat = activeGeo.lat;
        apiParams.lng = activeGeo.lng;
        apiParams.radiusKm = activeGeo.radiusKm || nextFilters.radiusKm || 20;
      }

      let sort = nextFilters.sort || 'newest';
      if (activeGeo && (!nextFilters.sort || nextFilters.sort === 'newest')) {
        sort = 'nearest';
      }
      if (sort && sort !== 'newest') apiParams.sort = sort;
      else if (sort === 'newest') apiParams.sort = 'newest';

      dispatch(fetchStadiums(apiParams));
      setSearchParams(buildQuery(nextFilters, activeGeo), { replace: true });
      setHasSearched(true);
      setExpandedKey(null);
      setSelectedSlots({});
      setSlotsByField({});
    },
    [dispatch, filters, setSearchParams, buildQuery, nearMe]
  );

  const applyGeoAndSearch = (geo, clearedLocation = false) => {
    const next = clearedLocation
      ? { ...filters, from: '', to: '', sort: filters.sort === 'newest' ? 'nearest' : filters.sort }
      : { ...filters };
    if (geo) {
      next.radiusKm = geo.radiusKm || next.radiusKm || 20;
    }
    setNearMe(geo);
    setFilters(next);
    runSearch(next, geo);
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      const profile = user?.latLng;
      if (profile?.lat != null && profile?.lng != null) {
        toast.success(t('search.usingProfileGps'));
        return applyGeoAndSearch(
          { lat: profile.lat, lng: profile.lng, radiusKm: filters.radiusKm || 20 },
          true
        );
      }
      return toast.error(t('search.geoUnsupported'));
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusKm: filters.radiusKm || 20,
        };
        setLocating(false);
        toast.success(t('search.nearMeSuccess'));
        applyGeoAndSearch(geo, true);
      },
      () => {
        setLocating(false);
        const profile = user?.latLng;
        if (profile?.lat != null && profile?.lng != null) {
          toast.success(t('search.usingProfileGps'));
          applyGeoAndSearch(
            { lat: profile.lat, lng: profile.lng, radiusKm: filters.radiusKm || 20 },
            true
          );
          return;
        }
        toast.error(t('search.geoDenied'));
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Auto-search when landing with query params (shareable Bari-style links)
  useEffect(() => {
    runSearch(filters, nearMe);
    setHasSearched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isCaptain) dispatch(fetchMyTeams());
  }, [isCaptain, dispatch]);

  useEffect(() => {
    if (stadiums.length === 0) {
      setFieldsByStadium({});
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const entries = await Promise.all(
          stadiums.map(async (stadium) => {
            const { data } = await stadiumApi.listFields(stadium._id);
            return [stadium._id, data.data.fields.filter((f) => f.status === 'active')];
          })
        );
        if (!cancelled) setFieldsByStadium(Object.fromEntries(entries));
      } catch {
        if (!cancelled) toast.error('Failed to load fields');
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stadiums]);

  const fieldCards = useMemo(() => {
    const rows = [];
    const typeSet = filters.types?.length ? new Set(filters.types) : null;
    const lowMax = meta?.priceBands?.lowMax ?? 20;
    const midMax = meta?.priceBands?.midMax ?? 40;
    let minP = filters.minPrice !== '' && filters.minPrice != null ? Number(filters.minPrice) : null;
    let maxP = filters.maxPrice !== '' && filters.maxPrice != null ? Number(filters.maxPrice) : null;
    if (!Number.isFinite(minP)) minP = null;
    if (!Number.isFinite(maxP)) maxP = null;
    let minExclusive = false;
    if (filters.priceBand === 'low') {
      maxP = maxP == null ? lowMax : Math.min(maxP, lowMax);
    } else if (filters.priceBand === 'mid') {
      minExclusive = true;
      minP = minP == null ? lowMax : Math.max(minP, lowMax);
      maxP = maxP == null ? midMax : Math.min(maxP, midMax);
    } else if (filters.priceBand === 'high') {
      minExclusive = true;
      minP = minP == null ? midMax : Math.max(minP, midMax);
    }

    stadiums.forEach((stadium) => {
      const fields = fieldsByStadium[stadium._id] || [];
      fields.forEach((field) => {
        if (typeSet && !typeSet.has(field.type)) return;
        if (minP != null || maxP != null) {
          const share = estimateTeamShare(field);
          if (share == null) return;
          if (minP != null && (minExclusive ? share <= minP : share < minP)) return;
          if (maxP != null && share > maxP) return;
        }
        rows.push({ stadium, field, key: cardKey(stadium._id, field._id) });
      });
    });
    return rows;
  }, [stadiums, fieldsByStadium, filters.types, filters.priceBand, filters.minPrice, filters.maxPrice, meta]);

  const loadSlotsForField = useCallback(async (fieldId, date) => {
    try {
      const { data } = await fieldApi.listSlots(fieldId, date);
      const slots = data.data.slots || [];
      setSlotsByField((prev) => ({ ...prev, [fieldId]: slots }));
      return slots;
    } catch {
      setSlotsByField((prev) => ({ ...prev, [fieldId]: [] }));
      try {
        const { data } = await fieldApi.listAvailabilityBlocks(fieldId);
        setBlocksByField((prev) => ({ ...prev, [fieldId]: data.data.blocks || [] }));
      } catch {
        /* ignore */
      }
      return [];
    }
  }, []);

  const handleToggleExpand = async (key, field) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    await loadSlotsForField(field._id, filters.date);
    setExpandedKey(key);
  };

  const handleFieldChange = async (key, stadiumId, fieldId) => {
    const fields = fieldsByStadium[stadiumId] || [];
    const field = fields.find((f) => f._id === fieldId);
    if (!field) return;
    setExpandedKey(key);
    await loadSlotsForField(fieldId, filters.date);
    setSelectedSlots((prev) => ({ ...prev, [key]: null }));
  };

  const handleBook = async (stadium, field, key) => {
    if (!isAuthenticated) return navigate('/login');
    if (!isCaptain) return toast.error('Only team captains can book a field');

    const slot = selectedSlots[key];
    const teamId = teamIds[key] || undefined;
    const teamName = teamNames[key] || undefined;

    if (!slot) return toast.error('Select a time slot first');
    if (slot.isRecurring || String(slot.reason || '').startsWith('RECURRING')) {
      return toast.error(
        slot.teamName
          ? `Joogto · ${slot.teamName} — that hour is already taken`
          : 'That weekly (joogto) hour is already taken'
      );
    }
    if (slot.status === 'booked' || slot.status === 'blocked' || slot.status === 'past') {
      return toast.error(slot.status === 'past' ? 'That time has already passed' : 'That slot is already booked');
    }

    const startTime = slot.startISO
      ? new Date(slot.startISO)
      : new Date(`${filters.date}T${slot.start}:00.000Z`);
    const endTime = slot.endISO
      ? new Date(slot.endISO)
      : new Date(`${filters.date}T${slot.end}:00.000Z`);

    if (startTime.getTime() <= venueNowMs()) {
      return toast.error('Cannot book a slot in the past');
    }

    setBookingKey(key);
    const result = await dispatch(
      createBooking({
        fieldId: field._id,
        stadiumId: stadium._id,
        ...(teamId ? { teamId } : {}),
        ...(teamName ? { teamName } : {}),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
    );
    setBookingKey(null);

    if (createBooking.fulfilled.match(result)) {
      toast.success('Slot held! Pay, then invite Team B by phone.');
      navigate(`/app/bookings/${result.payload._id}?pay=1`);
    } else {
      toast.error(result.payload || 'Could not book this slot');
    }
  };

  const handleFilterChange = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.radiusKm != null && nearMe) {
        setNearMe((g) => (g ? { ...g, radiusKm: Number(patch.radiusKm) || g.radiusKm } : g));
      }
      return next;
    });
  };

  const clearAdvanced = () => {
    const next = {
      ...filters,
      priceBand: '',
      minPrice: '',
      maxPrice: '',
      types: [],
      facilities: [],
      sort: 'newest',
      openNow: false,
      radiusKm: 20,
    };
    setFilters(next);
    setNearMe(null);
    runSearch(next, null);
  };

  const handleDateSelect = (dateIso) => {
    const next = { ...filters, date: dateIso };
    setFilters(next);
    setSelectedSlots({});
    setExpandedKey(null);
    runSearch(next);
  };

  const isLoading = status === 'loading' || loadingFields;
  const resultLabel = [filters.from, filters.to].filter(Boolean).join(' → ') || t('search.allAreas');

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text sm:text-3xl">
          {t('search.title')}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-dark-muted">
          {t('search.subtitle')}
        </p>
      </div>

      <BookingSearchHeader
        filters={filters}
        onChange={handleFilterChange}
        onSearch={() => {
          const geo = nearMe
            ? { ...nearMe, radiusKm: filters.radiusKm || nearMe.radiusKm || 20 }
            : null;
          runSearch(filters, geo);
        }}
        onNearMe={handleNearMe}
        locating={locating}
        onClearAdvanced={clearAdvanced}
        priceBands={meta?.priceBands}
        nearMeActive={Boolean(nearMe)}
      />

      <div className="mt-5">
        <DateSlider
          dates={dateChips}
          selectedDate={filters.date}
          onSelectDate={handleDateSelect}
        />
      </div>

      {hasSearched && (
        <p className="mt-5 text-sm font-medium text-muted dark:text-dark-muted">
          {t('search.resultsFor')}{' '}
          <span className="text-charcoal dark:text-dark-text">
            {nearMe ? `${t('search.nearYou')} (≤${nearMe.radiusKm || filters.radiusKm || 20} km)` : resultLabel}
          </span>
          {' · '}
          {bariDate(`${filters.date}T12:00:00`)}
          {fieldCards.length > 0 && (
            <span className="text-brand-green"> · {fieldCards.length} field(s)</span>
          )}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {isLoading && fieldCards.length === 0 && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-border/50 dark:bg-dark-border/40" />
            ))}
          </div>
        )}

        {!isLoading && hasSearched && fieldCards.length === 0 && (
          <EmptyState
            icon={<FiMapPin size={22} />}
            title={t('search.noFields')}
            description={t('search.noFieldsDesc')}
          />
        )}

        {fieldCards.map(({ stadium, field, key }) => {
          const fields = fieldsByStadium[stadium._id] || [];
          const activeField = fields.find((f) => f._id === field._id) || field;

          return (
            <StadiumSlotCard
              key={key}
              stadium={stadium}
              field={field}
              date={filters.date}
              blocks={blocksByField[activeField._id] || []}
              serverSlots={slotsByField[activeField._id]}
              expanded={expandedKey === key}
              onToggleExpand={() => handleToggleExpand(key, activeField)}
              fields={fields}
              selectedField={activeField}
              onFieldChange={(fieldId) => handleFieldChange(key, stadium._id, fieldId)}
              selectedSlot={selectedSlots[key] || null}
              onSelectSlot={(slot) => setSelectedSlots((prev) => ({ ...prev, [key]: slot }))}
              onHoldExpired={() => {
                loadSlotsForField(activeField._id, filters.date);
                setSelectedSlots((prev) => {
                  const cur = prev[key];
                  if (!cur) return prev;
                  return { ...prev, [key]: null };
                });
              }}
              teamId={teamIds[key] || ''}
              onTeamChange={(value) => setTeamIds((prev) => ({ ...prev, [key]: value }))}
              teamName={teamNames[key] || ''}
              onTeamNameChange={(value) => setTeamNames((prev) => ({ ...prev, [key]: value }))}
              teams={teams}
              isAuthenticated={isAuthenticated}
              isCaptain={isCaptain}
              booking={bookingKey === key}
              onContinue={() => handleBook(stadium, activeField, key)}
              searchFilters={filters}
            />
          );
        })}
      </div>
    </PageTransition>
  );
}
