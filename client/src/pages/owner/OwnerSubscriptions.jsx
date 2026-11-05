import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiDollarSign,
  FiCheckCircle,
  FiLock,
  FiAlertTriangle,
  FiClock,
  FiSend,
  FiCheck,
  FiHome,
  FiRefreshCw,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import { subscriptionApi } from '../../api/subscriptionApi';
import { useAuth } from '../../hooks/useAuth';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { toastApiError } from '../../lib/support';

const OPERATORS = [
  { id: 'telesom', label: 'Telesom (Zaad)', sub: '063' },
  { id: 'somtel', label: 'Somtel (eDahab)', sub: '065' },
  { id: 'hormuud', label: 'Hormuud (Waafi)', sub: '061' },
  { id: 'golis', label: 'Golis (Sahal)', sub: '090' },
];

export default function OwnerSubscriptions() {
  const { user } = useAuth();
  const { sllPerUsd } = useAuthFeatures();
  const rate = Number(sllPerUsd || 8500);

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  // Payment form state
  const [payCurrency, setPayCurrency] = useState('USD');
  const [operator, setOperator] = useState('telesom');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Proof form state
  const [proofRef, setProofRef] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofBusy, setProofBusy] = useState(false);

  // Auto-deduct setting
  const [autoDeductBusy, setAutoDeductBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subscriptionApi.listOwner();
      const list = res.data?.data?.subscriptions || [];
      setSubscriptions(list);
      if (list.length > 0 && !selectedSub) {
        // pick first unpaid or first sub
        const unpaid = list.find((s) => s.status === 'owed' || s.approvalStatus === 'pending_approval');
        setSelectedSub(unpaid || list[0]);
      }
    } catch (err) {
      toastApiError(err, 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [selectedSub]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePayMobile = async (e) => {
    e?.preventDefault();
    if (!selectedSub) return;
    if (!phone) {
      toast.error('Fadlan geli lambarka moobilkaaga');
      return;
    }
    try {
      setPaymentBusy(true);
      const res = await subscriptionApi.payOwner(selectedSub.id, {
        operator,
        phone,
        payCurrency,
      });
      toast.success(res.data?.data?.messageSo || 'Subscription-ka waa la bixiyey!');
      await load();
    } catch (err) {
      toastApiError(err, 'Lacag-bixintu way fashilantay');
    } finally {
      setPaymentBusy(false);
    }
  };

  const handlePayAutoDeduct = async () => {
    if (!selectedSub) return;
    try {
      setPaymentBusy(true);
      const res = await subscriptionApi.payOwner(selectedSub.id, {
        method: 'auto_deduct',
      });
      toast.success(res.data?.data?.messageSo || 'Dakhliga garoonka ayaa laga jaray!');
      await load();
    } catch (err) {
      toastApiError(err, 'Dakhliga kuma filna lacagta subscription-ka');
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleSubmitProof = async (e) => {
    e?.preventDefault();
    if (!selectedSub) return;
    if (!proofRef) {
      toast.error('Fadlan geli tixraaca lacag-bixinta (Transaction ID / Reference)');
      return;
    }
    try {
      setProofBusy(true);
      const res = await subscriptionApi.submitProof(selectedSub.id, {
        paymentReference: proofRef,
        notes: proofNotes,
      });
      toast.success(res.data?.data?.messageSo || 'Caddeyntaada waa la gudbiyey');
      setProofRef('');
      setProofNotes('');
      await load();
    } catch (err) {
      toastApiError(err, 'Gudbintu way fashilantay');
    } finally {
      setProofBusy(false);
    }
  };

  const dueUsd = selectedSub ? Number(selectedSub.amountDue || 0) - Number(selectedSub.amountPaid || 0) : 0;
  const dueSll = Math.round(dueUsd * rate);

  return (
    <PageTransition>
      <PageHeader
        title="Stadium Subscription ($7 / Field)"
        description="Bixi subscription-ka bishii ($7 halkii field). Haddii garoonkaagu leeyahay 3 fields, wadartu waa $21."
        actions={
          <Button variant="secondary" icon={<FiRefreshCw className={loading ? 'animate-spin' : ''} />} onClick={load}>
            Cusboonaysii
          </Button>
        }
      />

      {/* Lockout / Status Notice */}
      {selectedSub && (selectedSub.status === 'owed' || selectedSub.approvalStatus === 'pending_approval') && (
        <div
          className={`mb-6 rounded-2xl border p-4 shadow-sm ${
            selectedSub.approvalStatus === 'pending_approval'
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
              : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                selectedSub.approvalStatus === 'pending_approval'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
              }`}
            >
              {selectedSub.approvalStatus === 'pending_approval' ? (
                <FiClock className="text-xl" />
              ) : (
                <FiLock className="text-xl" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                {selectedSub.approvalStatus === 'pending_approval'
                  ? 'Caddeyntaadii Waxay Sugaysaa Xaqiijinta Super Admin-ka'
                  : `Subscription-ka Bishan Lama Bixin: $${dueUsd} USD (${dueSll.toLocaleString()} SlSh)`}
              </h3>
              <p className="mt-1 text-sm leading-relaxed">
                {selectedSub.approvalStatus === 'pending_approval'
                  ? `Waxaad soo gudbisay tixraaca: ${selectedSub.paymentReference}. Super Admin-ka ayaa xaqiijinaya si garoonkaagu si toos ah ugu furmo.`
                  : `Garoonka ${selectedSub.stadiumName} wuxuu leeyahay ${selectedSub.fieldsCount || 1} fields (${selectedSub.fieldsCount || 1} × $${selectedSub.ratePerField || 7} = $${dueUsd}). Bixi hadda si uu furan ahaado.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Subscriptions List */}
        <div className="space-y-4 lg:col-span-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Biilasha Garoomadaada</h3>
          {loading ? (
            <div className="p-8 text-center text-muted">Waa la soo gelinayaa...</div>
          ) : subscriptions.length === 0 ? (
            <Card className="p-6 text-center text-muted">Wax biilal ah lama helin.</Card>
          ) : (
            subscriptions.map((s) => {
              const active = selectedSub?.id === s.id;
              const isPaid = s.status === 'paid';
              const isPending = s.approvalStatus === 'pending_approval';

              return (
                <Card
                  key={s.id}
                  onClick={() => setSelectedSub(s)}
                  className={`cursor-pointer transition-all ${
                    active ? 'ring-2 ring-primary border-primary' : 'hover:border-border-accent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-charcoal dark:text-dark-text">{s.stadiumName}</h4>
                      <p className="text-xs text-muted font-mono mt-0.5">
                        Bisha: {s.year}-{String(s.month).padStart(2, '0')}
                      </p>
                    </div>
                    {isPending ? (
                      <Badge variant="warning">Sugaya Xaqiijin</Badge>
                    ) : isPaid ? (
                      <Badge variant="success">La Bixiyay</Badge>
                    ) : (
                      <Badge variant="error">Lagu Leeyahay</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs dark:border-dark-border">
                    <span className="flex items-center gap-1 text-muted">
                      <FiHome /> {s.fieldsCount || 1} {s.fieldsCount === 1 ? 'field' : 'fields'}
                    </span>
                    <span className="font-bold text-sm">
                      ${s.amountDue?.toFixed(2)} USD
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Right Column: Payment & Settlement Controls */}
        <div className="space-y-6 lg:col-span-2">
          {selectedSub && (
            <>
              {/* Calculation Breakdown Card */}
              <Card className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">
                  Xisaabinta Subscription-ka: {selectedSub.stadiumName}
                </h3>
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-accent p-3.5 text-center">
                  <div>
                    <span className="text-xs text-muted block">Tirada Fields-ka</span>
                    <span className="text-lg font-bold text-charcoal dark:text-dark-text">
                      {selectedSub.fieldsCount || 1}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Qiimaha / Field</span>
                    <span className="text-lg font-bold text-charcoal dark:text-dark-text">
                      ${selectedSub.ratePerField || 7}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Wadarta Bisha</span>
                    <span className="text-lg font-bold text-primary">
                      ${selectedSub.amountDue?.toFixed(2)} USD
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted text-center">
                  U dhiganta Somaliland Shilling: <strong>{(Number(selectedSub.amountDue || 0) * rate).toLocaleString()} SlSh</strong> (Sarifka: {rate.toLocaleString()} SlSh = $1 USD)
                </div>
              </Card>

              {/* Payment Methods */}
              {selectedSub.status !== 'paid' && (
                <div className="space-y-6">
                  {/* Option 1: Mobile Money Pay */}
                  <Card className="p-5">
                    <h3 className="text-base font-bold text-charcoal dark:text-dark-text flex items-center gap-2 mb-1">
                      <FiDollarSign className="text-primary" /> Habka 1: Ku Bixi Mobile Money (Toos)
                    </h3>
                    <p className="text-xs text-muted mb-4">
                      Ka bixi Zaad, eDahab, ama Waafi adigoo isticmaalaya USD ama Somaliland Shilling. USSD push ayaa ku soo gaaraya.
                    </p>

                    <form onSubmit={handlePayMobile} className="space-y-4">
                      {/* Currency choice */}
                      <div>
                        <label className="block text-xs font-semibold text-muted mb-1.5">Nooca Lacagta</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPayCurrency('USD')}
                            className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition-all ${
                              payCurrency === 'USD'
                                ? 'border-primary bg-primary/10 text-primary font-bold'
                                : 'border-border dark:border-dark-border text-muted'
                            }`}
                          >
                            💵 USD (${dueUsd.toFixed(2)})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayCurrency('SLL')}
                            className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition-all ${
                              payCurrency === 'SLL'
                                ? 'border-primary bg-primary/10 text-primary font-bold'
                                : 'border-border dark:border-dark-border text-muted'
                            }`}
                          >
                            SlSh ({dueSll.toLocaleString()} SlSh)
                          </button>
                        </div>
                      </div>

                      {/* Operator */}
                      <div>
                        <label className="block text-xs font-semibold text-muted mb-1.5">Operator-ka Mobile Money</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {OPERATORS.map((op) => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setOperator(op.id)}
                              className={`rounded-xl border p-2 text-center text-xs transition-all ${
                                operator === op.id
                                  ? 'border-primary bg-primary/10 text-primary font-bold'
                                  : 'border-border dark:border-dark-border text-muted'
                              }`}
                            >
                              <div>{op.label}</div>
                              <span className="text-[10px] opacity-75">{op.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-semibold text-muted mb-1">Lambarka Lacag-bixiyaha</label>
                        <Input
                          placeholder="063xxxxxxx ama 061xxxxxxx"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        icon={<FiCheck />}
                        className="w-full"
                        loading={paymentBusy}
                      >
                        Bixi Hadda ({payCurrency === 'USD' ? `$${dueUsd} USD` : `${dueSll.toLocaleString()} SlSh`})
                      </Button>
                    </form>
                  </Card>

                  {/* Option 2: Auto-deduct from earnings */}
                  <Card className="p-5">
                    <h3 className="text-base font-bold text-charcoal dark:text-dark-text flex items-center gap-2 mb-1">
                      <FiCheckCircle className="text-emerald-600" /> Habka 2: Ka Jar Dakhliga Garoonka (System Earnings)
                    </h3>
                    <p className="text-xs text-muted mb-3">
                      Haddii aad leedahay dakhli ballamo oo garoonka ku jira oo u dhigma ama ka badan ${dueUsd}, si toos ah ayaa looga goyn karaa adoon wax lacag ah dibedda ka bixin.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handlePayAutoDeduct}
                      loading={paymentBusy}
                    >
                      Ka Jar Dakhliga Garoonka ($${dueUsd} USD)
                    </Button>
                  </Card>

                  {/* Option 3: Submit Manual Proof */}
                  <Card className="p-5">
                    <h3 className="text-base font-bold text-charcoal dark:text-dark-text flex items-center gap-2 mb-1">
                      <FiSend className="text-amber-600" /> Habka 3: Gudbi Tixraac (Zaad / eDahab Receipt)
                    </h3>
                    <p className="text-xs text-muted mb-3">
                      Haddii aad lacagta gacanta ugu dirtay xisaabta shirkadda, geli tixraaca (Transaction Reference ID) si Super Admin-ku u xaqiijiyo isla markaana garoonkaagu u furmo.
                    </p>

                    <form onSubmit={handleSubmitProof} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted mb-1">Transaction Reference ID</label>
                        <Input
                          placeholder="Tusaale: ZAAD-849201 ama EDAHAB-73921"
                          value={proofRef}
                          onChange={(e) => setProofRef(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted mb-1">Xusuusin (Optional)</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
                          placeholder="Waxa aan ku soo diray lambarka..."
                          value={proofNotes}
                          onChange={(e) => setProofNotes(e.target.value)}
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="secondary"
                        icon={<FiSend />}
                        loading={proofBusy}
                      >
                        Gudbi Caddeynta Lacag-Bixinta
                      </Button>
                    </form>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
