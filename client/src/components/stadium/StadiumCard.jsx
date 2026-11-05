import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiStar, FiHeart } from 'react-icons/fi';
import Card from '../common/Card';
import CldImage from '../common/CldImage';

export default function StadiumCard({ stadium }) {
  const image = stadium.images?.[0];
  const [saved, setSaved] = useState(false);
  const isPopular = (stadium.ratingAverage || 0) >= 4.5 && (stadium.ratingCount || 0) >= 3;

  return (
    <Card hover className="overflow-hidden">
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-forest/20 to-olive/20">
        <Link to={`/stadiums/${stadium._id}`}>
          {image ? (
            <CldImage
              src={image}
              alt={stadium.name}
              width={640}
              height={352}
              crop
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-forest/40 dark:text-dark-primary/40">
              <FiMapPin size={32} />
            </div>
          )}
        </Link>

        {isPopular && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow-soft">
            Popular
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setSaved((v) => !v);
          }}
          aria-label={saved ? 'Remove from favorites' : 'Save to favorites'}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-charcoal shadow-soft transition-transform hover:scale-105 dark:bg-dark-surface dark:text-dark-text"
        >
          <FiHeart className={saved ? 'fill-status-cancelled-text text-status-cancelled-text' : ''} />
        </button>
      </div>

      <Link to={`/stadiums/${stadium._id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-bold text-charcoal dark:text-dark-text">{stadium.name}</h3>
          {stadium.fieldCount ? (
            <span className="whitespace-nowrap text-xs font-semibold text-muted dark:text-dark-muted">
              {stadium.fieldCount} {stadium.fieldCount === 1 ? 'field' : 'fields'}
            </span>
          ) : null}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted dark:text-dark-muted">
          <FiMapPin className="text-forest dark:text-dark-primary" />
          {[stadium.location?.area, stadium.location?.city].filter(Boolean).join(', ') || 'Location TBD'}
          {typeof stadium.distanceKm === 'number' && (
            <span className="font-semibold text-forest dark:text-dark-primary">
              · {stadium.distanceKm} km
            </span>
          )}
        </p>

        {Array.isArray(stadium.sizePrices) && stadium.sizePrices.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {stadium.sizePrices.map((s) => (
              <li
                key={s.type}
                className="flex items-center justify-between text-sm text-charcoal dark:text-dark-text"
              >
                <span className="font-semibold">
                  {s.type}
                  {s.count ? (
                    <span className="ml-1.5 font-medium text-muted dark:text-dark-muted">
                      · {s.count} {s.count === 1 ? 'field' : 'fields'}
                    </span>
                  ) : null}
                </span>
                {s.price != null ? (
                  <span className="font-bold text-forest dark:text-dark-primary">
                    ${Number(s.price).toFixed(0)}
                    <span className="text-xs font-medium text-muted dark:text-dark-muted"> /team</span>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : typeof stadium.startingPrice === 'number' ? (
          <p className="mt-2 text-sm font-bold text-forest dark:text-dark-primary">
            from ${Number(stadium.startingPrice).toFixed(0)}
            <span className="text-xs font-medium text-muted dark:text-dark-muted"> /team</span>
          </p>
        ) : null}

        {stadium.ratingAverage > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-charcoal dark:text-dark-text">
            <FiStar className="text-accent" /> {stadium.ratingAverage.toFixed(1)}
            <span className="text-muted dark:text-dark-muted">({stadium.ratingCount || 0})</span>
          </p>
        )}

        {stadium.facilities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stadium.facilities.slice(0, 5).map((f) => (
              <span
                key={f}
                className="rounded-full border border-border bg-warmwhite px-2.5 py-1 text-xs text-muted dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-muted"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </Link>
    </Card>
  );
}
