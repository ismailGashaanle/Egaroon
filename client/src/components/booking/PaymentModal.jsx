import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  FiCheckCircle,
  FiCreditCard,
  FiLock,
  FiSmartphone,
  FiAlertCircle,
  FiCopy,
  FiShare2,
  FiCheck,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import SomaliPhoneInput, { composedPhone } from '../common/SomaliPhoneInput';
import { paymentApi, bookingApi } from '../../api/bookingApi';
import { toastApiError } from '../../lib/support';
import { SO_CARRIERS, splitSomaliPhone, phoneMatchesOperator, extractSubscriberBody } from '../../lib/somaliPhone';
import {
  buildMatchSharePackage,
  resolveTeamAShareName,
  whatsAppShareUrl,
} from '../../lib/matchShare';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import toast from 'react-hot-toast';
import PricingBreakdown from './PricingBreakdown';

const OPERATORS = [
  { id: 'hormuud', labelKey: 'payment.opHormuud', sub: 'Waafi / EVC · 061', provider: 'waafipay' },
  { id: 'telesom', labelKey: 'payment.opTelesom', sub: 'Zaad · 063', provider: 'waafipay' },
  { id: 'somtel', labelKey: 'payment.opSomtel', sub: 'eDahab · 065', provider: 'dahabpay' },
  { id: 'golis', labelKey: 'payment.opGolis', sub: 'Sahal / eDahab · 090', provider: 'dahabpay' },
];

