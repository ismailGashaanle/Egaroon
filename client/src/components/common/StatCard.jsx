import clsx from 'clsx';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import Card from './Card';
import AnimatedNumber from './AnimatedNumber';

export default function StatCard({ icon, label, value, hint, accent = 'forest', trend, trendLabel }) {
  const accentClasses = {
    forest: 'bg-brand-green/10 text-brand-green',
    green: 'bg-brand-green/10 text-brand-green',
    blue: 'bg-brand-blue/15 text-brand-blue',
    olive: 'bg-brand-blue/15 text-brand-blue',
    accent: 'bg-accent/15 text-accent',
    neutral: 'bg-white/10 text-dark-muted',
  };

  const trendUp = trend != null && trend >= 0;

  return (
    <Card className="p-5" hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-medium text-muted dark:text-dark-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-charcoal dark:text-dark-text">
            <AnimatedNumber value={value} />
          </p>
          {hint && <p className="mt-1 text-xs text-disabled">{hint}</p>}
          {trend != null && (
            <div className={clsx('mt-2 flex items-center gap-1 text-xs font-medium', trendUp ? 'text-status-confirmed-text' : 'text-status-cancelled-text')}>
              {trendUp ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
              <span>{Math.abs(trend)}%</span>
              {trendLabel && <span className="text-disabled">{trendLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accentClasses[accent] || accentClasses.forest)}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
