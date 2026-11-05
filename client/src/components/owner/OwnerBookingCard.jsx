import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import Badge from '../common/Badge';
import { useTranslation } from '../../i18n/LanguageContext';

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OwnerBookingCard({ booking, card, compact = false }) {
  const { t } = useTranslation();
  const id = booking?._id || card?.bookingId;
  const status = booking?.status || card?.status;
  const stadium = booking?.stadium?.name || card?.stadiumName;
  const field = booking?.field?.name || card?.fieldName;
  const start = booking?.startTime || card?.startTime;
  const teamA = booking?.teamA?.team?.name || card?.captainName || 'Team A';
  const teamB = booking?.teamB?.team?.name;
  const code = booking?.bookingCode || card?.bookingCode;
  const payout = booking?.ownerPayoutAmount;
  const paid = card?.amountPaid;
  const method = card?.paymentMethodLabel || card?.paymentMethod;
  const needsAccept = booking?.needsOwnerAccept;

  return (
    <Link
      to={`/owner/bookings/${id}`}
      className="block rounded-xl border border-border bg-white px-4 py-3 transition-shadow hover:shadow-lifted dark:border-dark-border dark:bg-dark-surface-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-charcoal dark:text-dark-text">
            {stadium} · {field}
          </p>
          <p className="text-sm text-muted">
            {formatWhen(start)}
            {code ? ` · ${code}` : ''}
          </p>
          {!compact && (
            <p className="mt-0.5 text-sm text-muted">
              {teamA}
              {teamB ? ` vs ${teamB}` : ''}
              {card?.captainPhone ? ` · ${card.captainPhone}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={status}>{status}</Badge>
          {needsAccept && <Badge variant="warning">{t('owner.needsAccept')}</Badge>}
          {card?.walkIn && <Badge variant="info">{t('owner.walkInBadge')}</Badge>}
          {booking?.gateCheckedInAt || card?.gateCheckedInAt ? (
            <Badge variant="success">{t('owner.gateOk')}</Badge>
          ) : null}
          {payout != null && (
            <span className="text-sm font-bold tabular-nums">${Number(payout).toFixed(2)}</span>
          )}
          {payout == null && paid != null && (
            <span className="text-sm font-semibold tabular-nums text-muted">
              ${Number(paid).toFixed(2)}
              {method ? ` · ${method}` : ''}
            </span>
          )}
          <FiArrowRight className="text-muted" />
        </div>
      </div>
    </Link>
  );
}
