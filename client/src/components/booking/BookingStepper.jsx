import clsx from 'clsx';
import { FiCheck } from 'react-icons/fi';

const STEPS = [
  { key: 'HELD', label: 'Hold' },
  { key: 'PAYMENT_PENDING', label: 'Pay' },
  { key: 'CONFIRMED', label: 'Confirm' },
  { key: 'CHECKED_IN', label: 'Check-in' },
  { key: 'COMPLETED', label: 'Complete' },
];

const STATUS_ORDER = {
  HELD: 0,
  PAYMENT_PENDING: 1,
  CONFIRMED: 2,
  CHECKED_IN: 3,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  SETTLED: 4,
  CANCELLED: -1,
  EXPIRED: -1,
};

export default function BookingStepper({ status }) {
  const current = STATUS_ORDER[status] ?? 0;
  const isCancelled = ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status);

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, i) => {
        const stepIndex = i;
        const done = !isCancelled && current > stepIndex;
        const active = !isCancelled && current === stepIndex;
        const upcoming = !isCancelled && current < stepIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done && 'bg-forest text-white dark:bg-dark-primary',
                  active && 'bg-forest text-white ring-4 ring-forest/20 dark:bg-dark-primary dark:ring-dark-primary/20',
                  upcoming && 'border-2 border-border bg-white text-muted dark:border-dark-border dark:bg-dark-surface',
                  isCancelled && 'border-2 border-status-cancelled-text/30 bg-status-cancelled-bg text-status-cancelled-text'
                )}
              >
                {done ? <FiCheck size={14} /> : i + 1}
              </div>
              <span className={clsx('mt-1.5 text-[10px] font-semibold uppercase tracking-wide', active ? 'text-forest dark:text-dark-primary' : 'text-muted dark:text-dark-muted')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx('mx-1 h-0.5 flex-1', done ? 'bg-forest dark:bg-dark-primary' : 'bg-border dark:bg-dark-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
