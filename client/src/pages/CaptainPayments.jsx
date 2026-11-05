import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCreditCard } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { paymentApi } from '../api/bookingApi';

const STATUS_VARIANT = {
  PENDING: 'warning',
  PROCESSING: 'info',
  HELD: 'success',
  SUCCESS: 'success',
  SETTLED: 'success',
  FAILED: 'danger',
  REFUNDED: 'muted',
};

export default function CaptainPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await paymentApi.listMine();
        setPayments(data.data.payments || []);
      } catch {
        toast.error('Failed to load payments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageTransition>
      <PageHeader
        title="Payments"
        description="Your payment history for match bookings."
        breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Payments' }]}
      />

      {loading && <div className="h-40 animate-pulse rounded-2xl bg-border/40" />}

      {!loading && payments.length === 0 && (
        <EmptyState
          icon={<FiCreditCard size={22} />}
          title="No payments yet"
          description="Pay from an active booking to see receipts here."
          action={<Button as={Link} to="/app/bookings" variant="outline">View bookings</Button>}
        />
      )}

      {!loading && payments.length > 0 && (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2"
            >
              <div>
                <p className="font-semibold text-charcoal dark:text-dark-text">
                  {p.booking?.stadium?.name || 'Stadium'} · {p.booking?.field?.name || 'Field'}
                </p>
                <p className="text-sm text-muted dark:text-dark-muted">
                  {p.booking?.startTime
                    ? new Date(p.booking.startTime).toLocaleString()
                    : new Date(p.createdAt).toLocaleString()}
                  {' · '}
                  {p.provider}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={STATUS_VARIANT[p.status] || 'info'}>{p.status}</Badge>
                <p className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
                  ${Number(p.amount).toFixed(2)}
                </p>
                {p.booking?._id && (
                  <Button as={Link} to={`/app/bookings/${p.booking._id}`} size="sm" variant="outline">
                    Booking
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
