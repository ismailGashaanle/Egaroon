import { FiGrid, FiCalendar, FiBarChart2, FiAward, FiHome, FiClock, FiDollarSign, FiUsers, FiFileText, FiShield } from 'react-icons/fi';
import AppShell from './AppShell';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';
import OwnerVerificationBanner from '../owner/OwnerVerificationBanner';

export default function OwnerLayout() {
  const { role, user } = useAuth();
  const { t } = useTranslation();
  const isOwner = role === ROLES.STADIUM_OWNER;

  const navGroups = [
    {
      label: t('owner.navMain'),
      items: [
        { to: '/owner', label: t('owner.navHome'), icon: <FiGrid />, end: true },
        ...(user?.selfRegistered
          ? [{ to: '/owner/verification', label: 'Verification', icon: <FiShield /> }]
          : []),
        { to: '/owner/wallet', label: 'E-Garoon Wallet', icon: <FiDollarSign /> },
        { to: '/owner/slots', label: t('owner.navSlots'), icon: <FiClock /> },
        { to: '/owner/joogto', label: 'Ciyaaraha Joogto (VIP Pass)', icon: <FiAward /> },
        { to: '/owner/bookings', label: t('owner.navGate'), icon: <FiCalendar /> },
        { to: '/owner/payments', label: t('owner.navPayments'), icon: <FiDollarSign /> },
        { to: '/owner/reports', label: t('owner.navReports'), icon: <FiBarChart2 /> },
        { to: '/owner/agreements', label: 'Agreements', icon: <FiFileText /> },
      ],
    },
    {
      label: t('owner.navStadium'),
      items: [
        ...(isOwner
          ? [
              { to: '/owner/subscriptions', label: 'Subscription ($7/Field)', icon: <FiDollarSign /> },
              { to: '/owner/managers', label: t('owner.navManagers'), icon: <FiUsers /> },
              { to: '/owner/tournaments', label: t('owner.navCups'), icon: <FiAward /> },
              { to: '/owner/stadiums/new', label: t('owner.navAddStadium'), icon: <FiHome /> },
            ]
          : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  return (
    <AppShell
      navGroups={navGroups}
      title={isOwner ? t('owner.portalOwner') : t('owner.portalManager')}
      showSearch={false}
      banner={isOwner ? <OwnerVerificationBanner /> : null}
    />
  );
}
