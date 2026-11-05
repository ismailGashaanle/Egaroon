import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { tournamentApi } from '../api/bookingApi';

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await tournamentApi.list();
        setTournaments(data.data.tournaments || []);
      } catch {
        toast.error('Failed to load tournaments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageTransition className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-charcoal dark:text-dark-text">Tournaments & Cups</h1>
      <p className="mt-2 text-muted dark:text-dark-muted">
        Ramadan cups, university leagues, and stadium competitions. Captains can register after login.
      </p>

      {loading && <div className="mt-8 h-40 animate-pulse rounded-2xl bg-border/40" />}

      {!loading && tournaments.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={<FiAward size={22} />}
            title="No tournaments yet"
            description="Stadium owners can create and publish cups from their dashboard."
          />
        </div>
      )}

      <div className="mt-8 space-y-4">
        {tournaments.map((t) => (
          <div
            key={t._id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface-2"
          >
            <div>
              <h2 className="font-display text-xl font-bold">{t.name}</h2>
              <p className="text-sm text-muted">
                {t.stadium?.name} · {t.maxTeams} teams · ${t.registrationFee} fee
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{t.status}</Badge>
              <Button as={Link} to={`/tournaments/${t._id}`} size="sm">
                View
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
