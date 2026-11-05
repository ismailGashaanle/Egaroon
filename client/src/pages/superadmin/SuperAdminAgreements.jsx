import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiFileText,
  FiPlus,
  FiSend,
  FiPauseCircle,
  FiCopy,
  FiEye,
  FiRefreshCw,
  FiFilter,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Spinner, { FullPageSpinner } from '../../components/common/Spinner';
import { adminApi } from '../../api/adminApi';
import { toastApiError } from '../../lib/support';

// ── Status badge helper ────────────────────────────────────────────────────────
const STATUS_VARIANT = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACTIVE: 'success',
  REJECTED: 'error',
  EXPIRED: 'neutral',
  SUSPENDED: 'warning',
  SUPERSEDED: 'neutral',
};

function StatusBadge({ status }) {
  return (
    <Badge variant={STATUS_VARIANT[status] || 'neutral'} dot>
      {status?.replace(/_/g, ' ')}
    </Badge>
  );
}

// ── Empty form state ──────────────────────────────────────────────────────────
const FORM_EMPTY = {
  stadiumId: '',
  model: 'booking_fee_subscription',
  bookingFeeEnabled: true,
  bookingFeeAmount: 1000,
  bookingFeeCurrency: 'SLL',
  bookingFeePayer: 'each_team',
  subscriptionEnabled: true,
  subscriptionAmount: 7,
  subscriptionCurrency: 'USD',
  subscriptionScope: 'stadium',
  commissionEnabled: false,
  commissionPercent: 4,
  notes: '',
  effectiveFrom: '',
  send: false,
};

// ── Detail modal ──────────────────────────────────────────────────────────────
function AgreementDetailModal({ agreement, onClose }) {
  if (!agreement) return null;
  const r = agreement.rules || {};
  return (
    <Modal open={!!agreement} onClose={onClose} title={`Agreement v${agreement.version}`} size="lg">
      <dl className="space-y-2 text-sm">
        <Row label="Stadium" value={agreement.stadiumName || agreement.stadium} />
        <Row label="Status">
          <StatusBadge status={agreement.status} />
        </Row>
        <Row label="Revenue model" value={r.model} />
        <Row
          label="Booking fee"
          value={
            r.bookingFeeEnabled
              ? `${r.bookingFeeAmount} ${r.bookingFeeCurrency} — payer: ${r.bookingFeePayer}`
              : 'off'
          }
        />
        <Row
          label="Subscription"
          value={
            r.subscriptionEnabled
              ? `$${r.subscriptionAmount} / ${r.subscriptionScope} / month`
              : 'off'
          }
        />
        <Row
          label="Commission"
          value={r.commissionEnabled ? `${r.commissionPercent}%` : 'off'}
        />
        <Row label="Notes" value={agreement.notes || '—'} />
        <Row
          label="Effective from"
          value={agreement.effectiveFrom ? new Date(agreement.effectiveFrom).toLocaleDateString() : '—'}
        />
        <Row
          label="Created"
          value={agreement.createdAt ? new Date(agreement.createdAt).toLocaleString() : '—'}
        />
        {agreement.acceptedAt && (
          <Row label="Accepted" value={new Date(agreement.acceptedAt).toLocaleString()} />
        )}
        {agreement.rejectedAt && (
          <>
            <Row label="Rejected" value={new Date(agreement.rejectedAt).toLocaleString()} />
            <Row label="Reject reason" value={agreement.rejectReason || '—'} />
          </>
        )}
      </dl>
    </Modal>
  );
}

