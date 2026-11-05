import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiMapPin, FiCheckCircle, FiStar, FiSliders, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageTransition from '../components/common/PageTransition';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import { FullPageSpinner } from '../components/common/Spinner';
import FieldCard from '../components/stadium/FieldCard';
import FieldFiltersModal from '../components/stadium/FieldFiltersModal';
import DateSlider from '../components/booking/DateSlider';
import SlotGrid from '../components/booking/SlotGrid';
import WeatherCard from '../components/weather/WeatherCard';
import { weatherApi } from '../api/weatherApi';
import CldImage from '../components/common/CldImage';
import { stadiumApi, fieldApi } from '../api/stadiumApi';
import { fetchMyTeams } from '../features/teams/teamSlice';
import { createBooking } from '../features/bookings/bookingSlice';
import { useAuth } from '../hooks/useAuth';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { ROLES } from '../lib/roles';
import { useTranslation } from '../i18n/LanguageContext';
import {
  upcomingDates,
  isoDate,
  venueNowMs,
  formatLabel,
  estimateTeamShareLabel,
  estimateTeamShare,
} from '../lib/slotUtils';
import {
  sortStadiumFields,
  formatFieldType,
  hoursLabel,
  capacityForType,
  fieldSizeCounts,
  EMPTY_FIELD_FILTERS,
  countActiveFieldFilters,
  fieldMatchesFilters,
} from '../lib/fieldFormats';

function openCount(slots) {
  return (slots || []).filter((s) => s.state === 'available').length;
}

