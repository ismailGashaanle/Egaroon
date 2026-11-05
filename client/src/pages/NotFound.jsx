import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/common/Button';
import Logo from '../components/common/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <motion.div
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="text-forest/40 dark:text-dark-primary/40"
      >
        <Logo showWordmark={false} size="lg" />
      </motion.div>
      <h1 className="mt-6 font-display text-3xl font-bold text-charcoal dark:text-dark-text">
        404 — Off the pitch
      </h1>
      <p className="mt-2 max-w-sm text-muted dark:text-dark-muted">
        This page doesn't exist. Let's get you back in the game.
      </p>
      <Button as={Link} to="/" className="mt-6">
        Back home
      </Button>
    </div>
  );
}