function Row({ label, value, children }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-muted">{label}</dt>
      <dd className="font-medium text-charcoal dark:text-dark-text">{children || value}</dd>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAdminAgreements() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStadium, setFilterStadium] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailAgreement, setDetailAgreement] = useState(null);

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendNote, setSuspendNote] = useState('');
  const [suspending, setSuspending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterStadium) params.stadiumId = filterStadium;
      const { data } = await adminApi.listAgreements(params);
      setAgreements(data.data.agreements || []);
    } catch (err) {
      toastApiError(err, 'Failed to load agreements');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterStadium]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setBool = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.checked }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createAgreement({
        stadiumId: form.stadiumId,
        rules: {
          model: form.model,
          bookingFeeEnabled: Boolean(form.bookingFeeEnabled),
          bookingFeeAmount: Number(form.bookingFeeAmount),
          bookingFeeCurrency: form.bookingFeeCurrency,
          bookingFeePayer: form.bookingFeePayer,
          subscriptionEnabled: Boolean(form.subscriptionEnabled),
          subscriptionAmount: Number(form.subscriptionAmount),
          subscriptionCurrency: form.subscriptionCurrency,
          subscriptionScope: form.subscriptionScope,
          commissionEnabled: Boolean(form.commissionEnabled),
          commissionPercent: Number(form.commissionPercent),
        },
        notes: form.notes,
        effectiveFrom: form.effectiveFrom || undefined,
        send: Boolean(form.send),
      });
      toast.success(form.send ? 'Agreement created and sent to owner' : 'Agreement saved as draft');
      setShowCreate(false);
      setForm(FORM_EMPTY);
      load();
    } catch (err) {
      toastApiError(err, 'Failed to create agreement');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id) => {
    try {
      await adminApi.sendAgreement(id);
      toast.success('Agreement sent to owner');
      load();
    } catch (err) {
      toastApiError(err, 'Failed to send agreement');
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      await adminApi.suspendAgreement(suspendTarget.id, { note: suspendNote });
      toast.success('Agreement suspended');
      setSuspendTarget(null);
      setSuspendNote('');
      load();
    } catch (err) {
      toastApiError(err, 'Failed to suspend agreement');
    } finally {
      setSuspending(false);
    }
  };

  const handleNewVersion = async (agreement) => {
    try {
      await adminApi.createAgreementVersion(agreement.id, {
        rules: agreement.rules,
        notes: `New version of v${agreement.version}`,
        send: true,
      });
      toast.success('New version created and sent');
      load();
    } catch (err) {
      toastApiError(err, 'Failed to create new version');
    }
  };

  return (
    <PageTransition className="max-w-6xl">
      <PageHeader
        title="Stadium Agreements"
        description="Manage revenue agreements with stadium owners"
        action={
          <Button icon={<FiPlus />} onClick={() => setShowCreate(true)}>
            Create agreement
          </Button>
        }
      />

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          containerClassName="w-52"
        >
          <option value="">All statuses</option>
          {['DRAFT', 'PENDING_ACCEPTANCE', 'ACTIVE', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'SUPERSEDED'].map(
            (s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            )
          )}
        </Select>
        <Input
          placeholder="Filter by stadium ID…"
          value={filterStadium}
          onChange={(e) => setFilterStadium(e.target.value)}
          className="w-56"
          containerClassName="w-56"
        />
        <Button variant="ghost" icon={<FiRefreshCw />} onClick={load} size="sm">
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card className="mt-4 overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : agreements.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">No agreements found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-charcoal/3 dark:border-dark-border dark:bg-white/3">
                <tr>
                  {['Stadium', 'Version', 'Status', 'Model', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-dark-border">
                {agreements.map((ag) => (
                  <tr
                    key={ag.id}
                    className="hover:bg-charcoal/2 dark:hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-charcoal dark:text-dark-text">
                      {ag.stadiumName || ag.stadium}
                      {ag.stadiumCity && (
                        <span className="ml-1 text-xs text-muted">({ag.stadiumCity})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">v{ag.version}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ag.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {ag.rules?.model?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {ag.createdAt ? new Date(ag.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          title="View"
                          onClick={() => setDetailAgreement(ag)}
                          className="rounded p-1 text-muted hover:text-charcoal dark:hover:text-dark-text"
                        >
                          <FiEye size={14} />
                        </button>
                        {['DRAFT', 'REJECTED'].includes(ag.status) && (
                          <button
                            title="Send to owner"
                            onClick={() => handleSend(ag.id)}
                            className="rounded p-1 text-muted hover:text-forest dark:hover:text-dark-primary"
                          >
                            <FiSend size={14} />
                          </button>
                        )}
                        {ag.status === 'ACTIVE' && (
                          <button
                            title="Suspend"
                            onClick={() => setSuspendTarget(ag)}
                            className="rounded p-1 text-muted hover:text-status-cancelled-text"
                          >
                            <FiPauseCircle size={14} />
                          </button>
                        )}
                        {['ACTIVE', 'SUSPENDED'].includes(ag.status) && (
                          <button
                            title="Create new version"
                            onClick={() => handleNewVersion(ag)}
                            className="rounded p-1 text-muted hover:text-forest dark:hover:text-dark-primary"
                          >
                            <FiCopy size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create Agreement Modal ───────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Stadium Agreement"
        size="2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={saving}
              disabled={!form.stadiumId}
            >
              {form.send ? 'Save & Send to owner' : 'Save as draft'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Stadium ID"
            value={form.stadiumId}
            onChange={set('stadiumId')}
            placeholder="Paste stadium ObjectId…"
            required
          />

          <Select label="Revenue Model" value={form.model} onChange={set('model')}>
            <option value="booking_fee_subscription">Booking Fee / Subscription</option>
            <option value="commission">Commission</option>
            <option value="combined">Combined (fee + commission)</option>
          </Select>

          {/* Booking fee */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase text-muted">Booking Fee</p>
            <label className="flex items-center gap-2 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                checked={Boolean(form.bookingFeeEnabled)}
                onChange={setBool('bookingFeeEnabled')}
              />
              Enable booking fee
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Amount"
                type="number"
                min={0}
                step="any"
                value={form.bookingFeeAmount}
                onChange={set('bookingFeeAmount')}
                disabled={!form.bookingFeeEnabled}
              />
              <Select
                label="Currency"
                value={form.bookingFeeCurrency}
                onChange={set('bookingFeeCurrency')}
                disabled={!form.bookingFeeEnabled}
              >
                <option value="SLL">SLL</option>
                <option value="USD">USD</option>
              </Select>
              <Select
                label="Payer"
                value={form.bookingFeePayer}
                onChange={set('bookingFeePayer')}
                disabled={!form.bookingFeeEnabled}
              >
                <option value="each_team">Each team</option>
                <option value="team_a_only">Team A only</option>
                <option value="split">Split</option>
              </Select>
            </div>
          </div>

          {/* Subscription */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase text-muted">Subscription</p>
            <label className="flex items-center gap-2 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                checked={Boolean(form.subscriptionEnabled)}
                onChange={setBool('subscriptionEnabled')}
              />
              Enable subscription
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Amount"
                type="number"
                min={0}
                step="any"
                value={form.subscriptionAmount}
                onChange={set('subscriptionAmount')}
                disabled={!form.subscriptionEnabled}
              />
              <Select
                label="Currency"
                value={form.subscriptionCurrency}
                onChange={set('subscriptionCurrency')}
                disabled={!form.subscriptionEnabled}
              >
                <option value="USD">USD</option>
                <option value="SLL">SLL</option>
              </Select>
              <Select
                label="Scope"
                value={form.subscriptionScope}
                onChange={set('subscriptionScope')}
                disabled={!form.subscriptionEnabled}
              >
                <option value="stadium">Per stadium</option>
                <option value="field">Per field</option>
              </Select>
            </div>
          </div>

          {/* Commission */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase text-muted">Commission</p>
            <label className="flex items-center gap-2 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                checked={Boolean(form.commissionEnabled)}
                onChange={setBool('commissionEnabled')}
              />
              Enable commission
            </label>
            <Input
              label="Commission %"
              type="number"
              min={0}
              max={50}
              step="any"
              value={form.commissionPercent}
              onChange={set('commissionPercent')}
              disabled={!form.commissionEnabled}
            />
          </div>

          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={set('notes')}
            placeholder="Internal notes…"
          />
          <Input
            label="Effective from (optional)"
            type="date"
            value={form.effectiveFrom}
            onChange={set('effectiveFrom')}
          />

          <label className="flex items-center gap-2 text-sm text-charcoal dark:text-dark-text">
            <input type="checkbox" checked={Boolean(form.send)} onChange={setBool('send')} />
            Send to owner immediately (skips draft status)
          </label>
        </form>
      </Modal>

      {/* ── Suspend Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Agreement"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button loading={suspending} onClick={handleSuspend}>
              Suspend
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Suspend agreement v{suspendTarget?.version} for{' '}
          <strong>{suspendTarget?.stadiumName}</strong>?
        </p>
        <Input
          label="Reason / note (optional)"
          value={suspendNote}
          onChange={(e) => setSuspendNote(e.target.value)}
          placeholder="Reason for suspension…"
        />
      </Modal>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      <AgreementDetailModal
        agreement={detailAgreement}
        onClose={() => setDetailAgreement(null)}
      />
    </PageTransition>
  );
}