export default function StadiumDetails() {
  const { stadiumId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, role } = useAuth();
  const { weatherEnabled } = useAuthFeatures();
  const { items: teams } = useSelector((state) => state.teams);

  const [stadium, setStadium] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState(null);
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [slot, setSlot] = useState(null);
  const [slotsByField, setSlotsByField] = useState({});
  const [teamId, setTeamId] = useState('');
  const [booking, setBooking] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState(EMPTY_FIELD_FILTERS);
  const [weather, setWeather] = useState(null);

  const dateChips = useMemo(() => upcomingDates(13), []);
  const orderedFields = useMemo(() => sortStadiumFields(fields), [fields]);
  const sizeCounts = useMemo(() => fieldSizeCounts(orderedFields), [orderedFields]);
  const cover = stadium?.images?.[0];
  const today = isoDate(new Date());
  const activeFilterCount = countActiveFieldFilters(fieldFilters);

  useEffect(() => {
    (async () => {
      try {
        const [stadiumRes, fieldsRes] = await Promise.all([
          stadiumApi.get(stadiumId),
          stadiumApi.listFields(stadiumId),
        ]);
        setStadium(stadiumRes.data.data.stadium);
        const list = sortStadiumFields(fieldsRes.data.data.fields || []);
        setFields(list);
      } catch {
        toast.error(t('stadiumDetail.loadFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [stadiumId, t]);

  useEffect(() => {
    if (isAuthenticated && role === ROLES.TEAM_CAPTAIN) {
      dispatch(fetchMyTeams());
    }
  }, [isAuthenticated, role, dispatch]);

  const fieldIds = orderedFields.map((f) => f._id).join(',');

  useEffect(() => {
    if (selectedField) return undefined;
    if (!orderedFields.length) {
      setSlotsByField({});
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      try {
        const pairs = await Promise.all(
          orderedFields.map((f) =>
            fieldApi
              .listSlots(f._id, today)
              .then(({ data }) => [String(f._id), data.data.slots || []])
              .catch(() => [String(f._id), []])
          )
        );
        if (!cancelled) setSlotsByField(Object.fromEntries(pairs));
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, fieldIds, selectedField]);

  useEffect(() => {
    if (!selectedField?._id || !date) return undefined;
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      try {
        const { data } = await fieldApi.listSlots(selectedField._id, date);
        if (!cancelled) {
          setSlotsByField((prev) => ({
            ...prev,
            [String(selectedField._id)]: data.data.slots || [],
          }));
        }
      } catch {
        if (!cancelled) {
          setSlotsByField((prev) => ({ ...prev, [String(selectedField._id)]: [] }));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedField?._id, date]);

  useEffect(() => {
    if (!weatherEnabled || !stadiumId || !date) {
      setWeather(null);
      return undefined;
    }
    let cancelled = false;
    weatherApi
      .lookup({ stadiumId, date })
      .then(({ data }) => {
        if (!cancelled) setWeather(data.data.weather || null);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, [weatherEnabled, stadiumId, date]);

  const filteredFields = useMemo(() => {
    return orderedFields.filter((f) =>
      fieldMatchesFilters(f, fieldFilters, {
        openCount: openCount(slotsByField[String(f._id)]),
        share: estimateTeamShare(f),
      })
    );
  }, [orderedFields, fieldFilters, slotsByField]);

  const serverSlots = selectedField ? slotsByField[String(selectedField._id)] || [] : [];

  const handleSelectField = (field) => {
    setSelectedField(field);
    setSlot(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToFields = () => {
    setSelectedField(null);
    setSlot(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBook = async () => {
    if (!isAuthenticated) return navigate('/login');
    if (role !== ROLES.TEAM_CAPTAIN) return toast.error(t('booking.onlyCaptains'));
    if (!selectedField || !slot) return toast.error(t('stadiumDetail.chooseField'));

    const startTime = slot.startISO
      ? new Date(slot.startISO)
      : new Date(`${date}T${slot.start}:00.000Z`);
    const endTime = slot.endISO
      ? new Date(slot.endISO)
      : new Date(`${date}T${slot.end}:00.000Z`);

    if (startTime.getTime() <= venueNowMs()) {
      toast.error(t('search.noOpenHours'));
      return;
    }
    if (
      slot.isRecurring ||
      String(slot.reason || '').startsWith('RECURRING') ||
      slot.status === 'booked' ||
      slot.status === 'blocked'
    ) {
      toast.error(
        slot.teamName
          ? `${t('search.weeklyTeam')} · ${slot.teamName}`
          : t('search.booked')
      );
      return;
    }

    setBooking(true);
    const result = await dispatch(
      createBooking({
        fieldId: selectedField._id,
        stadiumId: stadium._id,
        ...(teamId ? { teamId } : {}),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
    );
    setBooking(false);

    if (createBooking.fulfilled.match(result)) {
      toast.success('Slot held! Complete payment to confirm.');
      navigate(`/app/bookings/${result.payload._id}?pay=1`);
    } else {
      toast.error(result.payload || 'Could not book this slot');
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!stadium) return null;

  const type = selectedField ? formatFieldType(selectedField.type) : null;
  const capacity = selectedField
    ? selectedField.capacity || capacityForType(type)
    : null;
  const payLabel = slot?.pricing?.teamShare != null
    ? `$${Number(slot.pricing.teamShare).toFixed(2)}`
    : selectedField
      ? estimateTeamShareLabel(selectedField)
      : '—';

  const fieldCover = selectedField?.images?.[0] || cover;
  const fieldView = Boolean(selectedField);

  return (
    <PageTransition
      className={
        fieldView
          ? 'mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-10'
          : 'mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8'
      }
    >
      <FieldFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={fieldFilters}
        onApply={setFieldFilters}
        sizes={sizeCounts}
      />

      {fieldView ? (
        <button
          type="button"
          onClick={handleBackToFields}
          className="inline-flex items-center gap-1.5 text-sm text-forest hover:underline dark:text-dark-primary"
        >
          <FiArrowLeft /> {t('stadiumDetail.backToFields')}
        </button>
      ) : (
        <Link to="/stadiums" className="text-sm text-forest hover:underline dark:text-dark-primary">
          ← Back to search
        </Link>
      )}

      {fieldView ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-forest/20 to-olive/20"
          >
            <div className="relative aspect-[16/6] min-h-[140px] w-full">
              {fieldCover ? (
                <CldImage
                  src={fieldCover}
                  alt={selectedField.name}
                  width={1200}
                  height={450}
                  crop
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-forest/30">
                  <FiMapPin size={40} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-white/80">{stadium.name}</p>
                <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
                  {selectedField.name}
                  {type ? ` · ${type}` : ''}
                </h1>
                <p className="mt-1.5 text-sm text-white/90">
                  {[
                    capacity ? `${capacity} vs ${capacity}` : null,
                    hoursLabel(selectedField.openingTime, selectedField.closingTime),
                    estimateTeamShareLabel(selectedField),
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </p>
              </div>
            </div>
          </motion.div>

          <Card className="mt-6 p-4 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-forest dark:text-dark-primary">
              {t('stadiumDetail.bookTitle')}
            </p>
            <p className="mb-2 mt-4 text-sm font-semibold text-charcoal dark:text-dark-text">
              {t('stadiumDetail.pickDay')}
            </p>
            <DateSlider
              dates={dateChips}
              selectedDate={date}
              onSelectDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
            />

            {weather ? (
              <div className="mt-5">
                <WeatherCard weather={weather} />
              </div>
            ) : null}

            <p className="mb-2 mt-6 text-sm font-semibold text-charcoal dark:text-dark-text">
              {t('stadiumDetail.pickTime')}
            </p>
            {slotsLoading && !serverSlots.length ? (
              <p className="text-sm text-muted dark:text-dark-muted">Loading slots…</p>
            ) : (
              <SlotGrid
                field={selectedField}
                date={date}
                serverSlots={serverSlots}
                selectedSlot={slot}
                onSelectSlot={setSlot}
                showLostSlots={false}
                onHoldExpired={() => {
                  if (!selectedField?._id || !date) return;
                  fieldApi
                    .listSlots(selectedField._id, date)
                    .then(({ data }) => {
                      setSlotsByField((prev) => ({
                        ...prev,
                        [String(selectedField._id)]: data.data.slots || [],
                      }));
                    })
                    .catch(() => {});
                  setSlot(null);
                }}
              />
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-warmwhite p-4 dark:bg-dark-surface-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {t('booking.details')}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t('booking.field')}</dt>
                    <dd className="font-semibold text-charcoal dark:text-dark-text">{selectedField.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t('search.matchDate')}</dt>
                    <dd className="font-semibold text-charcoal dark:text-dark-text">{date}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t('booking.timeSlot')}</dt>
                    <dd className="font-semibold text-charcoal dark:text-dark-text">
                      {slot ? formatLabel(slot.start) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t('stadiumDetail.youPay')}</dt>
                    <dd className="font-display text-lg font-extrabold text-forest dark:text-dark-primary">
                      {payLabel}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">{t('stadiumDetail.fullField')}</p>
              </div>

              <div className="flex flex-col justify-end gap-3">
                {isAuthenticated && role === ROLES.TEAM_CAPTAIN ? (
                  <Select
                    label={t('stadiumDetail.teamOptional')}
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                  >
                    <option value="">{t('stadiumDetail.teamAuto')}</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Button
                  className="hidden w-full lg:inline-flex"
                  size="lg"
                  loading={booking}
                  disabled={!slot}
                  onClick={handleBook}
                >
                  {isAuthenticated ? t('stadiumDetail.hold') : t('booking.loginToContinue')}
                </Button>
                <p className="hidden text-center text-xs text-disabled lg:block">
                  {t('stadiumDetail.holdHint')}
                </p>
              </div>
            </div>
          </Card>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 p-4 backdrop-blur lg:hidden dark:border-dark-border dark:bg-dark-surface/95">
            <Button className="w-full" size="lg" loading={booking} disabled={!slot} onClick={handleBook}>
              {isAuthenticated
                ? slot
                  ? t('stadiumDetail.hold')
                  : t('stadiumDetail.continue')
                : t('booking.loginToContinue')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-forest/20 to-olive/20"
          >
            <div className="relative aspect-[16/7] min-h-[180px] w-full">
              {cover ? (
                <CldImage
                  src={cover}
                  alt={stadium.name}
                  width={1200}
                  height={525}
                  crop
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-forest/30">
                  <FiMapPin size={48} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{stadium.name}</h1>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
                  <FiMapPin />
                  {[stadium.location?.address, stadium.location?.area, stadium.location?.city]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {stadium.ratingAverage > 0 ? (
              <p className="flex items-center gap-1 text-sm font-semibold text-charcoal dark:text-dark-text">
                <FiStar className="text-accent" /> {stadium.ratingAverage.toFixed(1)}
                <span className="font-medium text-muted dark:text-dark-muted">({stadium.ratingCount || 0})</span>
              </p>
            ) : (
              <span />
            )}
            {stadium.facilities?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stadium.facilities.map((f) => (
                  <span
                    key={f}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-warmwhite px-3 py-1 text-xs font-medium text-muted dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-muted"
                  >
                    <FiCheckCircle className="text-forest dark:text-dark-primary" /> {f}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {stadium.description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted dark:text-dark-muted">{stadium.description}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-charcoal dark:text-dark-text">
                {t('stadiumDetail.fields')}
              </h2>
              <p className="mt-1 text-sm text-muted dark:text-dark-muted">{t('stadiumDetail.fieldsHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label={t('stadiumDetail.filterFields')}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-charcoal shadow-sm hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
            >
              <FiSliders size={18} />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-extrabold text-white dark:bg-dark-primary">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFields.length === 0 ? (
              <p className="text-sm text-muted dark:text-dark-muted sm:col-span-2 lg:col-span-3">
                {t('search.noFields')}
              </p>
            ) : (
              filteredFields.map((field) => (
                <FieldCard
                  key={field._id}
                  field={field}
                  selected={false}
                  onSelect={handleSelectField}
                  availableCount={
                    slotsByField[String(field._id)]
                      ? openCount(slotsByField[String(field._id)])
                      : undefined
                  }
                  coverFallback={cover}
                />
              ))
            )}
          </div>
        </>
      )}
    </PageTransition>
  );
}
