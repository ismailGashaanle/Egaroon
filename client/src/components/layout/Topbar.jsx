import { Link } from 'react-router-dom';
import { FiBell, FiSearch, FiChevronDown, FiGrid, FiLogOut, FiSettings } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ThemeToggle from '../common/ThemeToggle';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Avatar from '../common/Avatar';
import DropdownMenu, { DropdownItem } from '../common/DropdownMenu';
import { ROLE_LABELS } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';

export default function Topbar({ user, role, title, onLogout, dashboardPath, showSearch = true, dark = false }) {
  const { t } = useTranslation();

  return (
    <header
      className={clsx(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6',
        dark
          ? 'border-dark-border bg-dark-surface'
          : 'border-border bg-white dark:border-dark-border dark:bg-dark-surface'
      )}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <p className="truncate text-sm font-semibold text-charcoal lg:hidden dark:text-dark-text">{title}</p>
        )}
        {showSearch && (
          <div className="relative hidden max-w-md lg:block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" size={16} />
            <input
              type="search"
              placeholder={t('common.search')}
              className="focus-ring w-full rounded-xl border border-border bg-warmwhite/80 py-2 pl-9 pr-4 text-sm text-charcoal placeholder:text-disabled dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
              onFocus={() => toast(t('settings.comingSoon'), { icon: '🔍' })}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher compact />
        <ThemeToggle />

        <button
          type="button"
          aria-label="Notifications"
          onClick={() => toast(t('settings.comingSoon'), { icon: '🔔' })}
          className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-charcoal transition-colors hover:border-forest/30 hover:bg-forest/5 dark:border-dark-border dark:text-dark-text dark:hover:bg-white/5"
        >
          <FiBell size={17} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        <DropdownMenu
          align="right"
          trigger={
            <button
              type="button"
              className="focus-ring flex items-center gap-2 rounded-xl border border-border py-1 pl-1 pr-2.5 transition-colors hover:border-forest/30 dark:border-dark-border"
            >
              <Avatar src={user?.avatar} name={user?.name} size="sm" />
              <span className="hidden max-w-[7rem] truncate text-sm font-medium text-charcoal sm:block dark:text-dark-text">
                {user?.name?.split(' ')[0]}
              </span>
              <FiChevronDown size={14} className="hidden text-muted sm:block dark:text-dark-muted" />
            </button>
          }
        >
          <div className="border-b border-border px-4 py-3 dark:border-dark-border">
            <p className="text-sm font-semibold text-charcoal dark:text-dark-text">{user?.name}</p>
            <p className="text-xs text-muted dark:text-dark-muted">{ROLE_LABELS[role]}</p>
          </div>
          <DropdownItem onClick={() => {}}>
            <Link to={dashboardPath} className="flex w-full items-center gap-2">
              <FiGrid size={15} /> {t('nav.dashboard')}
            </Link>
          </DropdownItem>
          <DropdownItem onClick={() => {}}>
            <Link to="/app/settings" className="flex w-full items-center gap-2">
              <FiSettings size={15} /> {t('nav.settings')}
            </Link>
          </DropdownItem>
          <DropdownItem danger onClick={onLogout}>
            <FiLogOut size={15} /> {t('nav.logout')}
          </DropdownItem>
        </DropdownMenu>
      </div>
    </header>
  );
}
