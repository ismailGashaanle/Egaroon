import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import clsx from 'clsx';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../hooks/useAuth';
import { logoutUser } from '../../features/auth/authSlice';
import { dashboardPathForRole } from '../../lib/roles';
import ErrorBoundary from '../common/ErrorBoundary';

export default function AppShell({
  navGroups,
  title = 'Dashboard',
  mobileBottomNav = null,
  showSearch = true,
  collapsedSidebar = false,
  surface = 'default',
  banner = null,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.success('Logged out');
    navigate('/');
  };

  const closeMobile = () => setMobileOpen(false);

  const isNavy = surface === 'navy';

  return (
    <div className={clsx('flex min-h-screen', isNavy ? 'dark surface-navy pattern-grid' : 'surface-page')}>
      {/* Desktop sidebar */}
      <motion.aside
        className="hidden shrink-0 overflow-hidden border-r border-border surface-sidebar lg:block dark:border-dark-border"
        initial={false}
        animate={{ width: collapsedSidebar ? 76 : 256 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Sidebar navGroups={navGroups} collapsed={collapsedSidebar} />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-charcoal/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-50 w-72 surface-sidebar shadow-modal lg:hidden"
            >
              <div className="flex items-center justify-end px-4 pt-4">
                <button onClick={closeMobile} className="focus-ring rounded-lg p-2 text-charcoal dark:text-dark-text">
                  <FiX size={20} />
                </button>
              </div>
              <Sidebar navGroups={navGroups} onNavigate={closeMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header bar */}
        <div className={clsx('flex items-center justify-between border-b px-4 py-3 lg:hidden', isNavy ? 'border-dark-border bg-dark-surface' : 'border-border bg-white dark:border-dark-border dark:bg-dark-surface')}>
          <button onClick={() => setMobileOpen(true)} className="focus-ring rounded-lg p-2 text-charcoal dark:text-dark-text">
            <FiMenu size={20} />
          </button>
          <span className={clsx('font-display text-sm font-bold', isNavy ? 'text-dark-text' : 'text-charcoal dark:text-dark-text')}>{title}</span>
          <span className="w-9" />
        </div>

        <Topbar
          user={user}
          role={role}
          title={title}
          onLogout={handleLogout}
          dashboardPath={dashboardPathForRole(role)}
          showSearch={showSearch}
          dark={isNavy}
        />

        <main className={clsx('flex-1 overflow-x-hidden', mobileBottomNav ? 'pb-20 lg:pb-0' : '')}>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {banner}
            <ErrorBoundary
              key={location.pathname}
              fallback={({ reset }) => (
                <div className="flex flex-col items-center py-16 text-center">
                  <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">
                    Something went offside
                  </h1>
                  <p className="mt-2 max-w-sm text-sm text-muted dark:text-dark-muted">
                    This page hit an unexpected error. Try again, or open another section from the menu.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-6 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-forest-dark"
                  >
                    Try again
                  </button>
                </div>
              )}
            >
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile bottom nav */}
        {mobileBottomNav && (
          <nav className={clsx('fixed inset-x-0 bottom-0 z-40 border-t lg:hidden', isNavy ? 'border-dark-border bg-dark-surface' : 'border-border bg-white dark:border-dark-border dark:bg-dark-surface')}>
            <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
              {mobileBottomNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'focus-ring flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors',
                      isActive ? 'text-brand-green' : isNavy ? 'text-dark-muted' : 'text-muted dark:text-dark-muted'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={clsx('text-lg', isActive && 'scale-110 transition-transform')}>{item.icon}</span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
