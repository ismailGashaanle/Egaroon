import { FiGrid, FiCalendar, FiMapPin, FiUsers, FiSettings, FiUser, FiKey } from 'react-icons/fi';
import AppShell from './AppShell';
import { useTranslation } from '../../i18n/LanguageContext';

/** Menu fudud — kaliya waxa muhiimka ah (ma jiraan "coming soon" badan). */
export default function CaptainLayout() {
  const { t } = useTranslation();

  const navGroups = [
    {
      label: t('captain.main'),
      items: [
        { to: '/app', label: t('captain.home'), icon: <FiGrid />, end: true },
        { to: '/app/bookings', label: t('captain.bookings'), icon: <FiCalendar /> },
        { to: '/app/join-match', label: t('nav.completePayment'), icon: <FiKey /> },
        { to: '/search-fields', label: t('nav.book'), icon: <FiMapPin /> },
        { to: '/app/teams', label: t('captain.myTeam'), icon: <FiUsers /> },
      ],
    },
    {
      label: t('captain.account'),
      items: [{ to: '/app/settings', label: t('nav.settings'), icon: <FiSettings /> }],
    },
  ];

  const mobileBottomNav = [
    { to: '/app', label: t('captain.home'), icon: <FiGrid />, end: true },
    { to: '/app/bookings', label: t('captain.bookings'), icon: <FiCalendar /> },
    { to: '/app/join-match', label: t('nav.payShort'), icon: <FiKey /> },
    { to: '/search-fields', label: t('nav.book'), icon: <FiMapPin /> },
    { to: '/app/settings', label: t('captain.profile'), icon: <FiUser /> },
  ];

  return (
    <AppShell
      navGroups={navGroups}
      title={t('captain.title')}
      mobileBottomNav={mobileBottomNav}
      surface="navy"
    />
  );
}
