import { forwardRef } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(function Textarea(
  { label, error, className = '', containerClassName = '', ...props },
  ref
) {
  return (
    <div className={clsx('w-full', containerClassName)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-charcoal dark:text-dark-text">{label}</label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          'focus-ring w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm text-charcoal outline-none transition-all placeholder:text-disabled focus:border-forest focus:ring-2 focus:ring-forest/20 dark:bg-dark-surface-2 dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:border-dark-primary dark:focus:ring-dark-primary/20',
          error ? 'border-status-cancelled-text' : 'border-border dark:border-dark-border',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-medium text-status-cancelled-text">{error}</p>}
    </div>
  );
});

export default Textarea;
