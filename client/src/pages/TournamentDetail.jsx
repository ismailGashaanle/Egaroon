import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageTransition from '../components/common/PageTransition';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { tournamentApi } from '../api/bookingApi';

export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await tournamentApi.get(tournamentId);
        setData(res.data.data);
      } catch {
        toast.error('Tournament not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [tournamentId]);

  if (loading) return <div className="p-12 text-center text-muted">Loading…</div>;
  if (!data) {
    return (
      <PageTransition className="mx-auto max-w-3xl px-4 py-12">
        <p>Tournament not found.</p>
        <Button as={Link} to="/tournaments" className="mt-4">
          Back
        </Button>
      </PageTransition>
    );
  }

  const { tournament, teams, fixtures, standings } = data;

  return (
    <PageTransition className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
      <div>
        <Badge>{tournament.status}</Badge>
        <h1 className="mt-2 font-display text-3xl font-bold">{tournament.name}</h1>
        <p className="text-muted">
          {tournament.stadium?.name} · {tournament.format} · fee ${tournament.registrationFee}
        </p>
        {tournament.prize?.winner && (
          <p className="mt-2 text-sm">Winner prize: {tournament.prize.winner}</p>
        )}
        <Button as={Link} to="/app/tournaments" className="mt-4" size="sm">
          Register as captain
        </Button>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold">Teams ({teams.length}/{tournament.maxTeams})</h2>
        <ul className="mt-3 space-y-2">
          {teams.map((t) => (
            <li key={t._id} className="rounded-xl border border-border px-4 py-2 dark:border-dark-border">
              {t.team?.name || 'Team'} · Group {t.group || '—'} · {t.status} · {t.paymentStatus}
            </li>
          ))}
          {teams.length === 0 && <p className="text-sm text-muted">No teams registered yet.</p>}
        </ul>
      </section>

      {standings?.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold">Standings</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Grp</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GD</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={`${row.group}-${row.teamId}`} className="border-b border-border/50">
                    <td className="py-2">{row.group}</td>
                    <td>{row.teamName}</td>
                    <td>{row.P}</td>
                    <td>{row.W}</td>
                    <td>{row.D}</td>
                    <td>{row.L}</td>
                    <td>{row.GD}</td>
                    <td className="font-bold">{row.PTS}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-bold">Fixtures</h2>
        <ul className="mt-3 space-y-2">
          {fixtures.map((f) => (
            <li key={f._id} className="rounded-xl border border-border px-4 py-2 dark:border-dark-border">
              {f.homeTeam?.name || 'TBD'} vs {f.awayTeam?.name || 'TBD'}
              {f.status === 'FINISHED' && (
                <span className="ml-2 font-bold">
                  {f.homeScore}–{f.awayScore}
                </span>
              )}
              <span className="ml-2 text-xs text-muted">{f.round} · {f.status}</span>
            </li>
          ))}
          {fixtures.length === 0 && <p className="text-sm text-muted">Fixtures not generated yet.</p>}
        </ul>
      </section>
    </PageTransition>
  );
}
