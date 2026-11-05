import clsx from 'clsx';

export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={clsx('inline-flex rounded-xl surface-inset p-1', className)}>
      {tabs.map((tab) => {
        const key = tab.key ?? tab.value ?? tab.label;
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={clsx(
              'focus-ring rounded-lg px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'bg-brand-green text-white shadow-soft'
                : 'text-muted hover:text-charcoal dark:text-dark-muted dark:hover:text-dark-text'
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={clsx('ml-1.5 text-xs', isActive ? 'text-white/80' : 'text-disabled')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PillTabs({ tabs, active, onChange, fullWidth = false, className = '', variant = 'default' }) {
  const isBrand = variant === 'brand';

  return (
    <div
      className={clsx(
        'flex rounded-full p-1',
        isBrand ? 'bg-white/10' : 'surface-inset',
        fullWidth && 'w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const key = tab.key ?? tab.value ?? tab.label;
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={clsx(
              'focus-ring rounded-full px-4 py-2 text-sm font-medium transition-all',
              fullWidth && 'flex-1',
              isActive
                ? 'bg-brand-green text-white shadow-soft'
                : isBrand
                  ? 'bg-white text-charcoal hover:bg-white/90'
                  : 'text-muted hover:text-charcoal dark:text-dark-muted dark:hover:text-dark-text'
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={clsx('ml-1 text-xs', isActive ? 'text-white/80' : 'text-disabled')}>
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
