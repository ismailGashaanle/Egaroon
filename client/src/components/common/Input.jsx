import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(function Input(
  { label, error, icon, className = '', containerClassName = '', hint, ...props },
  ref
) {
  return (
    <div className={clsx('w-full', containerClassName)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-charcoal dark:text-dark-text">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted dark:text-dark-muted">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            'focus-ring w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-charcoal outline-none transition-all placeholder:text-disabled focus:border-forest focus:ring-2 focus:ring-forest/20 dark:bg-dark-surface-2 dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:border-dark-primary dark:focus:ring-dark-primary/20',
            icon ? 'pl-10' : '',
            error ? 'border-status-cancelled-text ring-2 ring-status-cancelled-text/20' : 'border-border dark:border-dark-border',
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-muted dark:text-dark-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-status-cancelled-text">{error}</p>}
    </div>
  );
});

export default Input;
