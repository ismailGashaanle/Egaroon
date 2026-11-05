import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Spinner({ size = 24, className = '' }) {
  return (
    <motion.span
      className={clsx('inline-block rounded-full border-2 border-forest/20 border-t-forest', className)}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}
