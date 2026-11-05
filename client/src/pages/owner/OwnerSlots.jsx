import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { FiCalendar, FiClock, FiLayers, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import DateSlider from '../../components/booking/DateSlider';
import HoldCountdown from '../../components/booking/HoldCountdown';
import WalkInModal from '../../components/owner/WalkInModal';
import { stadiumApi, fieldApi } from '../../api/stadiumApi';
import { ownerApi } from '../../api/bookingApi';
import { upcomingDates, isoDate, mapServerSlot, formatLabel, isRecurringSlot, venueNowMs, venueClockSnapshot } from '../../lib/slotUtils';
import { useFieldAvailabilitySubscription } from '../../hooks/useSocket';
import { useTranslation } from '../../i18n/LanguageContext';

function slotTone(slot) {
  const status = typeof slot === 'string' ? slot : slot.status;
  if (typeof slot === 'object' && isRecurringSlot(slot)) {
    return 'cursor-default border-indigo-800 bg-indigo-600 text-white';
  }
  if (status === 'available') {
    return 'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-200';
  }
  if (status === 'booked') {
    return 'border-red-700 bg-red-600 text-white hover:bg-red-700';
  }
  if (status === 'selected') {
    return 'border-sky-700 bg-sky-600 text-white hover:bg-sky-700';
  }
  if (status === 'blocked') {
    return 'cursor-default border-amber-700 bg-amber-600 text-white';
  }
  if (status === 'past') {
    return 'cursor-default border-slate-400 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300';
  }
  return 'cursor-default border-border bg-charcoal/5 text-muted dark:border-dark-border dark:bg-white/5';
}

export default function OwnerSlots() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dates = useMemo(() => upcomingDates(13), []);
  const [stadiums, setStadiums] = useState([]);
  const [fields, setFields] = useState([]);
  const [stadiumId, setStadiumId] = useState(searchParams.get('stadiumId') || '');
  const [fieldId, setFieldId] = useState(searchParams.get('fieldId') || '');
  const [date, setDate] = useState(searchParams.get('date') || isoDate(new Date()));
  const [rawSlots, setRawSlots] = useState([]);
  const [clockMs, setClockMs] = useState(() => venueNowMs());
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [walkSlot, setWalkSlot] = useState(null);
  const [lostToday, setLostToday] = useState(null);

  useFieldAvailabilitySubscription(fieldId);

  const syncParams = useCallback((next) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        Object.entries(next).forEach(([k, v]) => {
          if (v) p.set(k, v);
          else p.delete(k);
        });
        return p;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => {
        const list = res.data.data.stadiums || [];
        setStadiums(list);
        if (!stadiumId && list[0]) {
          setStadiumId(list[0]._id);
          syncParams({ stadiumId: list[0]._id });
        }
      })
      .catch(() => toast.error(t('owner.loadFail')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stadiumId) {
      setFields([]);
      setFieldId('');
      return;
    }
    stadiumApi.listFields(stadiumId).then((res) => {
      const list = res.data.data.fields || [];
      setFields(list);
      setFieldId((prev) => {
        if (prev && list.some((f) => f._id === prev)) return prev;
        const next = list[0]?._id || '';
        syncParams({ stadiumId, fieldId: next });
        return next;
      });
    });
  }, [stadiumId, syncParams]);

  const loadSlots = useCallback(async () => {
    if (!fieldId || !date) return;
    setSlotsLoading(true);
    try {
      const { data } = await fieldApi.listSlots(fieldId, date);
      setRawSlots(data.data.slots || []);
    } catch {
      toast.error(t('owner.slotsLoadFail'));
      setRawSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [fieldId, date, t]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    const id = setInterval(() => setClockMs(venueNowMs()), 10000);
    return () => clearInterval(id);
  }, []);

  const slots = useMemo(
    () => rawSlots.map((s) => mapServerSlot(s, clockMs)),
    [rawSlots, clockMs]
  );

  useEffect(() => {
    if (!stadiumId) return;
    ownerApi
      .slotReports({ stadiumId, days: 7 })
      .then((res) => setLostToday(res.data.data.report || null))
      .catch(() => setLostToday(null));
  }, [stadiumId]);

  const counts = useMemo(() => {
    const acc = { available: 0, booked: 0, selected: 0, blocked: 0, past: 0, weekly: 0 };
    slots.forEach((s) => {
      if (isRecurringSlot(s)) acc.weekly += 1;
      else acc[s.status] = (acc[s.status] || 0) + 1;
    });
    return acc;
  }, [slots]);

  const handleSlotClick = (slot) => {
    if (isRecurringSlot(slot)) return;
    if (slot.status === 'available') {
      setWalkSlot(slot);
      return;
    }
    if ((slot.status === 'booked' || slot.status === 'selected') && slot.bookingId) {
      navigate(`/owner/bookings/${slot.bookingId}`);
    }
  };

  const liveClock = venueClockSnapshot(clockMs);

  const legend = [
    { key: 'available', color: 'bg-emerald-500', label: t('owner.slotAvailable') },
    { key: 'booked', color: 'bg-red-600', label: t('owner.slotBooked') },
    { key: 'selected', color: 'bg-sky-600', label: t('owner.slotHeld') },
    { key: 'blocked', color: 'bg-amber-600', label: t('owner.slotBlockedState') },
    { key: 'weekly', color: 'bg-indigo-600', label: t('owner.slotWeeklyTeam') },
    { key: 'past', color: 'bg-slate-400', label: t('owner.slotLost') },
  ];

  return (
    <PageTransition>
      <PageHeader
        title={t('owner.slotsTitle')}
        description={t('owner.slotsDesc')}
        breadcrumbs={[
          { label: t('owner.navHome'), to: '/owner' },
          { label: t('owner.navSlots') },
        ]}
        actions={
          <Button as={Link} to="/owner/bookings" size="sm" variant="outline">
            {t('owner.navGate')}
          </Button>
        }
      />

      <Card className="mb-5 flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={t('owner.filterStadium')}
            value={stadiumId}
            onChange={(e) => {
              setStadiumId(e.target.value);
              setFieldId('');
              syncParams({ stadiumId: e.target.value, fieldId: '' });
            }}
          >
            {stadiums.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label={t('owner.filterField')}
            value={fieldId}
            onChange={(e) => {
              setFieldId(e.target.value);
              syncParams({ fieldId: e.target.value });
            }}
          >
            {fields.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name} · {f.type}
              </option>
            ))}
          </Select>
        </div>
        <DateSlider
          dates={dates}
          selectedDate={date}
          onSelectDate={(next) => {
            setDate(next);
            syncParams({ date: next });
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-charcoal/5 px-3 py-2 text-xs dark:border-dark-border dark:bg-white/5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-charcoal dark:text-dark-text">
            <FiClock size={14} />
            {t('owner.venueClock', { time: liveClock.timeLabel, date: liveClock.date })}
          </span>
          <span className="text-muted dark:text-dark-muted">
            {t('owner.lostHoursToday', { n: counts.past })}
          </span>
        </div>
      </Card>

      {lostToday?.totals ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Card className="flex items-center gap-3 p-4">
            <FiCheckCircle className="text-forest" />
            <div>
              <p className="text-xs uppercase text-muted">{t('owner.slotBooked')}</p>
              <p className="font-display text-xl font-bold">{lostToday.totals.bookedSlots}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <FiCalendar className="text-olive" />
            <div>
              <p className="text-xs uppercase text-muted">{t('owner.slotAvailable')}</p>
              <p className="font-display text-xl font-bold">{lostToday.totals.availableRemaining}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <FiAlertCircle className="text-amber-600" />
            <div>
              <p className="text-xs uppercase text-muted">{t('owner.lostSlots')}</p>
              <p className="font-display text-xl font-bold">{lostToday.totals.lostSlots}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <FiLayers className="text-forest" />
            <div>
              <p className="text-xs uppercase text-muted">{t('owner.utilization')}</p>
              <p className="font-display text-xl font-bold">{lostToday.totals.utilizationPercent ?? 0}%</p>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        {legend.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5 text-muted">
            <span className={clsx('h-2.5 w-2.5 rounded-full', l.color)} />
            {l.label}
            {counts[l.key] != null ? ` (${counts[l.key]})` : ''}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-border/40" />
      ) : !fieldId ? (
        <EmptyState
          icon={<FiClock size={22} />}
          title={t('owner.noFields')}
          description={t('owner.slotsNeedField')}
          action={
            stadiumId ? (
              <Button as={Link} to={`/owner/stadiums/${stadiumId}`}>
                {t('owner.addField')}
              </Button>
            ) : null
          }
        />
      ) : slotsLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-border/40" />
      ) : slots.length === 0 ? (
        <EmptyState icon={<FiClock size={22} />} title={t('owner.noSlots')} description={t('owner.noSlotsDesc')} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {slots.map((slot) => {
            const weekly = isRecurringSlot(slot);
            const clickable = !weekly && (slot.status === 'available' || Boolean(slot.bookingId));
            return (
              <button
                key={slot.startISO}
                type="button"
                disabled={!clickable}
                onClick={() => handleSlotClick(slot)}
                className={clsx(
                  'flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-transform active:scale-95',
                  slotTone(slot),
                  clickable && 'cursor-pointer'
                )}
                title={slot.labelSo || slot.reason || slot.status}
              >
                <span className="text-xs font-bold">{formatLabel(slot.start)}</span>
                <span className="text-[10px] font-semibold opacity-90">
                  {weekly && (slot.teamName
                    ? `${t('owner.slotWeeklyTeam')} · ${slot.teamName}`
                    : t('owner.slotWeeklyTeam'))}
                  {!weekly && slot.status === 'available' && t('owner.slotAvailable')}
                  {!weekly && slot.status === 'booked' && t('owner.slotBooked')}
                  {!weekly && slot.status === 'selected' && t('owner.slotHeld')}
                  {!weekly && slot.status === 'blocked' && t('owner.slotBlockedState')}
                  {!weekly && slot.status === 'past' && t('owner.slotLost')}
                </span>
                {slot.status === 'available' && slot.pricing?.teamShare != null && (
                  <span className="text-[10px]">${Number(slot.pricing.teamShare).toFixed(0)}</span>
                )}
                {slot.status === 'selected' && slot.selectedUntil && (
                  <HoldCountdown expiresAt={slot.selectedUntil} onExpired={loadSlots} compact />
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted">{t('owner.slotsHint')}</p>

      <WalkInModal
        open={Boolean(walkSlot)}
        onClose={() => setWalkSlot(null)}
        stadiumId={stadiumId}
        fieldId={fieldId}
        slot={walkSlot}
        onBooked={(result) => {
          setWalkSlot(null);
          loadSlots();
          const id = result?.booking?._id;
          if (id) navigate(`/owner/bookings/${id}`);
        }}
      />
    </PageTransition>
  );
}
