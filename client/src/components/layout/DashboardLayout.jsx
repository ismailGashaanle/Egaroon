import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiLogOut, FiX } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { logoutUser } from '../../features/auth/authSlice';
import { ROLE_LABELS } from '../../lib/roles';
import toast from 'react-hot-toast';

export default function DashboardLayout({ navItems, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.success('Logged out');
    navigate('/');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <Link to="/" className="px-6 py-6">
        <Logo />
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-forest text-white shadow-soft'
                  : 'text-muted hover:bg-forest/5 hover:text-charcoal dark:text-dark-muted dark:hover:bg-white/5 dark:hover:text-dark-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge != null && (
                  <span
                    className={clsx(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                      isActive ? 'bg-white text-forest' : 'bg-forest text-white dark:bg-dark-primary'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-4 dark:border-dark-border">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-semibold text-charcoal dark:text-dark-text">{user?.name}</p>
            <p className="text-xs text-muted dark:text-dark-muted">{ROLE_LABELS[role]}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-status-cancelled-text hover:bg-status-cancelled-bg/60"
        >
          <FiLogOut /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-warmwhite dark:bg-dark-bg">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block dark:border-dark-border dark:bg-dark-surface">
        {SidebarContent}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-charcoal/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-white lg:hidden dark:bg-dark-surface"
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-white px-4 py-4 lg:hidden dark:border-dark-border dark:bg-dark-surface">
          <button onClick={() => setMobileOpen(true)} className="text-charcoal dark:text-dark-text">
            {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <span className="font-display font-bold text-charcoal dark:text-dark-text">{title}</span>
          <span className="w-5" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
