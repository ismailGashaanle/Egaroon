import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiInbox } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Badge from '../components/common/Badge';
import { notificationApi } from '../api/bookingApi';

export default function CaptainMessages() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await notificationApi.list();
      setItems(data.data.notifications || []);
      setUnread(data.data.unread || 0);
    } catch {
      toast.error('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      load();
    } catch {
      /* ignore */
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Messages"
        description="Match invites and payment reminders."
        breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Messages' }]}
        actions={<Badge variant="neutral">{unread} unread</Badge>}
      />

      {loading && <div className="h-24 animate-pulse rounded-2xl bg-border/40" />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={<FiInbox size={22} />}
          title="Inbox is empty"
          description="When someone invites you to a match by phone, the pay reminder appears here."
        />
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <button
            key={n._id}
            type="button"
            onClick={() => markRead(n._id)}
            className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
              n.readAt
                ? 'border-border bg-white dark:border-dark-border dark:bg-dark-surface-2'
                : 'border-brand-green/40 bg-brand-green/5 dark:border-dark-primary/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-charcoal dark:text-dark-text">{n.title}</p>
              <span className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm text-muted dark:text-dark-muted">{n.body}</p>
            {n.booking && (
              <Link
                to={`/app/bookings/${n.booking}`}
                className="mt-2 inline-block text-sm font-medium text-brand-green hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Open booking →
              </Link>
            )}
          </button>
        ))}
      </div>
    </PageTransition>
  );
}
