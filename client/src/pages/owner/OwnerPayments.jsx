import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPercent, FiCalendar, FiDownload } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonStatRow } from '../../components/common/Skeleton';
import { ownerApi } from '../../api/bookingApi';
import { stadiumApi } from '../../api/stadiumApi';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';

export default function OwnerPayments() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { ownerCommissionVisible } = useAuthFeatures();
  const isOwner = role === ROLES.STADIUM_OWNER;
  const showCommission = isOwner && ownerCommissionVisible;
  const [stadiums, setStadiums] = useState([]);
  const [stadiumId, setStadiumId] = useState('');
  const [revenue, setRevenue] = useState(null);
  const [reports, setReports] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => setStadiums(res.data.data.stadiums || []))
      .catch(() => setStadiums([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = stadiumId ? { stadiumId } : {};
      const [rev, rep, bookings] = await Promise.all([
        ownerApi.revenue(),
        ownerApi.reports({ ...params, days: 30 }),
        ownerApi.listBookings({ ...params, limit: 80 }),
      ]);
      setRevenue(rev.data.data.revenue);
      setReports(rep.data.data.reports);
      setCards(bookings.data.data.cards || []);
    } catch {
      toast.error(t('owner.paymentsLoadFail'));
    } finally {
      setLoading(false);
    }
  }, [stadiumId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const paidCards = useMemo(
    () => cards.filter((c) => c.amountPaid != null && Number(c.amountPaid) > 0),
    [cards]
  );

  const byMethod = useMemo(() => {
    const map = {};
    paidCards.forEach((c) => {
      const key = c.paymentMethodLabel || c.paymentMethod || (c.walkIn ? 'walk-in' : t('owner.unknownPay'));
      map[key] = (map[key] || 0) + Number(c.amountPaid || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [paidCards, t]);

  return (
    <PageTransition>
      <PageHeader
        title={t('owner.paymentsTitle')}
        description={
          showCommission ? t('owner.paymentsDescWithCommission') : t('owner.paymentsDesc')
        }
        breadcrumbs={[
          { label: t('owner.navHome'), to: '/owner' },
          { label: t('owner.navPayments') },
        ]}
        actions={
          <Button as={Link} to="/owner/reports" size="sm" variant="outline" icon={<FiDownload />}>
            {t('owner.navReports')}
          </Button>
        }
      />

      <Card className="mb-5 p-4 sm:w-64">
        <Select
          label={t('owner.filterStadium')}
          value={stadiumId}
          onChange={(e) => setStadiumId(e.target.value)}
        >
          <option value="">{t('owner.allStadiums')}</option>
          {stadiums.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <SkeletonStatRow />
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 ${showCommission ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <StatCard
              icon={<FiDollarSign />}
              label={t('owner.settledPayout')}
              value={
                isOwner && revenue?.totalPayout != null
                  ? `$${Number(revenue.totalPayout).toFixed(0)}`
                  : '—'
              }
            />
            {showCommission && (
              <StatCard
                icon={<FiPercent />}
                label={t('owner.commissionPaid')}
                value={
                  revenue?.totalCommission != null
                    ? `$${Number(revenue.totalCommission).toFixed(0)}`
                    : '—'
                }
                accent="olive"
              />
            )}
            <StatCard
              icon={<FiCalendar />}
              label={t('owner.upcoming')}
              value={revenue?.upcomingBookings ?? 0}
              accent="accent"
            />
            <StatCard
              icon={<FiDollarSign />}
              label={t('owner.pendingPayoutLabel')}
              value={reports?.pendingPayout != null ? reports.pendingPayout : '—'}
            />
          </div>

          {!isOwner && (
            <p className="mt-4 text-sm text-muted">{t('owner.revenueOwnerOnly')}</p>
          )}

          {isOwner && stadiumId && (
            <p className="mt-3 text-xs text-muted">{t('owner.payoutPolicyHint')}</p>
          )}

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <CardTitle className="mb-3">{t('owner.paymentHistory')}</CardTitle>
              {paidCards.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FiDollarSign size={20} />}
                  title={t('owner.noPayments')}
                  description={t('owner.noPaymentsDesc')}
                />
              ) : (
                <ul className="space-y-2">
                  {paidCards.slice(0, 40).map((c) => (
                    <li key={c.bookingId}>
                      <Link
                        to={`/owner/bookings/${c.bookingId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warmwhite px-3 py-2.5 text-sm dark:bg-dark-surface-2"
                      >
                        <div>
                          <p className="font-medium">
                            {c.stadiumName} · {c.fieldName}
                          </p>
                          <p className="text-xs text-muted">
                            {c.startTime ? new Date(c.startTime).toLocaleString() : '—'}
                            {c.captainName ? ` · ${c.captainName}` : ''}
                            {c.walkIn ? ` · ${t('owner.walkInBadge')}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge status={c.status}>{c.status}</Badge>
                          <span className="font-bold tabular-nums">
                            {c.currency === 'SLL'
                              ? `${Number(c.amountSll || c.amountPaid).toLocaleString()} SlSh`
                              : `$${Number(c.amountUsd || c.amountPaid || 0).toFixed(2)}`}
                          </span>
                          {c.paymentMethodLabel && (
                            <span className="text-xs text-muted">{c.paymentMethodLabel}</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <CardTitle className="mb-3">{t('owner.byMethod')}</CardTitle>
              {byMethod.length === 0 ? (
                <p className="text-sm text-muted">{t('owner.noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {byMethod.map(([name, amount]) => (
                    <li
                      key={name}
                      className="flex justify-between rounded-xl bg-warmwhite px-3 py-2 text-sm dark:bg-dark-surface-2"
                    >
                      <span className="capitalize">{name}</span>
                      <span className="font-semibold tabular-nums">${amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && stadiums[0] && (
                <Button
                  as={Link}
                  to={`/owner/stadiums/${stadiumId || stadiums[0]._id}?tab=payout`}
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full"
                >
                  {t('owner.hubPayout')}
                </Button>
              )}
            </Card>
          </div>
        </>
      )}
    </PageTransition>
  );
}
