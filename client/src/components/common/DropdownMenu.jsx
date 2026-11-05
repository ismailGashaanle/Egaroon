import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const OPEN_EVENT = 'kulansiiye-dropdown-open';

export default function DropdownMenu({ trigger, children, align = 'right', className = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const idRef = useRef(`dd-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleOtherOpen = (e) => {
      if (e.detail !== idRef.current) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener(OPEN_EVENT, handleOtherOpen);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: idRef.current }));
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener(OPEN_EVENT, handleOtherOpen);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {typeof trigger === 'function' ? trigger({ open }) : trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute z-50 mt-2 min-w-[13.5rem] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-dropdown dark:border-dark-border dark:bg-dark-surface',
              align === 'left' || align === 'start' ? 'start-0' : 'end-0',
              menuClassName
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({ children, onClick, danger = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors focus-ring',
        danger
          ? 'text-status-cancelled-text hover:bg-status-cancelled-bg/60'
          : 'text-charcoal hover:bg-forest/5 dark:text-dark-text dark:hover:bg-white/5',
        className
      )}
    >
      {children}
    </button>
  );
}

export function DropdownHeader({ children }) {
  return (
    <div className="border-b border-border px-4 py-3 dark:border-dark-border">{children}</div>
  );
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-border dark:border-dark-border" role="separator" />;
}

export function DropdownLink({ to, children, className = '', as: Component = 'a' }) {
  return (
    <Component
      href={to}
      to={to}
      className={clsx(
        'flex items-start gap-3 px-4 py-2.5 text-sm text-charcoal transition-colors hover:bg-forest/5 dark:text-dark-text dark:hover:bg-white/5',
        className
      )}
    >
      {children}
    </Component>
  );
}
