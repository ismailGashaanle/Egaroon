import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHome,
  FiPercent,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiBarChart2,
  FiCalendar,
  FiSlash,
  FiUsers,
  FiDollarSign,
  FiAward,
  FiArrowRight,
  FiLock,
  FiAlertTriangle,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Card, { CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonStatRow } from '../../components/common/Skeleton';
import { stadiumApi } from '../../api/stadiumApi';
import { ownerApi } from '../../api/bookingApi';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import WeatherAlertStrip from '../../components/weather/WeatherAlertStrip';

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { ownerCommissionVisible } = useAuthFeatures();
  const isOwner = role === ROLES.STADIUM_OWNER;
  const [stadiums, setStadiums] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [reports, setReports] = useState(null);
  const [slotReport, setSlotReport] = useState(null);
  const [pendingAccept, setPendingAccept] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [st, rev, rep, pend, slots] = await Promise.all([
          stadiumApi.list({ mine: 'true' }),
          ownerApi.revenue().catch(() => ({ data: { data: { revenue: null } } })),
          ownerApi.reports({ days: 7 }).catch(() => ({ data: { data: { reports: null } } })),
          ownerApi.listPendingAccepts().catch(() => ({ data: { data: { count: 0, bookings: [] } } })),
          ownerApi.slotReports({ days: 7 }).catch(() => ({ data: { data: { report: null } } })),
        ]);
        setStadiums(st.data.data.stadiums);
        setRevenue(rev.data.data.revenue);
        setReports(rep.data.data.reports);
        setPendingAccept(pend.data.data.count ?? (pend.data.data.bookings || []).length);
        setSlotReport(slots.data.data.report);
      } catch (err) {
        toast.error(err.response?.data?.error?.message || t('owner.loadFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const approved = stadiums.filter((s) => s.status === 'approved').length;
  const pending = stadiums.filter((s) => s.status === 'pending').length;
  const firstStadium = stadiums[0];

  const hubs = [
    {
      to: '/owner/slots',
      icon: <FiClock className="text-xl" />,
      title: t('owner.hubSlots'),
      desc: t('owner.hubSlotsDesc'),
    },
    {
      to: '/owner/bookings',
      icon: <FiCalendar className="text-xl" />,
      title: pendingAccept > 0 ? t('owner.hubAccept', { n: pendingAccept }) : t('owner.hubGate'),
      desc: pendingAccept > 0 ? t('owner.hubAcceptDesc') : t('owner.hubGateDesc'),
    },
    {
      to: '/owner/payments',
      icon: <FiDollarSign className="text-xl" />,
      title: t('owner.hubPayments'),
      desc: t('owner.hubPaymentsDesc'),
    },
    {
      to: '/owner/reports',
      icon: <FiBarChart2 className="text-xl" />,
      title: t('owner.hubReports'),
      desc: t('owner.hubReportsDesc'),
    },
    ...(firstStadium
      ? [
          {
            to: `/owner/stadiums/${firstStadium._id}?tab=accept`,
            icon: <FiCheckCircle className="text-xl" />,
            title: t('owner.hubAcceptMode'),
            desc: t('owner.hubAcceptModeDesc'),
          },
          {
            to: `/owner/stadiums/${firstStadium._id}?tab=blocks`,
            icon: <FiSlash className="text-xl" />,
            title: t('owner.hubBlocks'),
            desc: t('owner.hubBlocksDesc'),
          },
          ...(isOwner
            ? [
                {
                  to: `/owner/stadiums/${firstStadium._id}?tab=discounts`,
                  icon: <FiPercent className="text-xl" />,
                  title: t('owner.hubDiscounts'),
                  desc: t('owner.hubDiscountsDesc'),
                },
                {
                  to: `/owner/stadiums/${firstStadium._id}?tab=managers`,
                  icon: <FiUsers className="text-xl" />,
                  title: t('owner.hubManagers'),
                  desc: t('owner.hubManagersDesc'),
                },
                {
                  to: `/owner/stadiums/${firstStadium._id}?tab=payout`,
                  icon: <FiDollarSign className="text-xl" />,
                  title: t('owner.hubPayout'),
                  desc: t('owner.hubPayoutDesc'),
                },
              ]
            : []),
        ]
      : []),
    ...(isOwner
      ? [
          {
            to: '/owner/tournaments',
            icon: <FiAward className="text-xl" />,
            title: t('owner.hubCups'),
            desc: t('owner.hubCupsDesc'),
          },
        ]
      : []),
  ];

  return (
    <PageTransition>
      <PageHeader
        title={isOwner ? t('owner.dashOwner') : t('owner.dashManager')}
        description={isOwner ? t('owner.dashOwnerDesc') : t('owner.dashManagerDesc')}
        actions={
          isOwner ? (
            <Button as={Link} to="/owner/stadiums/new" icon={<FiPlus />}>
              {t('owner.addStadium')}
            </Button>
          ) : null
        }
      />

      <WeatherAlertStrip
        className="mb-6"
        cityFilter={stadiums.map((s) => s.city || s.location?.city).filter(Boolean)}
      />

      {revenue?.subscriptionStatus?.isLocked && (
        <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
              <FiLock className="text-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Garoonka wuu xidhan yahay (Subscription Unpaid)
              </h3>
              <p className="mt-1 text-sm leading-relaxed">
                {revenue.subscriptionStatus.messageSo ||
                  `Garoonkaagu si toos ah ayuu uga xidhmay ballamaha dadweynaha sababtoo ah subscription-ka bishaan ($${revenue.subscriptionStatus.owedAmount}) ayaan la bixin kadib xilligii bilaashka ahaa.`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-200/80 dark:bg-rose-900/80">
                  Lacagta lagu leeyahay: ${revenue.subscriptionStatus.owedAmount} {revenue.subscriptionStatus.currency}
                </span>
                <Button as={Link} to="/owner/subscriptions" size="sm" variant="primary">
                  Bixi Hadda ($7/Field) ama Gudbi Caddeyn
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!revenue?.subscriptionStatus?.isLocked && revenue?.subscriptionStatus?.isGracePeriod && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <FiAlertTriangle className="text-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Digniin: Xilliga Bilaashka ah (Grace Period: {revenue.subscriptionStatus.graceDaysLeft} maalmood ayaa kuu hadhay)
              </h3>
              <p className="mt-1 text-sm leading-relaxed">
                {revenue.subscriptionStatus.messageSo ||
                  `Waxaa kuu hadhay ${revenue.subscriptionStatus.graceDaysLeft} maalmood oo bilaash ah inaad bixiso subscription-ka $${revenue.subscriptionStatus.owedAmount} ee bishan ka hor inta aan garoonka si toos ah loo xidhin.`}
              </p>
              <div className="mt-3">
                <Button as={Link} to="/owner/subscriptions" size="sm" variant="secondary">
                  Bixi Subscription-ka ($7/Field)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonStatRow />
      ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={<FiHome />}
            label={t('owner.stadiums')}
            value={stadiums.length}
            hint={pending ? t('owner.pendingStadiums', { n: pending }) : undefined}
          />
          <StatCard icon={<FiCheckCircle />} label={t('owner.approved')} value={approved} accent="olive" />
          <StatCard
            icon={<FiCalendar />}
            label={t('owner.todayMatches')}
            value={reports?.todayBookings ?? '—'}
            accent="accent"
          />
          <StatCard
            icon={<FiClock />}
            label={t('owner.lostSlots')}
            value={slotReport?.totals?.lostSlots ?? '—'}
            hint={
              slotReport?.totals?.utilizationPercent != null
                ? t('owner.utilHint', { n: slotReport.totals.utilizationPercent })
                : t('owner.lostSlotsHint')
            }
            accent="accent"
          />
          <StatCard
            icon={<FiPercent />}
            label={t('owner.payout')}
            value={
              revenue?.totalPayout != null ? `$${Number(revenue.totalPayout).toFixed(0)}` : isOwner ? '$0' : '—'
            }
            hint={
              reports?.pendingPayout
                ? t('owner.pendingPayout', { n: reports.pendingPayout })
                : ownerCommissionVisible
                  ? t('owner.commissionHint')
                  : t('owner.payoutSettledHint')
            }
          />
        </div>
      )}

      {/* Simple action hubs — one job each */}
      <h2 className="mt-10 font-display text-lg font-bold text-charcoal dark:text-dark-text">
        {t('owner.quickActions')}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hubs.map((h) => (
          <Link key={h.to + h.title} to={h.to}>
            <Card hover className="flex h-full items-start gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/15 dark:text-dark-primary">
                {h.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-charcoal dark:text-dark-text">{h.title}</p>
                <p className="mt-0.5 text-sm text-muted dark:text-dark-muted">{h.desc}</p>
              </div>
              <FiArrowRight className="mt-1 shrink-0 text-muted" />
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
            {t('owner.yourStadiums')}
          </h2>
          {isOwner && (
            <Button as={Link} to="/owner/stadiums/new" size="sm" variant="outline">
              {t('owner.addStadium')}
            </Button>
          )}
        </div>
        {!loading && stadiums.length === 0 ? (
          <EmptyState
            icon={<FiHome size={22} />}
            title={t('owner.noStadiums')}
            description={t('owner.noStadiumsDesc')}
            action={
              isOwner ? (
                <Button as={Link} to="/owner/stadiums/new">
                  {t('owner.addStadium')}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stadiums.map((s) => (
              <Card key={s._id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{s.name}</CardTitle>
                  <Badge
                    variant={
                      s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'error'
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted dark:text-dark-muted">
                  {s.location?.city || t('owner.noCity')}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-forest dark:text-dark-primary">
                  <Link to={`/owner/stadiums/${s._id}`} className="hover:underline">
                    {t('owner.openStadium')} →
                  </Link>
                  <Link to={`/owner/slots?stadiumId=${s._id}`} className="hover:underline">
                    {t('owner.navSlots')}
                  </Link>
                  <Link to={`/owner/stadiums/${s._id}?tab=fields`} className="hover:underline">
                    {t('owner.tabFields')}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
