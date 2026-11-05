import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import clsx from 'clsx';

export default function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className = '',
}) {
  return (
    <div className={clsx('mb-6 sm:mb-8', className)}>
      {breadcrumbs.length > 0 && (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-caption text-muted dark:text-dark-muted">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <FiChevronRight size={12} className="opacity-50" />}
              {crumb.to ? (
                <Link to={crumb.to} className="transition-colors hover:text-forest dark:hover:text-dark-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-charcoal dark:text-dark-text">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-charcoal dark:text-dark-text">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-body text-muted dark:text-dark-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
