import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import {
  FiDollarSign,
  FiClock,
  FiLock,
  FiCheckCircle,
  FiArrowUpRight,
  FiShield,
  FiPhone,
  FiChevronLeft,
  FiChevronRight,
  FiAlertCircle,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Modal from '../../components/common/Modal';
import MediaUpload from '../../components/common/MediaUpload';
import { ownerApi } from '../../api/ownerApi';
import { authApi } from '../../api/authApi';
import { setUser } from '../../features/auth/authSlice';
import { toastApiError } from '../../lib/support';
import Turnstile, { CAPTCHA_FAIL_MESSAGE } from '../../components/common/Turnstile';

const PAGE_SIZE = 15;

const TX_TYPES = {
  booking_escrow_credit: { label: 'Booking payment', hint: 'Held until the match is checked in', tone: 'info' },
  escrow_released: { label: 'Released to balance', hint: 'Now available to withdraw', tone: 'success' },
  withdrawal_locked: { label: 'Withdrawal requested', hint: 'Waiting for E-Garoon to pay you', tone: 'warning' },
  withdrawal_disbursed: { label: 'Withdrawal paid', hint: 'Sent to your mobile-money number', tone: 'success' },
  withdrawal_refunded: { label: 'Withdrawal returned', hint: 'Back in your available balance', tone: 'neutral' },
  booking_refund_deduction: { label: 'Booking refunded', hint: 'The customer was refunded', tone: 'danger' },
  subscription_deduction: { label: 'Subscription', hint: 'Platform subscription', tone: 'neutral' },
  joogto_monthly_credit: { label: 'Monthly team fee', hint: 'Permanent team payment', tone: 'info' },
  adjustment: { label: 'Adjustment', hint: 'Manual correction by E-Garoon', tone: 'neutral' },
};

const WD_STATUS = {
  pending_otp: { label: 'Waiting for your code', tone: 'warning' },
  pending_approval: { label: 'Under review', tone: 'info' },
  processing: { label: 'Being paid', tone: 'info' },
  completed: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const WALLET_LABELS = {
  telesom_zaad: 'Telesom ZAAD',
  hormuud_evc: 'Hormuud EVC',
  somtel_edahab: 'Somtel eDahab',
  golis_sahal: 'Golis SAHAL',
};

const usd = (n) => `$${Number(n || 0).toFixed(2)}`;
const when = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function Stat({ icon, label, value, sub, tone = '' }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon} {label}
      </p>
      <p className={`mt-1.5 text-2xl font-extrabold ${tone || 'text-foreground'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function OwnerWallet() {
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stadiumId, setStadiumId] = useState('');
  const [tab, setTab] = useState('transactions');

  const [txs, setTxs] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);

  const [txDetail, setTxDetail] = useState(null);
  const [wdDetail, setWdDetail] = useState(null);

  // withdraw flow
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wStadium, setWStadium] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(null); // { withdrawalId, phone, destination }
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef(null);

  // payout details (ID + payout number)
  const [kycOpen, setKycOpen] = useState(false);
  const [kyc, setKyc] = useState({ idType: 'national_id', idNumber: '', businessName: '', documentUrl: '', number: '', name: '' });

  const refreshUser = useCallback(() => {
    authApi.me().then((res) => dispatch(setUser(res.data.data.user))).catch(() => {});
  }, [dispatch]);

  const loadOverview = useCallback(async () => {
    try {
      const res = await ownerApi.getWallet(stadiumId ? { stadiumId } : undefined);
      setData(res.data?.data || {});
    } catch (err) {
      toastApiError(err, 'Could not load your wallet');
    }
  }, [stadiumId]);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await ownerApi.getWalletTransactions({
        ...(stadiumId ? { stadiumId } : {}),
        ...(txType ? { type: txType } : {}),
        page: txPage,
        limit: PAGE_SIZE,
      });
      setTxs(res.data?.data?.transactions || []);
      setTxTotal(res.data?.data?.total || 0);
    } catch {
      setTxs([]);
    }
  }, [stadiumId, txType, txPage]);

  const loadWithdrawals = useCallback(async () => {
    try {
      const res = await ownerApi.listWithdrawals(stadiumId ? { stadiumId } : undefined);
      setWithdrawals(res.data?.data?.withdrawals || []);
    } catch {
      setWithdrawals([]);
    }
  }, [stadiumId]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadTransactions(), loadWithdrawals()]);
  }, [loadOverview, loadTransactions, loadWithdrawals]);

  useEffect(() => {
    setLoading(true);
    reloadAll().finally(() => setLoading(false));
  }, [reloadAll]);

  const totals = data?.totals || { balance: 0, held: 0, available: 0, processing: 0, withdrawn: 0, earned: 0 };
  const wallets = data?.wallets || [];
  const destination = data?.payoutDestination || null;
  const sllPerUsd = Number(data?.sllPerUsd || 8500);
  const minWithdrawal = Number(data?.minWithdrawalUsd || 10);
  const kycStatus = data?.kyc?.status || 'unsubmitted';
  const withdrawable = wallets.filter((w) => Number(w.balanceAvailable) >= minWithdrawal && w.status === 'active');
  const canStart = Boolean(data?.canWithdraw) && withdrawable.length > 0;

  const blockedReason = useMemo(() => {
    if (!data) return '';
    if (kycStatus === 'unsubmitted') return 'Add your ID and payout number to enable withdrawals.';
    if (kycStatus === 'pending') return 'Your details are being reviewed by E-Garoon. Withdrawals open once approved.';
    if (kycStatus === 'rejected') return `Your details were not approved${data.kyc?.rejectionReason ? `: ${data.kyc.rejectionReason}` : ''}. Please resubmit.`;
    if (!destination) return 'Add a valid mobile-money number to receive withdrawals.';
    if (!withdrawable.length) return `You can withdraw once a stadium has at least ${usd(minWithdrawal)} available.`;
    return '';
  }, [data, kycStatus, destination, withdrawable.length, minWithdrawal]);

  // ───────── withdraw ─────────
  const openWithdraw = () => {
    const best = [...withdrawable].sort((a, b) => b.balanceAvailable - a.balanceAvailable)[0];
    setWStadium(best ? String(best.stadium) : '');
    setAmount('');
    setOtp('');
    setPending(null);
    setStep(1);
    setWithdrawOpen(true);
  };

  const selectedWallet = wallets.find((w) => String(w.stadium) === String(wStadium));
  const amountNum = Number(amount);

  const requestCode = async (e) => {
    e?.preventDefault();
    if (!selectedWallet) return toast.error('Choose a stadium');
    if (!(amountNum >= minWithdrawal)) return toast.error(`The minimum withdrawal is ${usd(minWithdrawal)}`);
    if (amountNum > selectedWallet.balanceAvailable) return toast.error(`Only ${usd(selectedWallet.balanceAvailable)} is available`);
    setBusy(true);
    try {
      let captchaToken = null;
      try {
        captchaToken = await captchaRef.current?.getToken();
      } catch {
        toast.error(CAPTCHA_FAIL_MESSAGE);
        return;
      }
      const res = await ownerApi.initiateWithdrawal({
        stadiumId: wStadium,
        amount: amountNum,
        ...(captchaToken ? { captchaToken } : {}),
      });
      setPending(res.data?.data);
      setOtp('');
      setStep(2);
      toast.success('We sent a verification code to your registered phone.');
    } catch (err) {
      toastApiError(err, 'Could not start the withdrawal');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 4) return toast.error('Enter the verification code');
    setBusy(true);
    try {
      await ownerApi.verifyWithdrawalOtp({ withdrawalId: pending.withdrawalId, otpCode: otp.trim() });
      toast.success('Withdrawal requested. E-Garoon will pay you shortly.');
      setWithdrawOpen(false);
      setTab('withdrawals');
      reloadAll();
    } catch (err) {
      toastApiError(err, 'That code is wrong or expired');
    } finally {
      setBusy(false);
    }
  };

  const cancelWithdrawal = async (w) => {
    if (!window.confirm(`Cancel withdrawal ${w.reference}? The money returns to your available balance.`)) return;
    try {
      await ownerApi.cancelWithdrawal(w._id);
      toast.success('Withdrawal cancelled');
      setWdDetail(null);
      reloadAll();
    } catch (err) {
      toastApiError(err, 'Could not cancel this withdrawal');
    }
  };

  // ───────── payout details ─────────
  const openKyc = () => {
    setKyc({
      idType: data?.kyc?.idType || 'national_id',
      idNumber: data?.kyc?.idNumber || '',
      businessName: data?.kyc?.businessName || '',
      documentUrl: data?.kyc?.documentUrl || '',
      number: data?.payoutAccount?.accountNumber || '',
      name: data?.payoutAccount?.accountName || '',
    });
    setKycOpen(true);
  };

  const submitKyc = async (e) => {
    e.preventDefault();
    if (!kyc.idNumber.trim() || !kyc.documentUrl.trim()) return toast.error('Enter your ID number and upload your document.');
    if (!kyc.number.trim()) return toast.error('Enter the mobile-money number to be paid.');
    setBusy(true);
    try {
      await ownerApi.submitKyc({
        idType: kyc.idType,
        idNumber: kyc.idNumber.trim(),
        businessName: kyc.businessName.trim() || undefined,
        documentUrl: kyc.documentUrl.trim(),
        payoutAccountNumber: kyc.number.trim(),
        payoutAccountName: kyc.name.trim() || undefined,
      });
      toast.success('Submitted. E-Garoon will review your details before withdrawals open.');
      setKycOpen(false);
      loadOverview();
      refreshUser();
    } catch (err) {
      toastApiError(err, 'Could not submit your details');
    } finally {
      setBusy(false);
    }
  };

  const txPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));
  const openWithdrawals = withdrawals.filter((w) => ['pending_otp', 'pending_approval', 'processing'].includes(w.status));

  return (
    <PageTransition>
      <PageHeader
        title="E-Garoon Wallet"
        description="Your earnings from booked fields, and your withdrawals."
        actions={
          wallets.length > 1 ? (
            <Select value={stadiumId} onChange={(e) => { setStadiumId(e.target.value); setTxPage(1); }}>
              <option value="">All stadiums</option>
              {wallets.map((w) => (
                <option key={w.stadium} value={w.stadium}>{w.stadiumName}</option>
              ))}
            </Select>
          ) : null
        }
      />

      {loading && !data ? (
        <Card className="p-8 text-center text-sm text-muted">Loading your wallet…</Card>
      ) : (
        <>
          {/* balances */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<FiDollarSign />} label="Total balance" value={usd(totals.balance)} sub="Everything you are owed" tone="text-forest" />
            <Stat icon={<FiCheckCircle />} label="Available to withdraw" value={usd(totals.available)} sub={`≈ ${Math.round(totals.available * sllPerUsd).toLocaleString()} SlSh`} />
            <Stat icon={<FiLock />} label="In escrow" value={usd(totals.held)} sub="Released after the match is checked in" />
            <Stat icon={<FiClock />} label="Being withdrawn" value={usd(totals.processing)} sub="Requested, not yet paid" />
          </div>
          <p className="mt-2 text-xs text-muted">
            Earned so far: <strong>{usd(totals.earned)}</strong> · Paid out to you: <strong>{usd(totals.withdrawn)}</strong>
          </p>

          {/* per stadium */}
          {wallets.length > 1 && !stadiumId && (
            <Card className="mt-4 overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Stadium</th>
                    <th className="px-4 py-2.5">Available</th>
                    <th className="px-4 py-2.5">In escrow</th>
                    <th className="px-4 py-2.5">Being withdrawn</th>
                    <th className="px-4 py-2.5">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wallets.map((w) => (
                    <tr key={w._id}>
                      <td className="px-4 py-2.5 font-semibold">{w.stadiumName}</td>
                      <td className="px-4 py-2.5">{usd(w.balanceAvailable)}</td>
                      <td className="px-4 py-2.5">{usd(w.balanceHeld)}</td>
                      <td className="px-4 py-2.5">{usd(w.balanceProcessing)}</td>
                      <td className="px-4 py-2.5">{usd(w.totalEarned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* withdraw card */}
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <FiPhone /> Withdraw to your registered number
                </p>
                {destination ? (
                  <p className="mt-1 text-sm text-foreground">
                    <strong>{destination.methodLabel}</strong> · {destination.display}
                    {destination.accountName ? <span className="text-muted"> · {destination.accountName}</span> : null}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-rose-700">No valid mobile-money number on your account yet.</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  Money is only ever sent to this number. To change it, update your payout details — E-Garoon re-checks them
                  before the next withdrawal. Each withdrawal needs a code sent to your phone.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={openKyc} icon={<FiShield />}>
                  {kycStatus === 'unsubmitted' ? 'Add payout details' : 'Update payout details'}
                </Button>
                <Button onClick={openWithdraw} disabled={!canStart} icon={<FiArrowUpRight />}>
                  Withdraw
                </Button>
              </div>
            </div>
            {blockedReason && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <FiAlertCircle className="mt-0.5 shrink-0" /> {blockedReason}
              </p>
            )}
            {openWithdrawals.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                {openWithdrawals.length} withdrawal{openWithdrawals.length > 1 ? 's' : ''} in progress — see the Withdrawals tab.
              </p>
            )}
          </Card>

          {/* tabs */}
          <div className="mt-6 flex gap-2 border-b border-border">
            {[
              ['transactions', 'Transactions'],
              ['withdrawals', `Withdrawals${withdrawals.length ? ` (${withdrawals.length})` : ''}`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
                  tab === key ? 'border-forest text-forest' : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'transactions' && (
            <Card className="mt-4 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="text-sm font-bold">Every movement on your balance</p>
                <Select value={txType} onChange={(e) => { setTxType(e.target.value); setTxPage(1); }}>
                  <option value="">All types</option>
                  {Object.entries(TX_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
              {txs.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">No transactions yet. Earnings appear here when a booked field is paid.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">What</th>
                        <th className="px-4 py-2.5">Booking</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {txs.map((t) => {
                        const meta = TX_TYPES[t.type] || { label: t.type, tone: 'neutral' };
                        const sign = t.direction === 'credit' ? '+' : t.direction === 'debit' ? '−' : '';
                        const tone = t.direction === 'credit' ? 'text-emerald-700' : t.direction === 'debit' ? 'text-rose-700' : 'text-foreground';
                        const b = t.booking;
                        return (
                          <tr key={t._id} onClick={() => setTxDetail(t)} className="cursor-pointer hover:bg-black/[0.03]">
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{when(t.createdAt)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={meta.tone}>{meta.label}</Badge>
                              <p className="mt-1 text-[11px] text-muted">{t.stadium?.name}</p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {b ? (
                                <>
                                  <p className="font-mono font-semibold">{b.bookingCode || '—'}</p>
                                  <p className="text-muted">{b.field?.name}{b.startTime ? ` · ${when(b.startTime)}` : ''}</p>
                                </>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right text-base font-extrabold ${tone}`}>
                              {sign}{usd(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {txPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs">
                  <span className="text-muted">Page {txPage} of {txPages} · {txTotal} transactions</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)} icon={<FiChevronLeft />} />
                    <Button size="sm" variant="outline" disabled={txPage >= txPages} onClick={() => setTxPage((p) => p + 1)} icon={<FiChevronRight />} />
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === 'withdrawals' && (
            <Card className="mt-4 overflow-hidden p-0">
              {withdrawals.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">No withdrawals yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted">
                      <tr>
                        <th className="px-4 py-2.5">Requested</th>
                        <th className="px-4 py-2.5">Reference</th>
                        <th className="px-4 py-2.5">Paid to</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {withdrawals.map((w) => {
                        const st = WD_STATUS[w.status] || { label: w.status, tone: 'neutral' };
                        return (
                          <tr key={w._id} onClick={() => setWdDetail(w)} className="cursor-pointer hover:bg-black/[0.03]">
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{when(w.createdAt)}</td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold">{w.reference}</td>
                            <td className="px-4 py-3 text-xs">
                              {WALLET_LABELS[w.payoutMethod] || w.payoutMethod}
                              <p className="text-muted">{w.payoutPhone}</p>
                            </td>
                            <td className="px-4 py-3"><Badge variant={st.tone}>{st.label}</Badge></td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold">
                              {usd(w.amount)}
                              <p className="text-[10px] font-normal text-muted">{Math.round(w.amountSlsh || w.amount * sllPerUsd).toLocaleString()} SlSh</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ───────── transaction details ───────── */}
      <Modal open={Boolean(txDetail)} onClose={() => setTxDetail(null)} title="Transaction details" size="md">
        {txDetail && (
          <div>
            <p className="mb-3 text-sm text-muted">{(TX_TYPES[txDetail.type] || {}).hint}</p>
            <Row label="Type">{(TX_TYPES[txDetail.type] || { label: txDetail.type }).label}</Row>
            <Row label="Amount"><span className="text-lg font-extrabold">{usd(txDetail.amount)}</span></Row>
            <Row label="Date">{when(txDetail.createdAt)}</Row>
            <Row label="Stadium">{txDetail.stadium?.name || '—'}</Row>
            {txDetail.booking && (
              <>
                <Row label="Booking"><span className="font-mono">{txDetail.booking.bookingCode || '—'}</span></Row>
                <Row label="Field">{txDetail.booking.field?.name || '—'}</Row>
                <Row label="Match time">{when(txDetail.booking.startTime)}</Row>
              </>
            )}
            <Row label="Moves">{{ held: 'Escrow', available: 'Available balance', processing: 'Being withdrawn', withdrawn: 'Paid out' }[txDetail.targetBalance] || txDetail.targetBalance}</Row>
            <Row label="Status">{txDetail.status}</Row>
            {txDetail.referenceCode && <Row label="Reference"><span className="font-mono">{txDetail.referenceCode}</span></Row>}
            <p className="mt-3 rounded-xl bg-black/[0.04] p-3 text-xs text-muted">{txDetail.description}</p>
          </div>
        )}
      </Modal>

      {/* ───────── withdrawal details ───────── */}
      <Modal open={Boolean(wdDetail)} onClose={() => setWdDetail(null)} title="Withdrawal details" size="md">
        {wdDetail && (() => {
          const st = WD_STATUS[wdDetail.status] || { label: wdDetail.status, tone: 'neutral' };
          const steps = [
            { label: 'Requested', at: wdDetail.createdAt, done: true },
            { label: 'Confirmed with your code', at: wdDetail.otpVerifiedAt, done: Boolean(wdDetail.otpVerifiedAt) },
            {
              label: wdDetail.status === 'rejected' ? 'Rejected' : 'Paid to your number',
              at: wdDetail.disbursedAt,
              done: ['completed', 'rejected'].includes(wdDetail.status),
            },
          ];
          return (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl font-extrabold">{usd(wdDetail.amount)}</span>
                <Badge variant={st.tone}>{st.label}</Badge>
              </div>
              <Row label="Reference"><span className="font-mono">{wdDetail.reference}</span></Row>
              <Row label="In SlSh">{Math.round(wdDetail.amountSlsh || wdDetail.amount * sllPerUsd).toLocaleString()} SlSh</Row>
              <Row label="Paid to">{WALLET_LABELS[wdDetail.payoutMethod] || wdDetail.payoutMethod} · {wdDetail.payoutPhone}</Row>
              {wdDetail.payoutAccountName && <Row label="Account name">{wdDetail.payoutAccountName}</Row>}
              <Row label="Stadium">{wdDetail.stadium?.name || '—'}</Row>
              {wdDetail.disbursementReference && <Row label="Payment reference"><span className="font-mono">{wdDetail.disbursementReference}</span></Row>}
              {wdDetail.rejectionReason && <Row label="Reason">{wdDetail.rejectionReason}</Row>}

              <ol className="mt-4 space-y-2">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span className={s.done ? 'text-emerald-600' : 'text-muted'}><FiCheckCircle /></span>
                    <span className={s.done ? 'font-semibold' : 'text-muted'}>{s.label}</span>
                    {s.at && <span className="ms-auto text-xs text-muted">{when(s.at)}</span>}
                  </li>
                ))}
              </ol>

              {['pending_otp', 'pending_approval'].includes(wdDetail.status) && (
                <Button className="mt-4 w-full" variant="danger" onClick={() => cancelWithdrawal(wdDetail)}>
                  Cancel this withdrawal
                </Button>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ───────── withdraw ───────── */}
      <Modal open={withdrawOpen} onClose={() => !busy && setWithdrawOpen(false)} title="Withdraw money" size="md">
        {withdrawOpen && <Turnstile ref={captchaRef} action="withdraw" className="mb-2" />}
        {step === 1 ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">From stadium</label>
              <Select value={wStadium} onChange={(e) => setWStadium(e.target.value)}>
                {withdrawable.map((w) => (
                  <option key={w.stadium} value={w.stadium}>
                    {w.stadiumName} — {usd(w.balanceAvailable)} available
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Input
                label={`Amount (USD) — minimum ${usd(minWithdrawal)}`}
                type="number"
                min={minWithdrawal}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                <span>{amountNum > 0 ? `≈ ${Math.round(amountNum * sllPerUsd).toLocaleString()} SlSh` : ' '}</span>
                {selectedWallet && (
                  <button type="button" className="font-semibold text-forest hover:underline" onClick={() => setAmount(String(selectedWallet.balanceAvailable))}>
                    Withdraw everything ({usd(selectedWallet.balanceAvailable)})
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-black/[0.03] p-3 text-sm">
              <p className="text-xs font-semibold text-muted">Money will be sent to</p>
              <p className="mt-0.5 font-bold">{destination?.methodLabel} · {destination?.display}</p>
              {destination?.accountName && <p className="text-xs text-muted">{destination.accountName}</p>}
            </div>
            <p className="text-xs text-muted">We’ll text a verification code to your registered phone to confirm this request.</p>
            <Button type="submit" loading={busy} className="w-full">Send verification code</Button>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="space-y-4">
            <p className="text-sm text-foreground">
              Enter the 6-digit code we sent to <strong>{pending?.phone}</strong> to confirm withdrawing{' '}
              <strong>{usd(amountNum)}</strong> to {pending?.payoutDestination?.methodLabel} {pending?.payoutDestination?.display}.
            </p>
            {pending?.devCode && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Test mode — your code is {pending.devCode}</p>
            )}
            <Input label="Verification code" inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus required />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={busy}>Back</Button>
              <Button type="button" variant="outline" onClick={requestCode} disabled={busy}>Resend code</Button>
              <Button type="submit" loading={busy} className="flex-1">Confirm withdrawal</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ───────── payout details ───────── */}
      <Modal open={kycOpen} onClose={() => !busy && setKycOpen(false)} title="Payout details" size="lg">
        <form onSubmit={submitKyc} className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            After you submit, E-Garoon reviews these details. Withdrawals are paused until they are approved.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Document type</label>
              <Select value={kyc.idType} onChange={(e) => setKyc({ ...kyc, idType: e.target.value })}>
                <option value="national_id">National ID</option>
                <option value="business_license">Business license</option>
                <option value="passport">Passport</option>
              </Select>
            </div>
            <Input label="Document number" value={kyc.idNumber} onChange={(e) => setKyc({ ...kyc, idNumber: e.target.value })} required />
          </div>
          <Input label="Business name (optional)" value={kyc.businessName} onChange={(e) => setKyc({ ...kyc, businessName: e.target.value })} />
          <MediaUpload
            folder="misc"
            accept="image/*,application/pdf"
            label="Upload your ID or license"
            value={kyc.documentUrl}
            onChange={(url) => setKyc((k) => ({ ...k, documentUrl: url }))}
          />
          <Input label="…or paste a link to the document" placeholder="https://" value={kyc.documentUrl} onChange={(e) => setKyc({ ...kyc, documentUrl: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
            <Input
              label="Mobile-money number (withdrawals go here)"
              placeholder="063 1234567"
              value={kyc.number}
              onChange={(e) => setKyc({ ...kyc, number: e.target.value })}
              required
            />
            <Input label="Name on the account" value={kyc.name} onChange={(e) => setKyc({ ...kyc, name: e.target.value })} />
          </div>
          <p className="text-[11px] text-muted">Telesom (063), Somtel (065), Hormuud (061) and Golis (090) numbers are supported.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setKycOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>Submit for review</Button>
          </div>
        </form>
      </Modal>

      <p className="mt-6 text-center text-[11px] text-muted">
        Questions about a payment? <Link to="/contact" className="font-semibold text-forest hover:underline">Contact E-Garoon</Link>
      </p>
    </PageTransition>
  );
}
