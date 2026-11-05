import { motion } from 'framer-motion';
import clsx from 'clsx';
import { FiLoader } from 'react-icons/fi';

const motionCache = new Map();
function toMotionComponent(Component) {
  if (Component === motion.button) return Component;
  if (typeof Component === 'string' && motion[Component]) return motion[Component];
  if (!motionCache.has(Component)) {
    const wrapped = typeof motion.create === 'function' ? motion.create(Component) : motion(Component);
    motionCache.set(Component, wrapped);
  }
  return motionCache.get(Component);
}

const VARIANTS = {
  primary: 'bg-brand-green text-white hover:bg-forest-dark shadow-soft disabled:opacity-60',
  secondary: 'bg-white text-brand-green border border-brand-green/25 hover:bg-brand-green/5 dark:bg-dark-surface dark:text-brand-green dark:border-dark-border dark:hover:bg-white/5',
  ghost: 'bg-transparent text-charcoal hover:bg-charcoal/5 dark:text-dark-text dark:hover:bg-white/5',
  link: 'bg-transparent text-brand-green underline-offset-4 hover:underline dark:text-brand-green p-0 shadow-none',
  danger: 'bg-status-cancelled-text text-white hover:bg-[#8b2f29]',
  outline: 'bg-transparent border border-border text-charcoal hover:border-brand-green hover:text-brand-green dark:border-dark-border dark:text-dark-text dark:hover:border-brand-green dark:hover:text-brand-green',
};

const SIZES = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2',
  icon: 'p-2.5 rounded-xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  icon = null,
  iconOnly = false,
  as: Component = motion.button,
  ...props
}) {
  const MotionComponent = toMotionComponent(Component);
  const isLink = variant === 'link';
  const sizeClass = iconOnly ? SIZES.icon : SIZES[size] || SIZES.md;

  return (
    <MotionComponent
      disabled={disabled || loading}
      className={clsx(
        'focus-ring inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        !isLink && !disabled && !loading && 'active:scale-[0.98]',
        VARIANTS[variant],
        sizeClass,
        className
      )}
      {...props}
    >
      {loading ? <FiLoader className="animate-spin" size={iconOnly ? 18 : undefined} /> : icon}
      {!iconOnly && children}
    </MotionComponent>
  );
}
