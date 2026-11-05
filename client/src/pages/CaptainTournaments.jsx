import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Select from '../components/common/Select';
import { tournamentApi } from '../api/bookingApi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyTeams } from '../features/teams/teamSlice';

export default function CaptainTournaments() {
  const dispatch = useDispatch();
  const teams = useSelector((s) => s.teams.items);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamByTournament, setTeamByTournament] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await tournamentApi.list({ status: 'OPEN' });
      setTournaments(data.data.tournaments || []);
    } catch {
      toast.error('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchMyTeams());
    load();
  }, [dispatch]);

  const register = async (tournamentId) => {
    const teamId = teamByTournament[tournamentId] || teams[0]?._id;
    if (!teamId) return toast.error('Create a team first');
    setBusyId(tournamentId);
    try {
      await tournamentApi.register(tournamentId, { teamId });
      toast.success('Registered — pay fee if required');
      const fee = tournaments.find((t) => t._id === tournamentId)?.registrationFee;
      if (fee > 0) {
        await tournamentApi.payFee(tournamentId, { teamId });
        toast.success('Registration fee paid (mock)');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Tournaments"
        description="Browse open cups and register your team."
        breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Tournaments' }]}
        actions={
          <Button as={Link} to="/tournaments" variant="outline" size="sm">
            Public list
          </Button>
        }
      />

      {loading && <div className="h-40 animate-pulse rounded-2xl bg-border/40" />}

      {!loading && tournaments.length === 0 && (
        <EmptyState
          icon={<FiAward size={22} />}
          title="No open tournaments"
          description="When stadium owners publish a cup, it will appear here."
        />
      )}

      <div className="space-y-4">
        {tournaments.map((t) => (
          <div
            key={t._id}
            className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t.name}</h3>
                <p className="text-sm text-muted dark:text-dark-muted">
                  {t.stadium?.name} · {t.stadium?.city} · max {t.maxTeams} teams · fee ${t.registrationFee}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()} ·{' '}
                  {t.format}
                </p>
              </div>
              <Badge variant="success">{t.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Select
                label="Your team"
                value={teamByTournament[t._id] || teams[0]?._id || ''}
                onChange={(e) => setTeamByTournament((prev) => ({ ...prev, [t._id]: e.target.value }))}
              >
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <Button loading={busyId === t._id} onClick={() => register(t._id)}>
                Register & pay
              </Button>
              <Button as={Link} to={`/tournaments/${t._id}`} variant="outline">
                Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
