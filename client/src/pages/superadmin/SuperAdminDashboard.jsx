import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiHome, FiClock, FiAward, FiBarChart2, FiDollarSign, FiActivity } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageTransition from '../../components/common/PageTransition';
import StatCard from '../../components/common/StatCard';
import Card, { CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Stagger, StaggerItem } from '../../components/common/Stagger';
import { adminApi } from '../../api/adminApi';
import { stadiumApi } from '../../api/stadiumApi';
import { ROLES } from '../../lib/roles';

export default function SuperAdminDashboard() {
  const [userCount, setUserCount] = useState(null);
  const [adminCount, setAdminCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [stadiumCount, setStadiumCount] = useState(null);
  const [profit, setProfit] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, adminsRes, pendingRes, allRes, profitRes] = await Promise.all([
          adminApi.listUsers(),
          adminApi.listUsers({ role: ROLES.ADMIN }),
          stadiumApi.list({ status: 'pending' }),
          stadiumApi.list({}),
          adminApi.getProfitReport({ period: 'month' }),
        ]);
        setUserCount(usersRes.data.data.users.length);
        setAdminCount(adminsRes.data.data.users.length);
        setPendingCount(pendingRes.data.data.stadiums.length);
        setStadiumCount(allRes.data.data.stadiums.length);
        setProfit(profitRes.data.data.report);
      } catch (err) {
        toast.error(err.response?.data?.error?.message || 'Failed to load platform stats');
      }
    })();
  }, []);

  return (
    <PageTransition>
      <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">Super Admin</h1>
      <p className="mt-1 text-sm text-muted dark:text-dark-muted">
        Platform-wide authority, monetization, and configuration.
      </p>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StaggerItem>
          <StatCard icon={<FiUsers />} label="Total users" value={userCount ?? '—'} />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={<FiAward />} label="Admins" value={adminCount ?? '—'} accent="olive" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={<FiHome />} label="Stadiums" value={stadiumCount ?? '—'} accent="olive" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={<FiClock />} label="Pending review" value={pendingCount ?? '—'} accent="accent" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={<FiDollarSign />}
            label="30d profit"
            value={profit ? `$${Number(profit.totals.profit).toFixed(2)}` : '—'}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={<FiBarChart2 />}
            label="30d commission"
            value={profit ? `$${Number(profit.totals.commission).toFixed(2)}` : '—'}
            accent="olive"
          />
        </StaggerItem>
      </Stagger>

      <Card className="mt-6 p-5">
        <CardTitle>Monetization</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Commission from settled/paid bookings plus field subscription policy revenue.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button as={Link} to="/super-admin/profit" size="sm" icon={<FiBarChart2 />}>
            Profit reports
          </Button>
          <Button as={Link} to="/super-admin/planner" size="sm" variant="secondary" icon={<FiActivity />}>
            Business planner
          </Button>
          <Button as={Link} to="/super-admin/settings" variant="secondary" size="sm">
            Platform settings
          </Button>
          <Button as={Link} to="/super-admin/users" variant="secondary" size="sm">
            Manage users
          </Button>
        </div>
      </Card>
    </PageTransition>
  );
}
