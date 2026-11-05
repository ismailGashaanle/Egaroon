import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FiMenu,
  FiX,
  FiLogOut,
  FiGrid,
  FiChevronDown,
  FiChevronRight,
  FiKey,
  FiCalendar,
  FiSettings,
  FiArrowRight,
  FiHome,
  FiMapPin,
  FiLayers,
  FiInfo,
  FiMail,
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Avatar from '../common/Avatar';
import DropdownMenu, {
  DropdownItem,
  DropdownLink,
  DropdownHeader,
  DropdownDivider,
} from '../common/DropdownMenu';
import { useAuth } from '../../hooks/useAuth';
import { logoutUser } from '../../features/auth/authSlice';
import { dashboardPathForRole, ROLES } from '../../lib/roles';
import { useTranslation, useLanguage } from '../../i18n/LanguageContext';
import { useSiteContent } from '../../i18n/SiteContentContext';
import toast from 'react-hot-toast';

function roleLabel(t, role) {
  switch (role) {
    case ROLES.STADIUM_OWNER:
      return t('nav.roleOwner');
    case ROLES.STADIUM_MANAGER:
      return t('nav.roleManager');
    case ROLES.ADMIN:
      return t('nav.roleAdmin');
    case ROLES.SUPER_ADMIN:
      return t('nav.roleSuperAdmin');
    default:
      return t('nav.roleCaptain');
  }
}

function displayName(user) {
  const name = String(user?.name || '').trim();
  if (name) return name.split(/\s+/)[0];
  const email = String(user?.email || '');
  return email.split('@')[0] || 'E-Garoon';
}

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.home', end: true, icon: FiHome },
  { to: '/stadiums', labelKey: 'nav.fields', icon: FiMapPin },
  { to: '/services', labelKey: 'nav.services', icon: FiLayers },
  { to: '/about', labelKey: 'nav.about', icon: FiInfo },
  { to: '/contact', labelKey: 'nav.contact', icon: FiMail },
];

