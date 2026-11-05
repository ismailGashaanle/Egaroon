import { forwardRef } from 'react';
import clsx from 'clsx';
import { FiChevronDown } from 'react-icons/fi';

const Select = forwardRef(function Select({ label, error, className = '', containerClassName = '', children, ...props }, ref) {
  return (
    <div className={clsx('w-full', containerClassName)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-charcoal dark:text-dark-text">{label}</label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={clsx(
            'w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-9 text-sm text-charcoal outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/20 dark:bg-dark-surface-2 dark:text-dark-text dark:border-dark-border dark:focus:border-dark-primary dark:focus:ring-dark-primary/20',
            error ? 'border-status-cancelled-text' : 'border-border',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <FiChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto text-xs text-muted dark:text-dark-muted" />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-status-cancelled-text">{error}</p>}
    </div>
  );
});

export default Select;
