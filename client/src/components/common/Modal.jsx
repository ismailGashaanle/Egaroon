import { AnimatePresence, motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-6xl',
};

export default function Modal({
  open: openProp,
  isOpen, // accepted as an alias of `open` — several pages pass `isOpen`
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  hideHeader = false,
  branded = false,
  contentClassName = '',
}) {
  const open = Boolean(openProp ?? isOpen);
  const maxW = SIZE_CLASS[size] || SIZE_CLASS.md;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 print:static print:block print:p-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-brand-navy/55 backdrop-blur-sm print:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className={`relative z-10 flex w-full ${maxW} max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-modal sm:rounded-2xl dark:bg-dark-surface print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:p-0 print:shadow-none ${className}`}
          >
            {branded && !hideHeader && (
              <div className="shrink-0 bg-brand-gradient px-5 py-4 print:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                      E-Garoon
                    </p>
                    {title ? (
                      <h3 className="font-display text-lg font-bold text-white">{title}</h3>
                    ) : null}
                  </div>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg p-1.5 text-white/90 hover:bg-white/15"
                      aria-label="Close"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
              </div>
            )}
            {!branded && !hideHeader && (title || onClose) && (
              <div className="mb-0 flex shrink-0 items-center justify-between px-6 pt-6 print:hidden">
                <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted hover:bg-charcoal/5 dark:text-dark-muted dark:hover:bg-white/5"
                >
                  <FiX />
                </button>
              </div>
            )}
            <div
              className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${
                branded || hideHeader ? '' : 'pt-4'
              } ${contentClassName}`}
            >
              {children}
            </div>
            {footer && (
              <div className="mt-0 flex shrink-0 justify-end gap-3 border-t border-border px-5 py-4 dark:border-dark-border print:hidden sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
