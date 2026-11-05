import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUser } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { FullPageSpinner } from '../components/common/Spinner';
import { teamApi } from '../api/teamApi';

export default function TeamDetails() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState({ name: '', phone: '', position: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await teamApi.get(teamId);
      setTeam(data.data.team);
    } catch {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamApi.addPlayer(teamId, player);
      toast.success('Player added');
      setOpen(false);
      setPlayer({ name: '', phone: '', position: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add player');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await teamApi.removePlayer(teamId, playerId);
      toast.success('Player removed');
      load();
    } catch {
      toast.error('Failed to remove player');
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!team) return null;

  return (
    <PageTransition>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">{team.name}</h1>
          <p className="mt-1 text-sm text-muted dark:text-dark-muted">
            {team.city || 'No city'} · {team.players?.length || 0} players
          </p>
        </div>
        <Button icon={<FiPlus />} onClick={() => setOpen(true)}>
          Add player
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-forest dark:text-dark-primary">{team.stats?.matchesPlayed || 0}</p>
          <p className="text-xs text-muted dark:text-dark-muted">Matches</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-forest dark:text-dark-primary">{team.stats?.wins || 0}</p>
          <p className="text-xs text-muted dark:text-dark-muted">Wins</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-forest dark:text-dark-primary">{team.stats?.draws || 0}</p>
          <p className="text-xs text-muted dark:text-dark-muted">Draws</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-forest dark:text-dark-primary">{team.stats?.points || 0}</p>
          <p className="text-xs text-muted dark:text-dark-muted">Points</p>
        </Card>
      </div>

      <h2 className="mt-8 font-display text-lg font-bold text-charcoal dark:text-dark-text">Players</h2>
      <div className="mt-4 space-y-2">
        {(team.players || []).length === 0 && (
          <p className="text-sm text-muted dark:text-dark-muted">No players added yet.</p>
        )}
        {(team.players || []).map((p) => (
          <Card key={p._id} className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <FiUser className="text-2xl text-forest/60 dark:text-dark-primary/60" />
              <div>
                <p className="text-sm font-semibold text-charcoal dark:text-dark-text">{p.name}</p>
                <p className="text-xs text-muted dark:text-dark-muted">{p.position || 'Player'} {p.phone && `· ${p.phone}`}</p>
              </div>
            </div>
            <button
              onClick={() => handleRemovePlayer(p._id)}
              className="rounded-lg p-2 text-status-cancelled-text hover:bg-status-cancelled-bg/60"
            >
              <FiTrash2 size={14} />
            </button>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a player">
        <form onSubmit={handleAddPlayer} className="space-y-4">
          <Input
            label="Name"
            required
            value={player.name}
            onChange={(e) => setPlayer({ ...player, name: e.target.value })}
          />
          <Input
            label="Phone"
            value={player.phone}
            onChange={(e) => setPlayer({ ...player, phone: e.target.value })}
          />
          <Input
            label="Position"
            value={player.position}
            onChange={(e) => setPlayer({ ...player, position: e.target.value })}
          />
          <Button type="submit" className="w-full" loading={saving}>
            Add player
          </Button>
        </form>
      </Modal>
    </PageTransition>
  );
}
