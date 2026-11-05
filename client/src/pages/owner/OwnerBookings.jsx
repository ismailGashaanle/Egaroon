import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCalendar, FiMaximize, FiCheck } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import EmptyState from '../../components/common/EmptyState';
import Card, { CardTitle } from '../../components/common/Card';
import OwnerBookingCard from '../../components/owner/OwnerBookingCard';
import { ownerApi } from '../../api/bookingApi';
import { stadiumApi } from '../../api/stadiumApi';
import { isoDate } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';

const VIEWS = [
  { key: 'today', labelKey: 'owner.viewToday' },
  { key: 'upcoming', labelKey: 'owner.viewUpcoming' },
  { key: 'history', labelKey: 'owner.viewHistory' },
];

export default function OwnerBookings() {
  const { t } = useTranslation();
  const { ownerCommissionVisible } = useAuthFeatures();
  const [bookings, setBookings] = useState([]);
  const [cards, setCards] = useState([]);
  const [pending, setPending] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [forceDemo, setForceDemo] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [view, setView] = useState('today');
  const [stadiumId, setStadiumId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));

  useEffect(() => {
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => setStadiums(res.data.data.stadiums || []))
      .catch(() => setStadiums([]));
  }, []);

  const query = useMemo(() => {
    const params = { limit: 100 };
    if (stadiumId) params.stadiumId = stadiumId;
    if (status) params.status = status;
    if (q.trim()) params.q = q.trim();
    if (view === 'today') params.date = date || isoDate(new Date());
    return params;
  }, [stadiumId, status, q, view, date]);

  const load = async () => {
    try {
      const [b, r, p] = await Promise.all([
        ownerApi.listBookings(query),
        ownerApi.revenue(),
        ownerApi.listPendingAccepts(stadiumId ? { stadiumId } : {}),
      ]);
      setBookings(b.data.data.bookings || []);
      setCards(b.data.data.cards || []);
      setRevenue(r.data.data.revenue);
      setPending(p.data.data.bookings || []);
    } catch {
      toast.error(t('owner.bookingsLoadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const cardById = useMemo(() => {
    const map = {};
    cards.forEach((c) => {
      map[c.bookingId] = c;
    });
    return map;
  }, [cards]);

  const visible = useMemo(() => {
    const now = Date.now();
    if (view === 'upcoming') {
      return bookings.filter((b) => new Date(b.startTime).getTime() >= now);
    }
    if (view === 'history') {
      return bookings.filter((b) => new Date(b.startTime).getTime() < now);
    }
    return bookings;
  }, [bookings, view]);

  const handleGateCheckIn = async (e) => {
    e.preventDefault();
    if (!code.trim()) return toast.error(t('owner.enterCode'));
    const sid = stadiumId || stadiums[0]?._id;
    if (!sid) return toast.error(t('owner.pickStadiumFirst'));
    setScanning(true);
    try {
      const trimmed = code.trim();
      const payload = trimmed.startsWith('{')
        ? { qrPayload: trimmed, stadiumId: sid, force: forceDemo }
        : { bookingCode: trimmed.toUpperCase(), stadiumId: sid, force: forceDemo };
      const { data } = await ownerApi.gateCheckIn(payload);
      const b = data.data.booking;
      if (data.data.forcedOutsideWindow) {
        toast.success(`${t('owner.checkInDemo')} · ${b.status}`);
      } else {
        toast.success(
          data.data.alreadyCheckedIn
            ? `${t('owner.alreadyCheckedIn')} · ${b.status}`
            : `${t('owner.gateOk')} · ${b.status}`
        );
      }
      setCode('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.checkInFail'));
    } finally {
      setScanning(false);
    }
  };

  const handleAccept = async (id) => {
    setAcceptingId(id);
    try {
      const { data } = await ownerApi.acceptBooking(id);
      toast.success(data.data.alreadyAccepted ? t('owner.alreadyAccepted') : t('owner.acceptSuccess'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.acceptFail'));
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={t('owner.bookingsTitle')}
        description={t('owner.bookingsDesc')}
        breadcrumbs={[
          { label: t('owner.navHome'), to: '/owner' },
          { label: t('owner.navGate') },
        ]}
        actions={
          <div className="flex gap-2">
            <Button as={Link} to="/owner/slots" size="sm" variant="outline">
              {t('owner.navSlots')}
            </Button>
            <Button as={Link} to="/owner/reports" size="sm" variant="outline">
              {t('owner.navReports')}
            </Button>
          </div>
        }
      />

      {pending.length > 0 && (
        <Card className="mb-6 border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardTitle className="mb-1">{t('owner.pendingAcceptTitle')}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t('owner.pendingAcceptHint')}</p>
          <ul className="space-y-2">
            {pending.map((b) => (
              <li
                key={b._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 dark:bg-dark-surface-2"
              >
                <div>
                  <p className="font-medium">
                    {b.stadium?.name} · {b.field?.name}
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(b.startTime).toLocaleString()} · {b.teamA?.team?.name || 'Team A'}
                    {b.teamB?.team?.name ? ` vs ${b.teamB.team.name}` : ''}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-forest dark:text-dark-primary">
                    {t('owner.feeTotal')}: ${Number(b.pricing?.totalPrice || 0).toFixed(2)}
                  </p>
                </div>
                <Button
                  size="sm"
                  icon={<FiCheck />}
                  loading={acceptingId === b._id}
                  onClick={() => handleAccept(b._id)}
                >
                  {t('owner.acceptBtn')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form
        onSubmit={handleGateCheckIn}
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label={t('owner.gateLabel')}
            placeholder="KUL-XXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">{t('owner.gateWindowHint')}</p>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={forceDemo}
              onChange={(e) => setForceDemo(e.target.checked)}
              className="rounded border-border"
            />
            {t('owner.forceDemo')}
          </label>
        </div>
        <Button type="submit" icon={<FiMaximize />} loading={scanning}>
          {t('owner.verifyStart')}
        </Button>
      </form>

      {revenue && (
        <div className={`mb-6 grid gap-4 ${ownerCommissionVisible ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2">
            <p className="text-xs uppercase text-muted">{t('owner.settledPayout')}</p>
            <p className="font-display text-2xl font-bold">
              {revenue.totalPayout != null ? `$${Number(revenue.totalPayout || 0).toFixed(2)}` : '—'}
            </p>
          </div>
          {ownerCommissionVisible && (
            <div className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2">
              <p className="text-xs uppercase text-muted">{t('owner.commissionPaid')}</p>
              <p className="font-display text-2xl font-bold">
                {revenue.totalCommission != null ? `$${Number(revenue.totalCommission || 0).toFixed(2)}` : '—'}
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2">
            <p className="text-xs uppercase text-muted">{t('owner.upcoming')}</p>
            <p className="font-display text-2xl font-bold">{revenue.upcomingBookings}</p>
          </div>
        </div>
      )}

      <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select label={t('owner.filterStadium')} value={stadiumId} onChange={(e) => setStadiumId(e.target.value)}>
          <option value="">{t('owner.allStadiums')}</option>
          {stadiums.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label={t('owner.filterStatus')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('owner.allStatuses')}</option>
          {['CONFIRMED', 'HELD', 'IN_PROGRESS', 'COMPLETED', 'SETTLED', 'CANCELLED', 'EXPIRED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {view === 'today' && (
          <Input label={t('owner.from')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        <Input
          label={t('common.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="KUL- · name · phone"
        />
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              view === v.key
                ? 'bg-forest text-white'
                : 'border border-border bg-white text-charcoal dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
            }`}
          >
            {t(v.labelKey)}
          </button>
        ))}
      </div>

      {loading && <div className="h-32 animate-pulse rounded-2xl bg-border/40" />}
      {!loading && visible.length === 0 && (
        <EmptyState
          icon={<FiCalendar size={22} />}
          title={t('owner.noBookings')}
          description={t('owner.noBookingsDesc')}
          action={
            <Button as={Link} to="/owner/slots">
              {t('owner.navSlots')}
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        {visible.map((b) => (
          <OwnerBookingCard key={b._id} booking={b} card={cardById[String(b._id)]} />
        ))}
      </div>
    </PageTransition>
  );
}
