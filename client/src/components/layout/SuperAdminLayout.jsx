import { FiGrid, FiUsers, FiHome, FiSettings, FiEdit3, FiBarChart2, FiUserPlus, FiGift, FiActivity, FiFileText, FiDollarSign } from 'react-icons/fi';
import AppShell from './AppShell';

const navGroups = [
  {
    label: 'Platform',
    items: [
      { to: '/super-admin', label: 'Overview', icon: <FiGrid />, end: true },
      { to: '/super-admin/finance', label: 'Waaxda Maaliyadda & Payouts', icon: <FiDollarSign /> },
      { to: '/super-admin/profit', label: 'Profit reports', icon: <FiBarChart2 /> },
      { to: '/super-admin/subscriptions', label: 'Subscriptions ($7/Field)', icon: <FiDollarSign /> },
      { to: '/super-admin/planner', label: 'Business planner', icon: <FiActivity /> },
      { to: '/super-admin/gifts', label: 'Free match gifts', icon: <FiGift /> },
      { to: '/super-admin/owner-onboardings', label: 'Register owners', icon: <FiUserPlus /> },
      { to: '/super-admin/agreements', label: 'Stadium Agreements', icon: <FiFileText /> },
      { to: '/super-admin/users', label: 'Users & Admins', icon: <FiUsers /> },
      { to: '/super-admin/stadiums', label: 'Stadiums', icon: <FiHome /> },
      { to: '/super-admin/settings', label: 'Platform Settings', icon: <FiSettings /> },
      { to: '/super-admin/site-content', label: 'Site Content', icon: <FiEdit3 /> },
    ],
  },
];

export default function SuperAdminLayout() {
  return <AppShell navGroups={navGroups} title="Super Admin" showSearch={false} />;
}
