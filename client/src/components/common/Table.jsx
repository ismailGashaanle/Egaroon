import clsx from 'clsx';

export function Table({ children, className = '' }) {
  return (
    <div className={clsx('overflow-x-auto rounded-2xl border border-border bg-white shadow-soft dark:border-dark-border dark:bg-dark-surface', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children }) {
  return (
    <thead className="border-b border-border bg-warmwhite/80 dark:border-dark-border dark:bg-dark-surface-2/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHead({ children, className = '' }) {
  return (
    <th className={clsx('px-4 py-3 text-overline text-muted dark:text-dark-muted', className)}>
      {children}
    </th>
  );
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-border/60 dark:divide-dark-border/60">{children}</tbody>;
}

export function TableRow({ children, className = '', onClick }) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'transition-colors hover:bg-forest/[0.03] dark:hover:bg-white/[0.02]',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={clsx('px-4 py-3.5 text-charcoal dark:text-dark-text', className)}>
      {children}
    </td>
  );
}
