import clsx from 'clsx';
import CldImage from './CldImage';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

const PX = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };

function initialsFrom(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || 'K').toUpperCase();
}

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizeClass = SIZES[size] || SIZES.md;
  const px = PX[size] || PX.md;

  if (src) {
    return (
      <CldImage
        src={src}
        alt={name || 'User avatar'}
        width={px}
        height={px}
        crop
        className={clsx(
          'shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-dark-surface',
          sizeClass,
          className
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-forest font-semibold text-white dark:bg-dark-primary',
        sizeClass,
        className
      )}
      aria-hidden={!name}
    >
      {initialsFrom(name)}
    </span>
  );
}
