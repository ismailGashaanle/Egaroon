import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Card({ children, className = '', hover = false, as = 'div', padding = false, ...props }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={clsx(
        'rounded-2xl border border-border bg-white shadow-card dark:border-dark-border dark:bg-dark-surface',
        hover && 'cursor-pointer transition-shadow duration-200 hover:shadow-lifted',
        padding && 'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={clsx('flex flex-col gap-1.5 pb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={clsx('text-h3 text-charcoal dark:text-dark-text', className)}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={clsx('text-caption text-muted dark:text-dark-muted', className)}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={clsx('', className)}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={clsx('mt-4 flex items-center border-t border-border pt-4 dark:border-dark-border', className)}>
      {children}
    </div>
  );
}
