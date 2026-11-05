import { motion } from 'framer-motion';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../i18n/LanguageContext';

export default function ThemeToggle({ compact = false, onDark = false, ghost = false }) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={t('nav.toggleTheme')}
        className={
          onDark
            ? 'flex h-7 w-7 items-center justify-center text-white/80 transition-colors hover:text-white'
            : ghost
              ? 'focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-charcoal/[0.06] hover:text-charcoal dark:text-dark-muted dark:hover:bg-white/10 dark:hover:text-dark-text'
              : 'focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-forest/40 hover:text-charcoal dark:border-dark-border dark:text-dark-muted dark:hover:text-dark-text'
        }
      >
        {isDark ? <FiMoon size={16} /> : <FiSun size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={t('nav.toggleTheme')}
      className="relative flex h-9 w-16 items-center rounded-full border border-border bg-warmwhite px-1 transition-colors dark:border-dark-border dark:bg-dark-surface-2"
    >
      <motion.span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-white shadow-soft dark:bg-dark-primary"
        animate={{ x: isDark ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {isDark ? <FiMoon size={12} /> : <FiSun size={12} />}
      </motion.span>
    </button>
  );
}
