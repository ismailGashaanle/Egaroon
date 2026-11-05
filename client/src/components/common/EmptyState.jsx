import { motion } from 'framer-motion';

export default function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border border-dashed border-border bg-gradient-to-b from-white to-warmwhite/50 text-center dark:border-dark-border dark:from-dark-surface dark:to-dark-surface-2/50 ${compact ? 'px-5 py-10' : 'px-6 py-16'}`}
    >
      <div className="pattern-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative">
        {icon && (
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest/10 text-forest shadow-soft dark:bg-dark-primary/10 dark:text-dark-primary">
            <div className="text-2xl">{icon}</div>
          </div>
        )}
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{title}</h3>
        {description && (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted dark:text-dark-muted">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </motion.div>
  );
}
