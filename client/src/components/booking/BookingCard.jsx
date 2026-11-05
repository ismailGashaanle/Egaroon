import { isHoldExpired } from '../../lib/bookingGroups';
import { Link } from 'react-router-dom';
import { FiUsers, FiCreditCard } from 'react-icons/fi';
import Badge from '../common/Badge';

function RouteTimeline() {
  return (
    <div className="flex shrink-0 flex-col items-center py-1">
      <div className="h-3 w-3 rounded-full bg-brand-green ring-2 ring-brand-green/20" />
      <div className="my-1 w-px flex-1 border-l-2 border-dashed border-brand-green/40" style={{ minHeight: '2rem' }} />
      <div className="h-3 w-3 rounded-full border-2 border-brand-green bg-white" />
    </div>
  );
}

export default function BookingCard({ booking, onDark = false }) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const playersCount =
    (booking.teamA?.playersCount || 0) + (booking.teamB?.playersCount || 0);
  const price = booking.pricing?.totalPrice;

  const cardClass = onDark
    ? 'booking-card-light flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-lifted'
    : 'flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-shadow hover:shadow-lifted dark:border-dark-border dark:bg-dark-surface';

  return (
    <Link to={`/app/bookings/${booking._id}`} className="group block">
      <div className={cardClass}>
        <div className="flex gap-4 p-4">
          <RouteTimeline />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-brand-green">
                  {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <h4 className="font-display font-bold text-charcoal">
                  {booking.field?.name || 'Field'}
                </h4>
                <p className="mt-0.5 text-sm text-muted">
                  {booking.stadium?.name || 'Stadium'}
                  {booking.stadium?.location?.city ? ` · ${booking.stadium.location.city}` : ''}
                </p>
              </div>
              <Badge status={isHoldExpired(booking) ? 'EXPIRED' : booking.status} />
            </div>
            <p className="mt-3 text-xs text-muted">
              {start.toLocaleDateString()} → {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <FiUsers className="text-brand-green" size={15} />
            {playersCount || '—'} {playersCount === 1 ? 'player' : 'players'}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-charcoal">
            <FiCreditCard className="text-brand-green" size={15} />
            {price != null ? `$${price.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </Link>
  );
}