const TERMINAL_OK = ['SUCCESS', 'HELD', 'SETTLED'];
const TERMINAL_FAIL = ['FAILED', 'REFUNDED'];
const NAME_RE = /^[\p{L}\p{N}\p{M}\s'.-]{2,80}$/u;

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function sanitizeNameClient(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const PAID_STATUSES = ['SUCCESS', 'HELD', 'SETTLED'];

/** Team A captain may cover both shares only before their side is paid (BR-006). */
function canCaptainCoverFull(booking, side) {
  if (side !== 'teamA' || !booking) return false;
  if (booking.coveredFullMatch) return false;
  if (PAID_STATUSES.includes(booking.teamA?.paymentStatus)) return false;
  return ['HELD', 'PAYMENT_PENDING'].includes(booking.status);
}

/**
 * Captain payment confirmation popup — name, MM phone, carrier, optional Team B lock, price from API.
 * Team A on a hold can pick share-only vs coverFullMatch (server-priced).
 */
export default function PaymentModal({
  open,
  onClose,
  booking,
  side = 'teamA',
  coverFullMatch: coverParam = false,
  defaultPhone,
  defaultName,
  onPaid,
}) {
  const { t } = useTranslation();
  const { sllPerUsd: featureRate } = useAuthFeatures();
  const [currencyChoice, setCurrencyChoice] = useState('USD'); // 'USD' | 'SLL'
  const [payerName, setPayerName] = useState('');
  const [coverChoice, setCoverChoice] = useState(false);
  const [operator, setOperator] = useState('hormuud');
  const [payerLocal, setPayerLocal] = useState('');
  const [inviteCarrier, setInviteCarrier] = useState('telesom');
  const [inviteLocal, setInviteLocal] = useState('');
  const [teamBCarrier, setTeamBCarrier] = useState('telesom');
  const [teamBLocal, setTeamBLocal] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [phase, setPhase] = useState('form'); // form | pushing | done | failed | share
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  // Demo buttons are for the mock provider only — never assume mock before the server answers.
  const [isMock, setIsMock] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [warning, setWarning] = useState(null);
  const [failReason, setFailReason] = useState(null);
  const [sharePkg, setSharePkg] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollRef = useRef(null);

  const canCoverFull = canCaptainCoverFull(booking, side);
  const coverFullMatch = canCoverFull && coverChoice;
  const party = booking?.[side];

  const rentTotal = Number(booking?.pricing?.stadiumRentTotal ?? booking?.pricing?.totalPrice ?? 0);
  const rentShare = Number(booking?.pricing?.teamShare ?? rentTotal / 2);

  const derivedFeePerTeam =
    booking?.pricing?.payableTeamShare != null && booking?.pricing?.teamShare != null
      ? Math.max(0, Math.round((Number(booking.pricing.payableTeamShare) - Number(booking.pricing.teamShare)) * 100) / 100)
      : Number(booking?.financialSnapshot?.bookingFeeUsd || 0);
  const platformFee = Number(booking?.pricing?.platformFee ?? derivedFeePerTeam ?? 0);
  const platformFeeFull = Number(
    booking?.pricing?.platformFeeFullMatch ??
      (booking?.pricing?.payableFullMatch != null && booking?.pricing?.totalPrice != null
        ? Math.max(0, Math.round((Number(booking.pricing.payableFullMatch) - Number(booking.pricing.totalPrice)) * 100) / 100)
        : platformFee * 2)
  );

  const total = Number(booking?.pricing?.payableFullMatch ?? (rentTotal + platformFeeFull));
  const teamShare = Number(
    booking?.pricing?.payableTeamShare ??
      (party?.amountDue && Number(party.amountDue) > rentShare
        ? Number(party.amountDue)
        : rentShare + platformFee)
  );
  const discount = Number(booking?.pricing?.discountAmount || 0);
  const amount = coverFullMatch ? total : teamShare;

  const sllPerUsd = Number(
    booking?.financialSnapshot?.sllPerUsd ||
      booking?.pricing?.sllPerUsd ||
      featureRate ||
      8500
  );
  const amountSll = Math.round(amount * sllPerUsd);
  const formatSll = (n) => `${Number(n || 0).toLocaleString()} SlSh`;

  useEffect(() => {
    if (!open) return undefined;
    setPhase('form');
    setSubmitting(false);
    setPaymentId(null);
    setIsMock(false);
    setIsSandbox(false);
    setWarning(null);
    setFailReason(null);
    setSharePkg(null);
    setCopiedCode(false);
    setInviteLocal('');
    setTeamBLocal('');
    setTeamBName('');
    setCoverChoice(Boolean(coverParam));
    setPayerName(sanitizeNameClient(defaultName || ''));
    // Never prefill the number: the customer types the wallet they want to pay from.
    // (The carrier is still guessed from their profile so the right prefix is preselected.)
    const split = splitSomaliPhone(defaultPhone);
    setOperator(split.carrierId || 'hormuud');
    setPayerLocal('');
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, defaultPhone, defaultName, coverParam]);

  useEffect(() => {
    if (phase !== 'pushing' || !paymentId) return undefined;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await paymentApi.get(paymentId);
        const status = data.data.payment?.status;
        if (TERMINAL_OK.includes(status)) {
          clearInterval(pollRef.current);
          toast.success(t('payment.successToast'));
          await finishSuccess(data.data.payment);
        } else if (TERMINAL_FAIL.includes(status)) {
          clearInterval(pollRef.current);
          setPhase('failed');
          setFailReason(t('payment.failedGeneric'));
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishSuccess closes over latest booking
  }, [phase, paymentId, t]);

  const finishSuccess = async (payment) => {
    onPaid?.(payment);
    if (side === 'teamA' && !coverFullMatch) {
      try {
        const { data } = await bookingApi.get(booking._id);
        const b = data.data?.booking || data.data;
        if (b?.matchCode) {
          const pkg = buildMatchSharePackage({
            code: b.matchCode,
            teamAPhone: b.teamAPayerPhone || payment?.payerPhone || defaultPhone,
            teamAName: resolveTeamAShareName(b) || sanitizeNameClient(payerName),
          });
          setSharePkg(pkg);
          setPhase('share');
          return;
        }
      } catch {
        /* fall through */
      }
    }
    setPhase('done');
  };

  const handleOperatorChange = (id) => {
    setOperator(id);
    if (payerLocal) {
      setPayerLocal(extractSubscriberBody(payerLocal, id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = sanitizeNameClient(payerName);
    if (!name || !NAME_RE.test(name)) {
      toast.error(t('payment.nameInvalid'));
      return;
    }
    const payerPhone = composedPhone(operator, payerLocal);
    if (!payerPhone || !phoneMatchesOperator(payerPhone, operator)) {
      toast.error(t('payment.phoneMismatch'));
      return;
    }

    let teamBContactPhone;
    let invitePhoneTeamB;
    if (side === 'teamB') {
      teamBContactPhone = composedPhone(teamBCarrier, teamBLocal) || payerPhone;
    } else if (side === 'teamA' && !coverFullMatch && inviteLocal) {
      invitePhoneTeamB = composedPhone(inviteCarrier, inviteLocal);
      if (!invitePhoneTeamB) {
        toast.error(t('payment.invitePhoneInvalid'));
        return;
      }
    }

    setSubmitting(true);
    setWarning(null);
    setFailReason(null);
    try {
      const teamId = party?.team?._id || party?.team;
      const { data } = await paymentApi.initiate({
        bookingId: booking._id,
        teamId,
        side,
        coverFullMatch,
        carrierId: operator,
        operator,
        currency: currencyChoice,
        payCurrency: currencyChoice,
        amount: currencyChoice === 'SLL' ? amountSll : amount,
        amountUsd: amount,
        amountSll,
        exchangeRate: sllPerUsd,
        phone: payerPhone,
        payerPhone,
        payerName: name,
        invitePhoneTeamB: invitePhoneTeamB || undefined,
        teamBContactPhone,
        teamBContactName: side === 'teamB' ? sanitizeNameClient(teamBName) || undefined : undefined,
        idempotencyKey: `${booking._id}-${side}-${coverFullMatch ? 'full' : 'share'}-${currencyChoice}-${Date.now()}`,
      });
      const payment = data.data.payment;
      setPaymentId(payment._id);
      const checkout = data.data.checkout || {};
      setIsMock(
        checkout.mode === 'mock' ||
          checkout.mode === 'demo' ||
          checkout.provider === 'mock' ||
          payment.provider === 'mock'
      );
      setIsSandbox(checkout.mode === 'sandbox');
      if (data.data.warning) setWarning(data.data.warning);
      setPhase('pushing');
    } catch (err) {
      toastApiError(err, t('payment.initiateFail'));
      setPhase('failed');
      setFailReason(err?.response?.data?.error?.message || err?.response?.data?.message || t('payment.failedGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockSuccess = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    try {
      const { data } = await paymentApi.mockConfirm(paymentId);
      toast.success(t('payment.successToast'));
      await finishSuccess(data.data?.payment);
    } catch (err) {
      toastApiError(err, t('payment.initiateFail'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockFail = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    try {
      await paymentApi.mockFail(paymentId, t('payment.insufficient'));
      setPhase('failed');
      setFailReason(t('payment.insufficient'));
    } catch (err) {
      toastApiError(err, t('payment.initiateFail'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    onClose();
  };

  const copyCode = async () => {
    if (!sharePkg?.code) return;
    try {
      await navigator.clipboard.writeText(sharePkg.code);
      setCopiedCode(true);
      toast.success(t('payment.codeCopied'));
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error(t('payment.shareCopyFail'));
    }
  };

  const copyShare = async () => {
    if (!sharePkg?.text) return;
    try {
      await navigator.clipboard.writeText(sharePkg.text);
      toast.success(t('payment.shareCopied'));
    } catch {
      toast.error(t('payment.shareCopyFail'));
    }
  };

  const shareWhatsApp = () => {
    if (!sharePkg?.text) return;
    window.open(whatsAppShareUrl(sharePkg.text), '_blank', 'noopener,noreferrer');
  };

  const stadiumName = booking?.stadium?.name || '—';
  const fieldName = booking?.field?.name || '—';
  const when = booking?.startTime ? new Date(booking.startTime).toLocaleString() : '—';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('payment.title')}
      size="lg"
      branded
      className="bg-gradient-to-b from-brand-green/[0.06] via-white to-white dark:from-brand-green/10 dark:via-dark-surface dark:to-dark-surface"
    >
      {phase === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {canCoverFull && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-overline text-disabled">{t('payment.payModeTitle')}</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('payment.payModeTitle')}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!coverChoice}
                  onClick={() => setCoverChoice(false)}
                  className={clsx(
                    'focus-ring flex w-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors',
                    !coverChoice
                      ? 'border-brand-green bg-brand-green/5 dark:border-brand-green dark:bg-brand-green/10'
                      : 'border-border hover:border-brand-green/30 dark:border-dark-border'
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <FiUser className="shrink-0 text-brand-green" />
                      {t('payment.payModeShareTitle')}
                    </span>
                    {!coverChoice && <FiCheckCircle className="shrink-0 text-brand-green" />}
                  </span>
                  <span className="font-display text-lg font-bold tabular-nums text-brand-green">
                    {money(teamShare)}
                  </span>
                  <span className="text-xs text-muted">{t('payment.payModeShareHint')}</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={coverChoice}
                  onClick={() => setCoverChoice(true)}
                  className={clsx(
                    'focus-ring flex w-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors',
                    coverChoice
                      ? 'border-brand-green bg-brand-green/5 dark:border-brand-green dark:bg-brand-green/10'
                      : 'border-border hover:border-brand-green/30 dark:border-dark-border'
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <FiUsers className="shrink-0 text-brand-green" />
                      {t('payment.payModeFullTitle')}
                    </span>
                    {coverChoice && <FiCheckCircle className="shrink-0 text-brand-green" />}
                  </span>
                  <span className="font-display text-lg font-bold tabular-nums text-brand-green">
                    {money(total)}
                  </span>
                  <span className="text-xs text-muted">{t('payment.payModeFullHint')}</span>
                </button>
              </div>
            </fieldset>
          )}

          {/* Somaliland Currency Choice: USD vs Somaliland Shillings */}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-overline text-disabled">
              {t('payment.currencyTitle') || 'Dooro Lacagta Aad Ku Bixinayso (Payment Currency)'}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Currency selection">
              <button
                type="button"
                role="radio"
                aria-checked={currencyChoice === 'USD'}
                onClick={() => setCurrencyChoice('USD')}
                className={clsx(
                  'focus-ring flex w-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors',
                  currencyChoice === 'USD'
                    ? 'border-brand-green bg-brand-green/5 dark:border-brand-green dark:bg-brand-green/10'
                    : 'border-border hover:border-brand-green/30 dark:border-dark-border'
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <span>💵 Dollar (USD)</span>
                  </span>
                  {currencyChoice === 'USD' && <FiCheckCircle className="shrink-0 text-brand-green" />}
                </span>
                <span className="font-display text-lg font-bold tabular-nums text-brand-green">
                  {money(amount)}
                </span>
                <span className="text-xs text-muted">Bixi Dollar ($ USD)</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={currencyChoice === 'SLL'}
                onClick={() => setCurrencyChoice('SLL')}
                className={clsx(
                  'focus-ring flex w-full flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors',
                  currencyChoice === 'SLL'
                    ? 'border-brand-green bg-brand-green/5 dark:border-brand-green dark:bg-brand-green/10'
                    : 'border-border hover:border-brand-green/30 dark:border-dark-border'
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <span>Shilin Somaliland (SlSh)</span>
                  </span>
                  {currencyChoice === 'SLL' && <FiCheckCircle className="shrink-0 text-brand-green" />}
                </span>
                <span className="font-display text-lg font-bold tabular-nums text-brand-green">
                  {formatSll(amountSll)}
                </span>
                <span className="text-xs text-muted">
                  Sarifka: $1 = {sllPerUsd.toLocaleString()} SlSh
                </span>
              </button>
            </div>
            {currencyChoice === 'SLL' && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>💡 Sarifka maanta: <strong>$1 USD = {sllPerUsd.toLocaleString()} SlSh</strong></span>
                <span className="text-[11px] opacity-75">Waxaa maamula Super Admin</span>
              </div>
            )}
          </fieldset>

          <div className="rounded-xl border border-brand-green/20 bg-white/80 p-4 space-y-2 text-sm shadow-soft dark:border-brand-green/25 dark:bg-dark-surface-2/80">
            <div className="flex justify-between gap-2">
              <span className="text-muted">{t('payment.stadium')}</span>
              <span className="font-medium text-right">{stadiumName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted">{t('payment.field')}</span>
              <span className="font-medium text-right">{fieldName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted">{t('payment.time')}</span>
              <span className="font-medium text-right">{when}</span>
            </div>
            <div className="border-t border-border pt-2 dark:border-dark-border space-y-2">
              <PricingBreakdown
                pricing={booking?.pricing}
                t={t}
                ns="payment"
                coverFullMatch={coverFullMatch}
              />
              {discount > 0 && (
                <div className="flex justify-between text-xs text-status-confirmed-text">
                  <span>{t('payment.discount')}</span>
                  <span>−{money(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-border pt-2 dark:border-dark-border">
                <span className="font-semibold">{t('payment.youPay')}</span>
                <div className="text-right">
                  <span className="font-display text-2xl font-bold text-brand-green">
                    {currencyChoice === 'SLL' ? formatSll(amountSll) : money(amount)}
                  </span>
                  {currencyChoice === 'SLL' && (
                    <span className="block text-xs text-muted font-medium">
                      (U dhiganta {money(amount)} USD)
                    </span>
                  )}
                </div>
              </div>
              {coverFullMatch && (
                <p className="text-xs text-status-confirmed-text">{t('payment.fullMatchHint')}</p>
              )}
              {canCoverFull && !coverFullMatch && (
                <p className="text-xs text-muted">{t('payment.shareOnlyHint')}</p>
              )}
            </div>
          </div>

          <Input
            label={t('payment.captainName')}
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder={t('payment.captainNamePh')}
            required
            maxLength={80}
            hint={t('payment.captainNameHint')}
          />

          <div>
            <p className="mb-2 text-overline text-disabled">{t('payment.chooseOperator')}</p>
            <div className="space-y-1.5">
              {OPERATORS.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => handleOperatorChange(op.id)}
                  className={clsx(
                    'focus-ring flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm transition-colors',
                    operator === op.id
                      ? 'border-brand-green bg-brand-green/5 dark:border-brand-green dark:bg-brand-green/10'
                      : 'border-border hover:border-brand-green/30 dark:border-dark-border'
                  )}
                >
                  <span className="flex items-center gap-2.5 text-left">
                    <FiSmartphone className="shrink-0 text-brand-green" />
                    <span>
                      <span className="block font-medium">{t(op.labelKey)}</span>
                      <span className="text-xs text-muted">{op.sub}</span>
                    </span>
                  </span>
                  {operator === op.id && <FiCheckCircle className="text-brand-green" />}
                </button>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-disabled dark:border-dark-border">
                <span className="flex items-center gap-2.5">
                  <FiCreditCard /> {t('payment.cardSoon')}
                </span>
                <span className="text-xs">{t('settings.comingSoon')}</span>
              </div>
            </div>
          </div>

          <SomaliPhoneInput
            label={t('payment.payerPhone')}
            carrierId={operator}
            onCarrierChange={handleOperatorChange}
            localNumber={payerLocal}
            onLocalNumberChange={setPayerLocal}
            lockCarrier
            required
            hint={t('payment.payerHint')}
          />

          {side === 'teamA' && !coverFullMatch && (
            <div className="space-y-3 rounded-xl border border-brand-green/15 bg-brand-green/[0.03] p-3 dark:border-brand-green/20">
              <p className="text-sm font-semibold">{t('payment.inviteOptionalTitle')}</p>
              <p className="text-xs text-muted">{t('payment.inviteOptionalHint')}</p>
              <SomaliPhoneInput
                label={t('payment.invitePhoneTeamB')}
                carrierId={inviteCarrier}
                onCarrierChange={setInviteCarrier}
                localNumber={inviteLocal}
                onLocalNumberChange={setInviteLocal}
                hint={t('payment.invitePhoneHint')}
              />
            </div>
          )}

          {side === 'teamB' && (
            <div className="space-y-3 rounded-xl border border-border p-3 dark:border-dark-border">
              <p className="text-sm font-semibold">{t('payment.teamBSection')}</p>
              <Input
                label={t('payment.teamBName')}
                value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)}
                placeholder={t('payment.teamBNamePh')}
                maxLength={80}
              />
              <SomaliPhoneInput
                label={t('payment.teamBPhone')}
                carrierId={teamBCarrier}
                onCarrierChange={setTeamBCarrier}
                localNumber={teamBLocal}
                onLocalNumberChange={setTeamBLocal}
                hint={t('payment.teamBPhoneHint')}
              />
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" loading={submitting} icon={<FiLock />}>
            {currencyChoice === 'SLL'
              ? `Xaqiiji & Bixi ${formatSll(amountSll)}`
              : t('payment.confirmPay', { amount: money(amount) })}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-disabled">
            <FiLock size={12} /> {t('payment.secureNote')}
          </p>
        </form>
      )}

      {phase === 'pushing' && (
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="font-semibold text-charcoal dark:text-dark-text">{t('payment.pushing')}</p>
          <p className="text-sm text-muted">{t('payment.pushingHint')}</p>
          {isSandbox && (
            <p className="rounded-xl bg-status-pending-bg px-3 py-2 text-left text-xs text-status-pending-text">
              Test mode: only Sifalo test wallets work — e.g. Telesom 063 1111111 (success), 063 3333333 (pending).
              Real numbers will be declined.
            </p>
          )}
          {warning && (
            <p className="flex items-start gap-2 rounded-xl bg-status-pending-bg px-3 py-2 text-left text-xs text-status-pending-text">
              <FiAlertCircle className="mt-0.5 shrink-0" /> {warning}
            </p>
          )}
          {isMock && (
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" loading={submitting} onClick={handleMockSuccess}>
                {t('payment.mockSuccess')}
              </Button>
              <Button variant="danger" loading={submitting} onClick={handleMockFail}>
                {t('payment.mockFail')}
              </Button>
              <p className="text-[11px] text-disabled">{t('payment.mockDevNote')}</p>
            </div>
          )}
        </div>
      )}

      {phase === 'share' && sharePkg && (
        <div className="space-y-4 py-1">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
              <FiCheckCircle size={28} />
            </div>
            <p className="mt-3 font-display text-lg font-bold">{t('payment.successTitle')}</p>
            <p className="mt-1 text-sm text-muted">{t('payment.shareReady')}</p>
          </div>

          {sharePkg.teamAName ? (
            <p className="text-center text-sm text-muted">
              Kooxda:{' '}
              <span className="font-semibold text-charcoal dark:text-dark-text">
                {sharePkg.teamAName}
              </span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={copyCode}
            className="group relative w-full overflow-hidden rounded-2xl border-2 border-brand-green/40 bg-brand-navy px-4 py-5 text-center transition hover:border-brand-green focus-ring"
            title={t('payment.copyCode')}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
              Match Code
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.2em] text-brand-green sm:text-3xl">
              {sharePkg.code}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/70 group-hover:text-white">
              {copiedCode ? <FiCheck className="text-brand-green" /> : <FiCopy />}
              {copiedCode ? t('payment.codeCopied') : t('payment.copyCode')}
            </span>
          </button>

          {(sharePkg.teamAPhoneDisplay || sharePkg.teamAPhoneE164) && (
            <p className="text-center text-xs text-muted">
              Telefoonka lacag-bixiyaha:{' '}
              <span className="font-semibold text-charcoal dark:text-dark-text">
                {sharePkg.teamAPhoneE164 || sharePkg.teamAPhoneDisplay}
                {sharePkg.teamAPhoneLocal ? ` · ${sharePkg.teamAPhoneLocal}` : ''}
              </span>
            </p>
          )}

          <ol className="space-y-2 rounded-xl border border-brand-green/20 bg-white/70 p-4 text-sm dark:bg-dark-surface-2/60">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
              Tallaabooyinka Team B
            </p>
            {(sharePkg.steps || []).map((step, i) => (
              <li key={step} className="flex gap-3 text-charcoal dark:text-dark-text">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-xs font-bold text-brand-green">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<FiCopy />} onClick={copyShare}>
              {t('payment.copyShare')}
            </Button>
            <Button icon={<FiShare2 />} onClick={shareWhatsApp}>
              WhatsApp
            </Button>
          </div>
          <Button className="w-full" onClick={handleClose}>
            {t('payment.done')}
          </Button>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4 text-center py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
            <FiCheckCircle size={28} />
          </div>
          <p className="font-semibold">{t('payment.successTitle')}</p>
          <Button className="w-full" onClick={handleClose}>
            {t('payment.done')}
          </Button>
        </div>
      )}

      {phase === 'failed' && (
        <div className="space-y-4 text-center py-4">
          <FiAlertCircle className="mx-auto text-status-cancelled-text" size={36} />
          <p className="font-semibold">{t('payment.failedTitle')}</p>
          <p className="text-sm text-muted">{failReason || t('payment.failedGeneric')}</p>
          <Button
            className="w-full"
            onClick={() => {
              setPhase('form');
              setFailReason(null);
              setPaymentId(null);
            }}
          >
            {t('payment.tryAgain')}
          </Button>
        </div>
      )}
    </Modal>
  );
}

export { OPERATORS, SO_CARRIERS };
