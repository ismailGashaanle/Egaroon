import { motion } from 'framer-motion';
import { FiKey, FiCheckCircle, FiCreditCard, FiFlag } from 'react-icons/fi';

const STEPS = [
  { key: 'code', label: 'Code', icon: FiKey },
  { key: 'confirm', label: 'Xaqiiji', icon: FiCheckCircle },
  { key: 'pay', label: 'Bixi', icon: FiCreditCard },
  { key: 'done', label: 'Dhammee', icon: FiFlag },
];

/**
 * Visual join steps: 1 Code → 2 Confirm → 3 Pay → 4 Done
 * @param {'code'|'confirm'|'pay'|'done'} active
 */
export function JoinMatchSteps({ active = 'code' }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === active));
  return (
    <ol className="mb-5 flex items-center justify-between gap-1">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 rounded ${done || current ? 'bg-brand-green' : 'bg-border dark:bg-dark-border'}`}
                />
              )}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  done
                    ? 'bg-brand-green text-white'
                    : current
                      ? 'bg-brand-green/15 text-brand-green ring-2 ring-brand-green/40'
                      : 'bg-warmwhite text-muted dark:bg-dark-elevated dark:text-dark-muted'
                }`}
              >
                <Icon size={14} />
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded ${done ? 'bg-brand-green' : 'bg-border dark:bg-dark-border'}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                current ? 'text-brand-green' : 'text-muted dark:text-dark-muted'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Match payment progress bar (Team A paid ≈ 50%, both ≈ 100%).
 */
export function MatchPaymentProgress({ progress, className = '' }) {
  const percent = Math.min(100, Math.max(0, Number(progress?.percent || 0)));
  const paid = Number(progress?.paidAmount || 0);
  const total = Number(progress?.totalPrice || 0);
  const remaining = Number(progress?.remainingAmount ?? Math.max(0, total - paid));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted dark:text-dark-muted">Lacagta la bixiyay</p>
          <p className="font-display text-2xl font-bold tabular-nums text-charcoal dark:text-dark-text">
            {percent}%
          </p>
        </div>
        <p className="text-right text-xs text-muted dark:text-dark-muted">
          ${paid.toFixed(2)} / ${total.toFixed(2)}
          {remaining > 0 && (
            <>
              <br />
              Hadhay: ${remaining.toFixed(2)}
            </>
          )}
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-warmwhite dark:bg-dark-elevated">
        <motion.div
          className="h-full rounded-full bg-brand-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted dark:text-dark-muted">
        <span>Team A {progress?.teamAPaid ? '✓' : '…'}</span>
        <span>Team B {progress?.teamBPaid ? '✓' : '…'}</span>
      </div>
    </div>
  );
}
