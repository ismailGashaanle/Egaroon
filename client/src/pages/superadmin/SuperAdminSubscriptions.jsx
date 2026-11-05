import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiRefreshCw,
  FiFilter,
  FiHome,
  FiCheck,
  FiXCircle,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Spinner, { FullPageSpinner } from '../../components/common/Spinner';
import { subscriptionApi } from '../../api/subscriptionApi';
import { toastApiError } from '../../lib/support';

export default function SuperAdminSubscriptions() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedSub, setSelectedSub] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionModal, setActionModal] = useState(null); // 'approve' | 'mark'
  const [actionNotes, setActionNotes] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subscriptionApi.listSuperAdmin({ ensure: 'true' });
      setSubscriptions(res.data?.data?.subscriptions || []);
    } catch (err) {
      toastApiError(err, 'Failed to load stadium subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (sub) => {
    try {
      setActionBusy(true);
      const res = await subscriptionApi.approveSuperAdmin(sub.id, { notes: actionNotes });
      toast.success(res.data?.data?.messageSo || 'Subscription approved & stadium unlocked!');
      setActionModal(null);
      setSelectedSub(null);
      setActionNotes('');
      await load();
    } catch (err) {
      toastApiError(err, 'Failed to approve subscription');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkPaid = async (sub, status = 'paid') => {
    try {
      setActionBusy(true);
      await subscriptionApi.markSuperAdmin(sub.id, {
        status,
        amountPaid: status === 'paid' ? sub.amountDue : 0,
        notes: actionNotes || (status === 'paid' ? 'Marked paid by Super Admin' : 'Waived by Super Admin'),
      });
      toast.success(status === 'paid' ? 'Marked as Paid!' : 'Subscription waived!');
      setActionModal(null);
      setSelectedSub(null);
      setActionNotes('');
      await load();
    } catch (err) {
      toastApiError(err, 'Failed to update subscription');
    } finally {
      setActionBusy(false);
    }
  };

  // KPIs
  const totalDue = subscriptions.reduce((s, r) => s + (r.amountDue || 0), 0);
  const totalPaid = subscriptions.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const totalOwed = subscriptions.reduce((s, r) => s + (r.status === 'owed' ? (r.amountDue - r.amountPaid) : 0), 0);
  const pendingApprovals = subscriptions.filter((r) => r.approvalStatus === 'pending_approval');

  const filtered = subscriptions.filter((s) => {
    if (filterStatus === 'PENDING') return s.approvalStatus === 'pending_approval';
    if (filterStatus === 'OWED') return s.status === 'owed' || s.status === 'partial';
    if (filterStatus === 'PAID') return s.status === 'paid';
    if (filterStatus === 'WAIVED') return s.status === 'waived';
    return true;
  });

  return (
    <PageTransition>
      <PageHeader
        title="Stadium Subscriptions ($7 / Field)"
        description="Maamul subscription-ka bishii ee garoomada ($7 halkii garoon/field). Garoomada 3 fields leh waa $21 bishii."
        actions={
          <Button variant="secondary" icon={<FiRefreshCw className={loading ? 'animate-spin' : ''} />} onClick={load}>
            Cusboonaysii
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FiDollarSign className="text-xl" />
            </span>
            <div>
              <p className="text-xs text-muted">Wadarta Bisha</p>
              <p className="text-xl font-bold">${totalDue.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FiCheckCircle className="text-xl" />
            </span>
            <div>
              <p className="text-xs text-muted">La Bixiyay</p>
              <p className="text-xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <FiClock className="text-xl" />
            </span>
            <div>
              <p className="text-xs text-muted">Lagu Leeyahay (Owed)</p>
              <p className="text-xl font-bold text-rose-600">${totalOwed.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <FiAlertTriangle className="text-xl" />
            </span>
            <div>
              <p className="text-xs text-muted">Sugaya Xaqiijin</p>
              <p className="text-xl font-bold text-amber-600">{pendingApprovals.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending Approval Alert Banner */}
      {pendingApprovals.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <FiAlertTriangle className="text-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                {pendingApprovals.length} Garoon Ayaa Soo Gudbiyey Caddeyn Lacag-Bixin ah
              </h3>
              <p className="mt-1 text-sm">
                Fadlan xaqiiji tixraaca lacag-bixinta ee Zaad / eDahab / Waafi si garoomada si toos ah loogu furo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted flex items-center gap-1.5 mr-2">
          <FiFilter /> Filter:
        </span>
        {[
          { id: 'ALL', label: `Dhammaan (${subscriptions.length})` },
          { id: 'PENDING', label: `Sugaya Xaqiijin (${pendingApprovals.length})` },
          { id: 'OWED', label: 'Lagu Leeyahay' },
          { id: 'PAID', label: 'La Bixiyay' },
          { id: 'WAIVED', label: 'La Cafiyey' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface text-charcoal/70 hover:bg-surface-accent dark:text-dark-text/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subscriptions Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <FullPageSpinner />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted">Wax subscription ah lama helin qaybtaan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-accent text-xs uppercase tracking-wider text-muted dark:border-dark-border">
                <tr>
                  <th className="px-4 py-3">Garoonka</th>
                  <th className="px-4 py-3">Bisha</th>
                  <th className="px-4 py-3">Fields Count</th>
                  <th className="px-4 py-3">Qiimaha ($7/field)</th>
                  <th className="px-4 py-3">Xaaladda</th>
                  <th className="px-4 py-3">Habka Bixinta</th>
                  <th className="px-4 py-3 text-right">Ficil (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-dark-border">
                {filtered.map((s) => {
                  const isPending = s.approvalStatus === 'pending_approval';
                  const isPaid = s.status === 'paid';
                  const isWaived = s.status === 'waived';

                  return (
                    <tr key={s.id} className="hover:bg-surface-accent/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-charcoal dark:text-dark-text">{s.stadiumName}</div>
                        {s.paymentReference && (
                          <div className="text-[11px] text-muted">Ref: {s.paymentReference}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.year}-{String(s.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-accent px-2 py-0.5 text-xs font-semibold">
                          <FiHome className="text-muted" />
                          {s.fieldsCount || 1} {s.fieldsCount === 1 ? 'Field' : 'Fields'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        ${s.amountDue?.toFixed(2)} {s.currency || 'USD'}
                        <div className="text-[11px] text-muted font-normal">
                          {s.fieldsCount || 1} × ${s.ratePerField || 7}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <Badge variant="warning" dot>
                            Sugaya Xaqiijin
                          </Badge>
                        ) : isPaid ? (
                          <Badge variant="success" dot>
                            La Bixiyay
                          </Badge>
                        ) : isWaived ? (
                          <Badge variant="neutral" dot>
                            La Cafiyey
                          </Badge>
                        ) : (
                          <Badge variant="error" dot>
                            Lagu Leeyahay
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {s.payMethod === 'auto_deduct'
                          ? 'Dakhliga laga jaray (Auto-Deduct)'
                          : s.payMethod === 'mobile_money'
                          ? 'Mobile Money (USSD Push)'
                          : s.payMethod === 'manual'
                          ? 'Gacanta / Zaad / eDahab'
                          : isWaived
                          ? 'Free / Waived'
                          : 'Lama bixin'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<FiCheck />}
                              onClick={() => {
                                setSelectedSub(s);
                                setActionModal('approve');
                              }}
                            >
                              Xaqiiji & Fur
                            </Button>
                          )}
                          {!isPaid && !isWaived && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedSub(s);
                                setActionModal('mark');
                              }}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Approve Modal */}
      {actionModal === 'approve' && selectedSub && (
        <Modal
          isOpen={true}
          onClose={() => setActionModal(null)}
          title={`Xaqiiji Subscription-ka: ${selectedSub.stadiumName}`}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-accent p-3 text-sm">
              <p>
                <strong>Garoonka:</strong> {selectedSub.stadiumName}
              </p>
              <p>
                <strong>Tirada Fields-ka:</strong> {selectedSub.fieldsCount} ({selectedSub.fieldsCount} × ${selectedSub.ratePerField || 7} = ${selectedSub.amountDue})
              </p>
              <p>
                <strong>Tixraaca Bixinta (Ref):</strong> {selectedSub.paymentReference || 'Lama gelin'}
              </p>
              {selectedSub.approvalNotes && (
                <p className="mt-1 text-xs text-muted">
                  <strong>Xusuusin:</strong> {selectedSub.approvalNotes}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Xusuusin Super Admin (Optional)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
                placeholder="Tusaale: Zaad confirmed..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setActionModal(null)}>
                Jooji
              </Button>
              <Button
                variant="primary"
                icon={<FiCheck />}
                loading={actionBusy}
                onClick={() => handleApprove(selectedSub)}
              >
                Xaqiiji & Fur Garoonka
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mark Paid / Waive Modal */}
      {actionModal === 'mark' && selectedSub && (
        <Modal
          isOpen={true}
          onClose={() => setActionModal(null)}
          title={`Bixi ama Cafi: ${selectedSub.stadiumName}`}
        >
          <div className="space-y-4">
            <p className="text-sm">
              Ma hubtaa inaad lacag-bixintan (${selectedSub.amountDue}) u calaamadayso <strong>La Bixiyay</strong> ama <strong>La Cafiyey</strong>?
            </p>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Xusuusin (Notes)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
                placeholder="Sababta..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setActionModal(null)}>
                Jooji
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleMarkPaid(selectedSub, 'waived')}
                loading={actionBusy}
              >
                Cafi (Waive)
              </Button>
              <Button
                variant="primary"
                icon={<FiCheck />}
                onClick={() => handleMarkPaid(selectedSub, 'paid')}
                loading={actionBusy}
              >
                U Calaamadee Paid
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
}