function AccountMenu({ user, firstName, role, t, dash, isCaptain, onLogout }) {
  return (
    <DropdownMenu
      align="end"
      menuClassName="min-w-[15.5rem] rounded-2xl"
      trigger={({ open: menuOpen }) => (
        <button
          type="button"
          className={clsx(
            'focus-ring flex items-center gap-2 rounded-full py-0.5 ps-0.5 pe-2 text-sm font-medium transition-colors',
            menuOpen
              ? 'bg-charcoal/[0.06] dark:bg-white/10'
              : 'hover:bg-charcoal/[0.05] dark:hover:bg-white/8'
          )}
          aria-label={user?.name || firstName}
        >
          <Avatar src={user?.avatar} name={user?.name || firstName} size="sm" />
          <span className="hidden max-w-[7rem] truncate text-charcoal xl:inline dark:text-dark-text">{firstName}</span>
          <FiChevronDown
            size={14}
            className={clsx('hidden text-muted transition-transform sm:block', menuOpen && 'rotate-180')}
          />
        </button>
      )}
    >
      <DropdownHeader>
        <p className="truncate font-display text-sm font-bold text-charcoal dark:text-dark-text">
          {user?.name || firstName}
        </p>
        <p className="text-[11px] font-medium text-muted dark:text-dark-muted">{roleLabel(t, role)}</p>
      </DropdownHeader>
      <DropdownLink as={Link} to={dash} className="items-center">
        <FiGrid size={15} /> {t('nav.dashboard')}
      </DropdownLink>
      {isCaptain && (
        <>
          <DropdownLink as={Link} to="/app/bookings" className="items-center">
            <FiCalendar size={15} /> {t('nav.myBookings')}
          </DropdownLink>
          <DropdownLink as={Link} to="/app/join-match" className="items-center">
            <FiKey size={15} /> {t('nav.completePayment')}
          </DropdownLink>
          <DropdownLink as={Link} to="/app/settings" className="items-center">
            <FiSettings size={15} /> {t('nav.settings')}
          </DropdownLink>
        </>
      )}
      <DropdownDivider />
      <DropdownItem danger onClick={onLogout}>
        <FiLogOut size={15} /> {t('nav.logout')}
      </DropdownItem>
    </DropdownMenu>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, role } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const { t, isRtl } = useTranslation();
  const { langs } = useLanguage();
  const { content, lc } = useSiteContent();

  const promo = content?.navbar?.promoBanner;
  const promoText = promo?.enabled ? lc(promo.text) : '';
  const isCaptain = isAuthenticated && role === ROLES.TEAM_CAPTAIN;
  const dash = dashboardPathForRole(role);
  const firstName = displayName(user);
  const slide = isRtl ? '-100%' : '100%';

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.success(t('common.loggedOut'));
    setOpen(false);
    navigate('/');
  };

  const closeMenu = () => setOpen(false);

  return (
    <header
      className={clsx(
        'site-header sticky top-0 z-50 pt-[env(safe-area-inset-top)]',
        scrolled && 'is-scrolled'
      )}
    >
      {promoText && (
        <div className="bg-brand-navy px-4 text-center text-[11px] font-medium leading-snug tracking-wide text-white sm:text-xs">
          {promo.href ? (
            <Link to={promo.href} className="block py-2 hover:underline">
              {promoText}
            </Link>
          ) : (
            <p className="py-2">{promoText}</p>
          )}
        </div>
      )}

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:gap-6 lg:px-8">
        <Link to="/" className="min-w-0 shrink-0" aria-label="E-Garoon" onClick={closeMenu}>
          <Logo className="[&>span]:max-[24rem]:hidden [&>span]:text-base sm:[&>span]:inline sm:[&>span]:text-lg" />
        </Link>

        <nav
          className="site-nav-scroller hidden min-w-0 flex-1 items-center overflow-x-auto lg:flex"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'site-nav-link shrink-0 whitespace-nowrap px-2.5 py-2 font-medium tracking-tight transition-colors xl:px-3.5',
                  'text-[clamp(0.75rem,0.68rem+0.35vw,0.875rem)]',
                  isActive
                    ? 'is-active text-charcoal dark:text-white'
                    : 'text-muted hover:text-charcoal dark:text-dark-muted dark:hover:text-dark-text'
                )
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <div className="hidden items-center lg:flex">
            <LanguageSwitcher compact ghost />
            <ThemeToggle compact ghost />
            <span className="mx-2 h-4 w-px bg-border dark:bg-dark-border" aria-hidden />
          </div>

          {isAuthenticated ? (
            <div className="hidden md:block">
              <AccountMenu
                user={user}
                firstName={firstName}
                role={role}
                t={t}
                dash={dash}
                isCaptain={isCaptain}
                onLogout={handleLogout}
              />
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-[clamp(0.75rem,0.7rem+0.3vw,0.875rem)] font-medium text-muted transition-colors hover:bg-charcoal/[0.05] hover:text-charcoal md:inline-flex dark:text-dark-muted dark:hover:bg-white/8 dark:hover:text-dark-text"
            >
              {t('nav.login')}
            </Link>
          )}

          {!isAuthenticated && (
            <Link
              to="/register"
              className="hidden whitespace-nowrap rounded-full border border-brand-green px-3.5 py-2 text-[clamp(0.75rem,0.7rem+0.3vw,0.875rem)] font-semibold text-brand-green transition-colors hover:bg-brand-green hover:text-white md:inline-flex"
            >
              {t('nav.register')}
            </Link>
          )}

          <Link
            to="/search-fields"
            className="ms-1 inline-flex h-9 max-w-[9.5rem] items-center justify-center gap-1.5 truncate rounded-full bg-brand-green px-3 text-[13px] font-semibold text-white transition-colors hover:bg-forest-dark sm:h-10 sm:max-w-none sm:px-4"
          >
            <span className="truncate">{t('nav.book')}</span>
            <FiArrowRight size={14} className={clsx('hidden shrink-0 sm:block', isRtl && 'rotate-180')} />
          </Link>

          <button
            type="button"
            className="focus-ring ms-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-warmwhite text-charcoal lg:hidden dark:bg-dark-surface-2 dark:text-dark-text"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            aria-label={t('nav.openMenu')}
          >
            <FiMenu size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <div className="lg:hidden" id="site-mobile-nav">
            <motion.button
              type="button"
              aria-label={t('nav.closeMenu')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-brand-navy/45"
              onClick={closeMenu}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t('nav.openMenu')}
              initial={reduce ? false : { x: slide }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: slide }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="site-mobile-overlay fixed inset-y-0 end-0 z-[70] flex w-full flex-col pt-[env(safe-area-inset-top)] shadow-modal sm:max-w-[26rem] sm:border-s sm:border-border dark:sm:border-dark-border"
            >
              <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-5">
                <Link to="/" className="min-w-0" aria-label="E-Garoon" onClick={closeMenu}>
                  <Logo className="[&>span]:text-base sm:[&>span]:text-lg" />
                </Link>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warmwhite text-charcoal dark:bg-dark-surface-2 dark:text-dark-text"
                  onClick={closeMenu}
                  aria-label={t('nav.closeMenu')}
                >
                  <FiX size={20} />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-2 sm:px-5">
                {NAV_ITEMS.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.to}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.045 * i, duration: 0.28 }}
                    >
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={closeMenu}
                        className={({ isActive }) =>
                          clsx(
                            'site-menu-row',
                            isActive
                              ? 'bg-brand-green/10 dark:bg-brand-green/15'
                              : 'bg-warmwhite hover:bg-charcoal/[0.05] dark:bg-dark-surface-2 dark:hover:bg-white/8'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={clsx(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                                isActive
                                  ? 'bg-brand-green text-white'
                                  : 'bg-white text-charcoal dark:bg-dark-bg dark:text-dark-text'
                              )}
                            >
                              <Icon size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span
                                className={clsx(
                                  'mt-0.5 block text-[clamp(1.02rem,4.4vw,1.28rem)] font-semibold leading-snug',
                                  isActive ? 'text-forest' : 'text-charcoal dark:text-dark-text'
                                )}
                              >
                                {t(item.labelKey)}
                              </span>
                            </span>
                            <span
                              className={clsx(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                isActive ? 'bg-brand-green/15 text-forest' : 'text-muted'
                              )}
                            >
                              <FiChevronRight size={18} className={isRtl ? 'rotate-180' : ''} />
                            </span>
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  );
                })}

                {isAuthenticated && (
                  <div className="mt-3 rounded-2xl border border-border p-3 dark:border-dark-border">
                    <div className="flex items-center gap-3">
                      <Avatar src={user?.avatar} name={user?.name || firstName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-charcoal dark:text-dark-text">
                          {user?.name || firstName}
                        </p>
                        <p className="text-[11px] text-muted dark:text-dark-muted">{roleLabel(t, role)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col">
                      <Link
                        to={dash}
                        onClick={closeMenu}
                        className="flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-medium text-charcoal dark:text-dark-text"
                      >
                        <FiGrid size={16} /> {t('nav.dashboard')}
                      </Link>
                      {isCaptain && (
                        <>
                          <Link
                            to="/app/bookings"
                            onClick={closeMenu}
                            className="flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-medium text-charcoal dark:text-dark-text"
                          >
                            <FiCalendar size={16} /> {t('nav.myBookings')}
                          </Link>
                          <Link
                            to="/app/settings"
                            onClick={closeMenu}
                            className="flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-medium text-charcoal dark:text-dark-text"
                          >
                            <FiSettings size={16} /> {t('nav.settings')}
                          </Link>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 rounded-lg px-1 py-2.5 text-start text-sm font-medium text-status-cancelled-text"
                      >
                        <FiLogOut size={16} /> {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </nav>

              <div className="border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-dark-border">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 rounded-lg bg-warmwhite p-0.5 dark:bg-dark-surface-2">
                    {langs.map((item) => (
                      <LangChip key={item.code} code={item.code} />
                    ))}
                  </div>
                  <ThemeToggle compact ghost />
                </div>
                <div className="grid gap-2">
                  {!isAuthenticated && (
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-center text-sm font-semibold leading-snug text-charcoal dark:border-dark-border dark:text-dark-text"
                    >
                      {t('nav.login')}
                    </Link>
                  )}
                  {!isAuthenticated && (
                    <Link
                      to="/register"
                      onClick={closeMenu}
                      className="flex min-h-11 items-center justify-center rounded-full border border-brand-green px-4 text-center text-sm font-semibold leading-snug text-brand-green"
                    >
                      {t('nav.register')}
                    </Link>
                  )}
                  <Link
                    to="/search-fields"
                    onClick={closeMenu}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-center text-[15px] font-semibold leading-snug text-white"
                  >
                    <span className="text-balance">{t('nav.bookNow')}</span>
                    <FiArrowRight size={16} className={clsx('shrink-0', isRtl && 'rotate-180')} />
                  </Link>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}

function LangChip({ code }) {
  const { lang, setLang } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLang(code)}
      className={clsx(
        'rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
        lang === code
          ? 'bg-white text-charcoal shadow-soft dark:bg-dark-bg dark:text-dark-text'
          : 'text-muted hover:text-charcoal dark:text-dark-muted dark:hover:text-dark-text'
      )}
    >
      {code}
    </button>
  );
}
