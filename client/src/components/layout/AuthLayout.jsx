import { Link, Outlet } from 'react-router-dom';
import Logo from '../common/Logo';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-warmwhite lg:grid-cols-2 dark:bg-dark-bg">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>
        <Outlet />
        <p className="mt-10 text-xs text-muted dark:text-dark-muted">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      <div className="relative hidden bg-brand-navy lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
          <h2 className="font-display text-4xl font-bold leading-tight text-white">
            Book a pitch in your city.
            <br />
            Pay your share. Play.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            Live slots, held payments, and nearby captains. Built for football in Somalia.
          </p>
        </div>
      </div>
    </div>
  );
}
