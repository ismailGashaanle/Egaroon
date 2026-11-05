import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAward, FiPlus } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { stadiumApi } from '../../api/stadiumApi';
import { tournamentApi } from '../../api/bookingApi';

export default function OwnerTournaments() {
  const [stadiums, setStadiums] = useState([]);
  const [fields, setFields] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    stadiumId: '',
    fieldIds: [],
    maxTeams: 8,
    registrationFee: 50,
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    format: 'GROUP_AND_KNOCKOUT',
    prizeWinner: '',
    publish: true,
  });

  const load = async () => {
    try {
      const [stRes, tRes] = await Promise.all([
        stadiumApi.list({ mine: 'true' }),
        tournamentApi.list({ mine: 'true' }),
      ]);
      setStadiums(stRes.data.data.stadiums || []);
      setTournaments(tRes.data.data.tournaments || []);
    } catch {
      toast.error('Failed to load tournaments');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!form.stadiumId) {
      setFields([]);
      return;
    }
    stadiumApi.listFields(form.stadiumId).then(({ data }) => {
      setFields(data.data.fields || []);
    });
  }, [form.stadiumId]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await tournamentApi.create({
        name: form.name,
        stadiumId: form.stadiumId,
        fieldIds: form.fieldIds.length ? form.fieldIds : fields.map((f) => f._id),
        maxTeams: Number(form.maxTeams),
        registrationFee: Number(form.registrationFee),
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
        format: form.format,
        prize: { winner: form.prizeWinner },
        publish: form.publish,
        blockSlots: true,
      });
      toast.success('Tournament created — slots blocked for cup window');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id) => {
    try {
      await tournamentApi.publish(id);
      toast.success('Published');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publish failed');
    }
  };

  const assignGroups = async (id) => {
    try {
      await tournamentApi.assignGroups(id, { groupSize: 4 });
      toast.success('Groups + fixtures generated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assign failed');
    }
  };

  const toggleField = (fieldId) => {
    setForm((prev) => ({
      ...prev,
      fieldIds: prev.fieldIds.includes(fieldId)
        ? prev.fieldIds.filter((id) => id !== fieldId)
        : [...prev.fieldIds, fieldId],
    }));
  };

  return (
    <PageTransition>
      <PageHeader
        title="Tournaments / Cups"
        description="Create Ramadan cups, university leagues, and block public booking slots."
        actions={
          <Button icon={<FiPlus />} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : 'New cup'}
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={create} className="mb-8 grid gap-4 rounded-2xl border border-border bg-white p-6 dark:border-dark-border dark:bg-dark-surface-2 sm:grid-cols-2">
          <Input label="Cup name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Stadium" required value={form.stadiumId} onChange={(e) => setForm({ ...form, stadiumId: e.target.value, fieldIds: [] })}>
            <option value="">Select stadium</option>
            {stadiums.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
          <Input label="Max teams" type="number" min={2} value={form.maxTeams} onChange={(e) => setForm({ ...form, maxTeams: e.target.value })} />
          <Input label="Registration fee ($)" type="number" min={0} value={form.registrationFee} onChange={(e) => setForm({ ...form, registrationFee: e.target.value })} />
          <Input label="Start date" type="datetime-local" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input label="End date" type="datetime-local" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <Input label="Registration deadline" type="datetime-local" required value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} />
          <Select label="Format" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
            <option value="GROUP_STAGE">Group stage</option>
            <option value="KNOCKOUT">Knockout</option>
            <option value="GROUP_AND_KNOCKOUT">Groups + knockout</option>
          </Select>
          <Input label="Winner prize" containerClassName="sm:col-span-2" value={form.prizeWinner} onChange={(e) => setForm({ ...form, prizeWinner: e.target.value })} />
          {fields.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Fields to block</p>
              <div className="flex flex-wrap gap-2">
                {fields.map((f) => (
                  <button
                    key={f._id}
                    type="button"
                    onClick={() => toggleField(f._id)}
                    className={`rounded-full border px-3 py-1 text-sm ${form.fieldIds.includes(f._id) ? 'border-brand-green bg-brand-green/10' : 'border-border'}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>Create tournament</Button>
          </div>
        </form>
      )}

      {tournaments.length === 0 && !showForm && (
        <EmptyState icon={<FiAward size={22} />} title="No cups yet" description="Create a cup to block slots and collect team fees." />
      )}

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface-2">
            <div>
              <p className="font-bold">{t.name}</p>
              <p className="text-sm text-muted">{t.stadium?.name} · {t.maxTeams} teams · ${t.registrationFee}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t.status}</Badge>
              {t.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => publish(t._id)}>Publish</Button>
              )}
              {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                <Button size="sm" onClick={() => assignGroups(t._id)}>Generate groups</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
