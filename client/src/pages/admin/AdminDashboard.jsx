import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiHome, FiClock, FiShield, FiArrowRight, FiCalendar, FiCreditCard } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Stagger, StaggerItem } from '../../components/common/Stagger';
import { SkeletonStatRow } from '../../components/common/Skeleton';
import { adminApi } from '../../api/adminApi';
import { stadiumApi } from '../../api/stadiumApi';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/LanguageContext';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [userCount, setUserCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [stadiumCount, setStadiumCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, pendingRes, allRes] = await Promise.all([
          adminApi.listUsers(),
          stadiumApi.list({ status: 'pending' }),
          stadiumApi.list({}),
        ]);
        setUserCount(usersRes.data.data.users.length);
        setPendingCount(pendingRes.data.data.stadiums.length);
        setStadiumCount(allRes.data.data.stadiums.length);
      } catch (err) {
        toast.error(err.response?.data?.error?.message || t('admin.dashFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const quickLinks = [
    {
      to: '/admin/users',
      label: t('admin.manageUsers'),
      icon: <FiUsers />,
      desc: t('admin.usersCount', { n: userCount ?? '—' }),
    },
    {
      to: '/admin/stadiums',
      label: t('admin.reviewStadiums'),
      icon: <FiHome />,
      desc: t('admin.pendingCount', { n: pendingCount ?? '—' }),
    },
    {
      to: '/admin/bookings',
      label: t('admin.bookingsSettle'),
      icon: <FiCalendar />,
      desc: t('admin.bookingsSettleDesc'),
    },
    {
      to: '/admin/payments',
      label: t('admin.paymentReview'),
      icon: <FiCreditCard />,
      desc: t('admin.paymentReviewDesc'),
    },
  ];

  return (
    <PageTransition>
      <PageHeader title={t('admin.console')} description={t('admin.consoleDesc')} />

      {loading ? (
        <SkeletonStatRow />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              icon={<FiUsers />}
              label={t('admin.usersOps')}
              value={userCount ?? '—'}
              trend={5}
              trendLabel={t('admin.thisMonth')}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard icon={<FiHome />} label={t('admin.totalStadiums')} value={stadiumCount ?? '—'} accent="olive" />
          </StaggerItem>
          <StaggerItem>
            <StatCard icon={<FiClock />} label={t('admin.pendingReview')} value={pendingCount ?? '—'} accent="accent" />
          </StaggerItem>
          <StaggerItem>
            <StatCard icon={<FiShield />} label={t('admin.scope')} value={t('admin.scopeOps')} />
          </StaggerItem>
        </Stagger>
      )}

      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <StaggerItem key={link.to}>
            <Card hover className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/10 dark:text-dark-primary">
                  {link.icon}
                </div>
                <Button as={Link} to={link.to} variant="ghost" size="sm" icon={<FiArrowRight />} />
              </div>
              <h3 className="mt-4 text-h3 text-charcoal dark:text-dark-text">{link.label}</h3>
              <p className="mt-1 text-sm text-muted dark:text-dark-muted">{link.desc}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </PageTransition>
  );
}
