import clsx from 'clsx';
import { classesForStatus, labelForStatus } from '../../lib/statusStyles';

const VARIANT_CLASSES = {
  success: 'bg-status-confirmed-bg text-status-confirmed-text',
  warning: 'bg-status-pending-bg text-status-pending-text',
  error: 'bg-status-cancelled-bg text-status-cancelled-text',
  info: 'bg-status-info-bg text-status-info-text',
  neutral: 'bg-charcoal/5 text-muted dark:bg-white/10 dark:text-dark-muted',
  forest: 'bg-forest/10 text-forest dark:bg-dark-primary/10 dark:text-dark-primary',
};

export default function Badge({ status, variant, children, dot = false, className = '' }) {
  const colorClass = variant
    ? VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral
    : classesForStatus(status);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colorClass,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children || labelForStatus(status)}
    </span>
  );
}
