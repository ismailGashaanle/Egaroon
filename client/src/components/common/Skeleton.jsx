import { motion } from 'framer-motion';
import clsx from 'clsx';

export function Skeleton({ className = '', ...props }) {
  return <div className={clsx('skeleton rounded-lg', className)} {...props} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="surface-card rounded-2xl p-5 shadow-soft"
    >
      <Skeleton className="mb-4 h-40 w-full rounded-xl" />
      <Skeleton className="mb-2 h-5 w-3/4" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-4 w-full" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </motion.div>
  );
}

export function SkeletonStatRow({ count = 4 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card rounded-2xl p-5 shadow-soft">
          <Skeleton className="mb-3 h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </motion.div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="surface-card overflow-hidden rounded-2xl shadow-soft"
    >
      <div className="border-b border-border p-4 dark:border-dark-border">
        <Skeleton className="h-5 w-48" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0 dark:border-dark-border/60">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </motion.div>
  );
}
