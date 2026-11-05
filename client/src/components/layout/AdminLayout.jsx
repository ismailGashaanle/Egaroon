import { FiGrid, FiUsers, FiHome, FiCalendar, FiCreditCard } from 'react-icons/fi';
import AppShell from './AppShell';

const navGroups = [
  {
    label: 'Console',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <FiGrid />, end: true },
      { to: '/admin/users', label: 'Users', icon: <FiUsers /> },
      { to: '/admin/stadiums', label: 'Stadiums', icon: <FiHome /> },
      { to: '/admin/bookings', label: 'Bookings', icon: <FiCalendar /> },
      { to: '/admin/payments', label: 'Payments', icon: <FiCreditCard /> },
      { to: '/admin/finance', label: 'Waaxda Maaliyadda & Payouts', icon: <FiCreditCard /> },
    ],
  },
];

export default function AdminLayout() {
  return <AppShell navGroups={navGroups} title="Admin Console" showSearch={false} />;
}
