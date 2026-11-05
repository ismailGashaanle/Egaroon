import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import Logo from '../common/Logo';

export default function Sidebar({ navGroups, collapsed = false, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/" className={clsx('border-b border-border px-5 py-5 dark:border-dark-border', collapsed && 'px-3')}>
        <Logo compact={collapsed} />
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label || 'main'} className="mb-6 last:mb-0">
            <AnimatePresence initial={false}>
              {group.label && !collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-2 px-3 text-overline text-disabled"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    clsx(
                      'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-forest text-white shadow-soft dark:bg-dark-primary'
                        : 'text-muted hover:bg-forest/5 hover:text-charcoal dark:text-dark-muted dark:hover:bg-white/5 dark:hover:text-dark-text'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={clsx('text-base', isActive && 'text-white')}>{item.icon}</span>
                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.18 }}
                            className="flex min-w-0 flex-1 items-center gap-2"
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge != null && (
                              <span
                                className={clsx(
                                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                                  isActive
                                    ? 'bg-white text-forest'
                                    : 'bg-forest/10 text-forest dark:bg-dark-primary/20 dark:text-dark-primary'
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                            {item.comingSoon && (
                              <span className="rounded-md bg-charcoal/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-disabled dark:bg-white/10">
                                {group.soonLabel || 'Soon'}
                              </span>
                            )}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
