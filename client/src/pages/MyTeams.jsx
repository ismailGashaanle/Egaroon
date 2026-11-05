import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiUsers, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageTransition from '../components/common/PageTransition';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { fetchMyTeams, createTeam } from '../features/teams/teamSlice';

export default function MyTeams() {
  const dispatch = useDispatch();
  const { items: teams, status } = useSelector((state) => state.teams);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', region: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    dispatch(fetchMyTeams());
  }, [dispatch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const result = await dispatch(createTeam(form));
    setCreating(false);
    if (createTeam.fulfilled.match(result)) {
      toast.success('Team created!');
      setOpen(false);
      setForm({ name: '', city: '', region: '' });
    } else {
      toast.error(result.payload || 'Failed to create team');
    }
  };

  return (
    <PageTransition>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">My teams</h1>
          <p className="mt-1 text-sm text-muted dark:text-dark-muted">Manage your squads and players.</p>
        </div>
        <Button icon={<FiPlus />} onClick={() => setOpen(true)}>
          New team
        </Button>
      </div>

      {status !== 'loading' && teams.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={<FiUsers size={22} />}
            title="No teams yet"
            description="Create your first team to start booking fields."
            action={<Button onClick={() => setOpen(true)}>Create a team</Button>}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Link key={team._id} to={`/app/teams/${team._id}`}>
            <Card hover className="p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/10 dark:text-dark-primary">
                <FiUsers />
              </div>
              <h3 className="mt-3 font-display font-bold text-charcoal dark:text-dark-text">{team.name}</h3>
              <p className="mt-1 text-sm text-muted dark:text-dark-muted">
                {team.city || 'No city set'} · {team.players?.length || 0} players
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a new team">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Team name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input
            label="Region"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <Button type="submit" className="w-full" loading={creating}>
            Create team
          </Button>
        </form>
      </Modal>
    </PageTransition>
  );
}
