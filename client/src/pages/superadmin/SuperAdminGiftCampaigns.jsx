import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiGift, FiPlus, FiSlash } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/common/Table';
import { adminApi } from '../../api/adminApi';
import { toastApiError } from '../../lib/support';

function defaultEndsAt() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function SuperAdminGiftCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: 'Hargeisa',
    region: '',
    endsAt: defaultEndsAt(),
    maxWinners: 10,
    winRatePercent: 15,
    notes: '',
  });

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await adminApi.getSettings();
      setGiftEnabled(Boolean(data.data.settings?.giftEnabled));
    } catch {
      /* non-fatal */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listGiftCampaigns();
      setCampaigns(data.data.campaigns || []);
    } catch (err) {
      toastApiError(err, 'Failed to load gift campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadSettings();
  }, [load, loadSettings]);

  const toggleGiftMaster = async () => {
    const next = !giftEnabled;
    setToggling(true);
    try {
      const { data } = await adminApi.updateSettings({ giftEnabled: next });
      setGiftEnabled(Boolean(data.data.settings?.giftEnabled));
      toast.success(
        next
          ? 'Free-match gifts ON — captains can enter draws'
          : 'Free-match gifts OFF — captain Gift UI hidden'
      );
    } catch (err) {
      toastApiError(err, 'Could not update giftEnabled');
    } finally {
      setToggling(false);
    }
  };

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createGiftCampaign({
        name: form.name.trim(),
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
        maxWinners: Number(form.maxWinners) || 1,
        winRatePercent: Number(form.winRatePercent) || 0,
        notes: form.notes.trim() || undefined,
        status: 'active',
      });
      toast.success('Campaign created');
      setOpen(false);
      setForm((f) => ({ ...f, name: '', notes: '' }));
      load();
    } catch (err) {
      toastApiError(err, 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const end = async (id) => {
    try {
      await adminApi.endGiftCampaign(id);
      toast.success('Campaign ended');
      load();
    } catch (err) {
      toastApiError(err, 'End failed');
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Free match gifts"
        description="Master switch + city/region campaigns. Captains enter once with a suspense reveal (win/lose)."
        breadcrumbs={[
          { label: 'Super Admin', to: '/super-admin' },
          { label: 'Gift campaigns' },
        ]}
        actions={
          <Button icon={<FiPlus />} onClick={() => setOpen(true)}>
            New campaign
          </Button>
        }
      />

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FiGift className="text-brand-green" />
              <CardTitle>giftEnabled · master switch</CardTitle>
            </div>
            <p className="mt-1 text-sm text-muted">
              Default <strong>OFF</strong>. When off, captain Gift UI is hidden, enter returns 403,
              and active campaign list is empty. You can still create/end campaigns here.
            </p>
            <p className="mt-1 text-xs text-muted">
              Also editable under Platform Settings → Match features.
            </p>
          </div>
          <Button
            variant={giftEnabled ? 'secondary' : 'primary'}
            loading={toggling}
            onClick={toggleGiftMaster}
          >
            {giftEnabled ? 'Turn OFF' : 'Turn ON'}
          </Button>
        </div>
        <p
          className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
            giftEnabled
              ? 'bg-brand-green/15 text-brand-green'
              : 'bg-charcoal/10 text-muted'
          }`}
        >
          Status: {giftEnabled ? 'ON — captains can draw' : 'OFF — feature hidden'}
        </p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-charcoal/10 px-5 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <FiGift className="text-brand-green" />
            <CardTitle>Campaigns</CardTitle>
          </div>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-muted">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Winners</TableHead>
              <TableHead>Win %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted">No campaigns yet</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id || c._id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {[c.city, c.region].filter(Boolean).join(' · ') || 'Platform-wide'}
                    </TableCell>
                    <TableCell className="text-sm text-muted">
                      {new Date(c.startsAt).toLocaleDateString()} –{' '}
                      {new Date(c.endsAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {c.winnersCount}/{c.maxWinners}
                    </TableCell>
                    <TableCell>{c.winRatePercent}%</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          c.status === 'active'
                            ? 'bg-brand-green/15 text-brand-green'
                            : 'bg-charcoal/10 text-muted'
                        }`}
                      >
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === 'active' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<FiSlash />}
                          onClick={() => end(c.id || c._id)}
                        >
                          End
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New free-match campaign"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={create}>
              Create & activate
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Hargeisa Free Match Week"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="City (blank = any)"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Hargeisa"
            />
            <Input
              label="Region (blank = any)"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            />
          </div>
          <Input
            label="Ends on"
            type="date"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Max winners"
              type="number"
              min={1}
              value={form.maxWinners}
              onChange={(e) => setForm((f) => ({ ...f, maxWinners: e.target.value }))}
            />
            <Input
              label="Win rate %"
              type="number"
              min={0}
              max={100}
              value={form.winRatePercent}
              onChange={(e) => setForm((f) => ({ ...f, winRatePercent: e.target.value }))}
            />
          </div>
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <p className="text-xs text-muted">
            Captains see a ~3s suspense reveal · 1 entry per captain · voucher = 100% off one booking
            {!giftEnabled && (
              <span className="mt-1 block font-medium text-status-cancelled-text">
                Note: giftEnabled is OFF — turn the master switch on so captains can enter.
              </span>
            )}
          </p>
        </div>
      </Modal>
    </PageTransition>
  );
}
