import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiCreditCard,
  FiMaximize,
  FiSlash,
  FiLock,
  FiCheckCircle,
  FiAlertCircle,
  FiGift,
  FiCalendar,
  FiClock,
  FiRefreshCw,
  FiArrowRight,
} from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Textarea from '../components/common/Textarea';
import { FullPageSpinner } from '../components/common/Spinner';
import MatchPass from '../components/booking/MatchPass';
import BookingStepper from '../components/booking/BookingStepper';
import HoldCountdown from '../components/booking/HoldCountdown';
import LineupBuilder from '../components/booking/LineupBuilder';
import PaymentModal from '../components/booking/PaymentModal';
import PricingBreakdown from '../components/booking/PricingBreakdown';
import MatchCodePanel from '../components/booking/MatchCodePanel';
import { MatchPaymentProgress } from '../components/booking/MatchPaymentProgress';
import clsx from 'clsx';
import { bookingApi } from '../api/bookingApi';
import { fieldApi } from '../api/stadiumApi';
import { giftApi } from '../api/giftApi';
import { useAuth } from '../hooks/useAuth';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { toastApiError } from '../lib/support';
import { matchPaymentProgress } from '../lib/matchJoinErrors';
import { wallClockHHMM, formatLabel } from '../lib/slotUtils';
import SomaliPhoneInput, { composedPhone } from '../components/common/SomaliPhoneInput';
import { useTranslation } from '../i18n/LanguageContext';

function errMsg(err, fallback) {
  return err.response?.data?.error?.message || err.message || fallback;
}

function isPaid(party) {
  return ['SUCCESS', 'HELD', 'SETTLED'].includes(party?.paymentStatus);
}

function formatVenueDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return (
      d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Mogadishu',
      }) + ' (GMT+3 / EAT)'
    );
  } catch {
    return new Date(iso).toLocaleString() + ' (GMT+3)';
  }
}

function PartyCard({ label, party, isMe, onOpenPay, waitingLabel, t }) {
  if (!party) {
    return (
      <Card className="p-5">
        <p className="text-overline text-muted dark:text-dark-muted">{label}</p>
        <p className="mt-3 text-sm text-disabled">{waitingLabel || t('booking.notInvited')}</p>
      </Card>
    );
  }

  const paid = isPaid(party);
  const due = Number(party.amountDue || 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-overline text-muted dark:text-dark-muted">{label}</p>
        <Badge status={party.paymentStatus} />
      </div>
      <p className="mt-2 font-display text-lg font-bold text-charcoal dark:text-dark-text">
        {party.team?.name || 'Team'}
      </p>
      <p className="mt-1 text-sm text-muted dark:text-dark-muted">
        {party.playersCount} {t('booking.players')} · {t('booking.share')} ${due.toFixed(2)}
      </p>

      {isMe && !paid && due > 0 && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl surface-inset p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted dark:text-dark-muted">{t('payment.yourShareDue')}</span>
              <span className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">
                ${due.toFixed(2)}
              </span>
            </div>
          </div>
          <Button className="w-full" size="lg" icon={<FiCreditCard />} onClick={onOpenPay}>
            {t('booking.payMyShare')} ${due.toFixed(2)}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-disabled">
            <FiLock size={12} /> {t('payment.secureNote')}
          </p>
        </div>
      )}
      {paid && (
        <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-status-confirmed-text">
          <FiCheckCircle />{' '}
          {due === 0 ? t('payment.coveredByTeamA') : t('payment.received')}
        </p>
      )}
    </Card>
  );
}

export default function BookingDetails() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { lineupEnabled, giftEnabled } = useAuthFeatures();
  const { t } = useTranslation();

  const [booking, setBooking] = useState(null);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCarrier, setInviteCarrier] = useState('telesom');
  const [inviteLocal, setInviteLocal] = useState('7000001');
  const [inviting, setInviting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paySide, setPaySide] = useState('teamA');
  const [payFull, setPayFull] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Reschedule & Change request states
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false);
  const [reschedulePickerOpen, setReschedulePickerOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState('Cancelled by captain');

  const load = useCallback(async () => {
    try {
      const [{ data }, crRes] = await Promise.all([
        bookingApi.get(bookingId),
        bookingApi.getChangeRequests(bookingId).catch(() => ({ data: { data: { requests: [] } } })),
      ]);
      setBooking(data.data.booking);
      setChangeRequests(crRes.data?.data?.requests || []);
    } catch (err) {
      toast.error(errMsg(err, t('booking.loadFail')));
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Hold / join deep-link: ?pay=1 opens PaymentModal (never auto-initiate).
  useEffect(() => {
    if (!booking || searchParams.get('pay') !== '1') return;
    const side = searchParams.get('side') === 'teamB' ? 'teamB' : 'teamA';
    setPaySide(side);
    setPayFull(searchParams.get('full') === '1');
    setPayOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('pay');
    next.delete('side');
    next.delete('full');
    setSearchParams(next, { replace: true });
  }, [booking, searchParams, setSearchParams]);

  useEffect(() => {
    const due = booking?.holdExpiresAt || booking?.teamBPaymentDueAt;
    if (!due || !['HELD', 'PAYMENT_PENDING'].includes(booking.status)) return undefined;
    const ms = new Date(due) - Date.now() + 2000;
    if (ms <= 0) return undefined;
    const timer = setTimeout(() => load(), Math.min(ms, 60_000));
    return () => clearTimeout(timer);
  }, [booking?.holdExpiresAt, booking?.teamBPaymentDueAt, booking?.status, load]);

  if (loading) return <FullPageSpinner />;
  if (!booking) {
    return (
      <PageTransition>
        <Card className="p-8 text-center">
          <FiAlertCircle className="mx-auto text-status-cancelled-text" size={28} />
          <p className="mt-3 font-semibold">{t('booking.notFound')}</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/app/bookings')}>
            {t('common.back')}
          </Button>
        </Card>
      </PageTransition>
    );
  }

  const isTeamACaptain =
    booking.teamA?.captain === user?.id || booking.teamA?.captain?._id === user?.id;
  const isTeamBCaptain =
    booking.teamB?.captain === user?.id || booking.teamB?.captain?._id === user?.id;

  const total = Number(booking.pricing?.totalPrice || 0);
  const teamShare = Number(booking.pricing?.teamShare ?? total / 2);
  const teamAPaid = isPaid(booking.teamA);
  const teamBPaid = booking.teamB ? isPaid(booking.teamB) : false;
  const coveredFull = Boolean(booking.coveredFullMatch);
  const paymentProgress = matchPaymentProgress(booking);

  const openPay = (side, full = false) => {
    setPaySide(side);
    setPayFull(full);
    setPayOpen(true);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const phone = composedPhone(inviteCarrier, inviteLocal);
    if (!phone) return toast.error(t('payment.phoneMismatch'));
    setInviting(true);
    try {
      const { data } = await bookingApi.inviteTeamB(booking._id, { phone });
      const who = data.data.invitedCaptain;
      toast.success(
        who
          ? t('booking.invitedWho', { name: who.name })
          : t('booking.teamBInvited')
      );
      setInviteOpen(false);
      load();
    } catch (err) {
      toastApiError(err, t('booking.inviteFail'));
    } finally {
      setInviting(false);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await bookingApi.checkIn(booking._id);
      toast.success(t('booking.checkedIn'));
      load();
    } catch (err) {
      toast.error(errMsg(err, t('booking.checkInFail')));
    } finally {
      setCheckingIn(false);
    }
  };

  const getTodayYMD = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const getTomorrowYMD = () => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getDayAfterTomorrowYMD = () => {
    const d = new Date(Date.now() + 86400000 * 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadSlotsForDate = async (fieldId, dateStr) => {
    if (!fieldId || !dateStr) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await fieldApi.listSlots(fieldId, dateStr);
      setAvailableSlots(res.data?.data?.slots || res.data?.slots || []);
    } catch (err) {
      toastApiError(err, 'Waa lagu fashilmay soo raridda boosaska');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (newDate) => {
    setRescheduleDate(newDate);
    const fId = booking?.field?._id || booking?.field;
    loadSlotsForDate(fId, newDate);
  };

  const openSlotPicker = () => {
    const initialDate = rescheduleDate || getTodayYMD();
    setRescheduleDate(initialDate);
    const fId = booking?.field?._id || booking?.field;
    loadSlotsForDate(fId, initialDate);
    setReschedulePickerOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedSlot) {
      toast.error('Fadlan dooro waqti banaan');
      return;
    }
    setRescheduling(true);
    try {
      const fId = booking.field?._id || booking.field;
      const { data } = await bookingApi.requestReschedule(booking._id, {
        proposedDate: rescheduleDate,
        proposedStartTime: selectedSlot.startTime,
        proposedEndTime: selectedSlot.endTime,
        proposedFieldId: fId,
        reason: rescheduleReason.trim() || 'Codsi beddelka waqtiga',
      });
      toast.success(data.data?.message || 'Codsiga beddelka waqtiga waa la gudbiyay');
      setReschedulePickerOpen(false);
      setSelectedSlot(null);
      setRescheduleReason('');
      load();
    } catch (err) {
      toastApiError(err, 'Codsigii beddelka wuu fashilmay');
    } finally {
      setRescheduling(false);
    }
  };

  const handleRespondChangeRequest = async (requestId, action, reason) => {
    setRespondingId(requestId);
    try {
      await bookingApi.respondChangeRequest(requestId, { action, reason });
      toast.success(
        action === 'ACCEPT'
          ? 'Waqtiga cusub waa la aqbalay — ballanku si toos ah ayuu u wareegay!'
          : 'Codsiga waqtiga cusub waa la diiday'
      );
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectRequestId(null);
      load();
    } catch (err) {
      toastApiError(err, 'Hawlgalku wuu fashilmay');
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancelWithPolicy = async (requestFullRefund = false) => {
    setCancelling(true);
    try {
      const { data } = await bookingApi.cancelWithPolicy(booking._id, {
        reason: cancelReasonText || 'Cancelled by captain',
        requestFullRefund,
      });
      toast.success(data.data?.message || t('booking.cancelled'));
      setCancelModalOpen(false);
      load();
    } catch (err) {
      toastApiError(err, t('booking.cancelFail'));
    } finally {
      setCancelling(false);
    }
  };

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error('Enter your free-match voucher code');
      return;
    }
    setRedeeming(true);
    try {
      const { data } = await giftApi.redeemOnBooking(booking._id, voucherCode.trim());
      toast.success(data.data.message || 'Voucher applied — booking confirmed free');
      setVoucherCode('');
      load();
    } catch (err) {
      toastApiError(err, 'Could not redeem voucher');
    } finally {
      setRedeeming(false);
    }
  };

  const canCancel = !['CANCELLED', 'EXPIRED', 'SETTLED', 'COMPLETED'].includes(booking.status);
  const canCheckIn = ['CONFIRMED', 'CHECKED_IN'].includes(booking.status);
  const showMatchPass = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'SETTLED'].includes(
    booking.status
  );
  const canLineup = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status);
  const mySide = isTeamACaptain ? 'teamA' : isTeamBCaptain ? 'teamB' : null;
  const holdActive =
    ['HELD', 'PAYMENT_PENDING'].includes(booking.status) &&
    (booking.holdExpiresAt || booking.teamBPaymentDueAt);

  const pendingChangeRequest = changeRequests.find((r) => r.status === 'PENDING');
  const canReschedule =
    ['CONFIRMED', 'HELD', 'PAYMENT_PENDING'].includes(booking.status) &&
    (isTeamACaptain || isTeamBCaptain) &&
    !pendingChangeRequest;

  return (
    <PageTransition>
      <PageHeader
        title={`${booking.field?.name} — ${booking.stadium?.name}`}
        description={`${formatVenueDateTime(booking.startTime)}`}
        breadcrumbs={[{ label: t('nav.bookings'), to: '/app/bookings' }, { label: t('booking.details') }]}
        actions={<Badge status={booking.status} className="text-sm" />}
      />

      {pendingChangeRequest && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm dark:border-amber-600 dark:bg-amber-950/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="warning">CODSI BEDDELKII WAQTIGA</Badge>
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {pendingChangeRequest.requestedBy === 'STADIUM_OWNER'
                    ? 'Mulkiilaha Garoonka'
                    : 'Kabtanka Kooxda'}
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-amber-950 dark:text-amber-100">
                {pendingChangeRequest.requestedBy === 'STADIUM_OWNER'
                  ? 'Mulkiilaha garoonka ayaa soo jeediyay waqti cusub oo ciyaarta loo wareejiyo'
                  : 'Waxaa jira codsi sugaya beddelka waqtiga ciyaarta'}
              </h3>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                <strong>Sababta:</strong> {pendingChangeRequest.reason || 'Ma jiro sharaxaad dheeraad ah'}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-800 dark:bg-dark-surface/80">
                  <span className="text-xs font-semibold uppercase text-muted">Waqtigii Hore</span>
                  <p className="mt-1 font-semibold text-charcoal dark:text-dark-text">
                    {formatVenueDateTime(pendingChangeRequest.currentSlot?.startTime)}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-3">
                  <span className="text-xs font-semibold uppercase text-brand-green">Waqtiga Cusub Ee La Soo Jeediyay</span>
                  <p className="mt-1 font-bold text-brand-green-dark">
                    {formatVenueDateTime(pendingChangeRequest.proposedSlot?.startTime)}
                  </p>
                </div>
              </div>

              {pendingChangeRequest.requestedBy === 'STADIUM_OWNER' && (
                <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                  💡 <em>Xasuusin:</em> Ballankaagu ma wareegayo ilaa aad adigu aqbasho. Haddii aad diiddo, waqtigii hore ayaa ahaanaya. Haddii aad rabto inaad ka noqoto maadaama garoonku beddelay waqtiga, waxaad xaq u leedahay <strong>100% soo celin buuxda</strong>.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              size="sm"
              loading={respondingId === pendingChangeRequest._id}
              onClick={() => handleRespondChangeRequest(pendingChangeRequest._id, 'ACCEPT')}
            >
              Aqbal Waqtiga Cusub (Accept)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={respondingId === pendingChangeRequest._id}
              onClick={() => {
                setRejectRequestId(pendingChangeRequest._id);
                setRejectModalOpen(true);
              }}
            >
              Diid (Reject)
            </Button>
            {pendingChangeRequest.requestedBy === 'STADIUM_OWNER' && (
              <Button
                size="sm"
                variant="danger"
                loading={cancelling}
                onClick={() => {
                  setCancelReasonText('Mulkiilaha garoonka ayaa beddelay waqtiga');
                  handleCancelWithPolicy(true);
                }}
              >
                Kansal & 100% Soo Celi Lacagta
              </Button>
            )}
          </div>
        </motion.div>
      )}

      <Card className="mb-6 p-6">
        <BookingStepper status={booking.status} />
      </Card>

      <Card className="mb-6 p-5">
        <p className="text-overline text-muted">{t('booking.costSplit')}</p>
        <div className="mt-3 max-w-md space-y-4 rounded-xl bg-warmwhite p-4 dark:bg-dark-surface">
          <MatchPaymentProgress progress={paymentProgress} />
          <PricingBreakdown
            pricing={booking.pricing}
            t={t}
            ns="booking"
            coverFullMatch={coveredFull}
          />
        </div>
        {coveredFull && (
          <p className="mt-2 text-xs font-medium text-status-confirmed-text">
            {t('payment.fullMatchHint')}
          </p>
        )}
      </Card>

      {giftEnabled &&
        isTeamACaptain &&
        ['HELD', 'PAYMENT_PENDING'].includes(booking.status) &&
        !teamAPaid && (
        <Card className="mb-6 p-5">
          <div className="flex items-center gap-2">
            <FiGift className="text-brand-green" />
            <p className="font-semibold">Redeem free-match voucher</p>
          </div>
          <p className="mt-1 text-xs text-muted">
            Applies 100% off this booking (stadium must match campaign city/region). Confirms at $0.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Input
              label="Voucher code"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="FREE-XXXX-XXXX"
              className="min-w-[200px] flex-1"
            />
            <Button icon={<FiGift />} loading={redeeming} onClick={handleRedeemVoucher}>
              Redeem
            </Button>
          </div>
        </Card>
      )}

      {booking.status === 'EXPIRED' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex items-start gap-2 rounded-xl bg-status-cancelled-bg px-4 py-3 text-sm text-status-cancelled-text"
        >
          <FiAlertCircle className="mt-0.5 shrink-0" />
          {booking.cancelReason === 'team_b_payment_timeout' || booking.teamA?.paymentStatus === 'REFUNDED'
            ? t('booking.holdExpiredRefunded')
            : t('booking.holdExpired')}
        </motion.div>
      )}

      {holdActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 rounded-xl bg-status-pending-bg px-4 py-3"
        >
          <HoldCountdown
            expiresAt={booking.holdExpiresAt || booking.teamBPaymentDueAt}
            onExpired={load}
            showPayHint={false}
          />
          <p className="mt-1 text-xs text-status-pending-text">
            {teamAPaid && booking.matchCode && !teamBPaid
              ? 'Match Code window — Team B waa inuu bixiyo (demand-based, ma noqdo cancel toos ah 12 daq).'
              : teamAPaid && !booking.teamB
                ? t('booking.inviteTeamBNow')
                : teamAPaid && booking.teamB && !teamBPaid
                  ? t('booking.waitTeamBPay', {
                      time: new Date(
                        booking.teamBPaymentDueAt || booking.holdExpiresAt
                      ).toLocaleString(),
                    })
                  : t('booking.payBeforeTimer')}
          </p>
        </motion.div>
      )}

      {teamAPaid && !coveredFull && booking.matchCode && !teamBPaid && (
        <MatchCodePanel booking={booking} onExpired={load} onUpdated={load} />
      )}

      {booking.status === 'EXPIRED' && booking.teamACredit?.status && booking.teamACredit.status !== 'NONE' && (
        <div className="mb-6 rounded-xl bg-status-pending-bg px-4 py-3 text-sm text-status-pending-text">
          Team A funds: <strong>{booking.teamACredit.status}</strong> · $
          {Number(booking.teamACredit.amount || 0).toFixed(2)}
          {booking.teamACredit.reason ? ` (${booking.teamACredit.reason})` : ''}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <PartyCard
            label={t('booking.teamAPays')}
            party={booking.teamA}
            isMe={isTeamACaptain}
            t={t}
            onOpenPay={() => openPay('teamA', false)}
          />
          {isTeamACaptain &&
            !teamAPaid &&
            !coveredFull &&
            ['HELD', 'PAYMENT_PENDING'].includes(booking.status) && (
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => openPay('teamA', true)}
              >
                {t('booking.payFull')} ${total.toFixed(2)}
              </Button>
            )}
        </div>

        {booking.teamB ? (
          <PartyCard
            label={t('booking.teamBPays')}
            party={booking.teamB}
            isMe={isTeamBCaptain}
            t={t}
            onOpenPay={() => openPay('teamB', false)}
          />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-overline text-muted">{t('booking.teamBPays')}</p>
            <p className="text-sm text-disabled">
              {coveredFull
                ? t('booking.fullPaidInvite')
                : teamAPaid
                  ? 'Share Match Code ama casuum telefoon'
                  : t('booking.payThenInvite')}
            </p>
            {isTeamACaptain && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  icon={<FiUsers />}
                  onClick={() => setInviteOpen(true)}
                  disabled={!teamAPaid && !coveredFull}
                >
                  {t('booking.inviteByPhone')}
                </Button>
              </div>
            )}
            {!isTeamACaptain && (
              <Button size="sm" variant="outline" onClick={() => navigate('/app/join-match')}>
                Dhammee lacagta
              </Button>
            )}
          </Card>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {canCheckIn && (
          <Button icon={<FiMaximize />} loading={checkingIn} onClick={handleCheckIn}>
            {t('booking.checkIn')}
          </Button>
        )}
        {canReschedule && (
          <Button
            variant="outline"
            icon={<FiClock className="text-brand-green" />}
            onClick={() => setRescheduleConfirmOpen(true)}
          >
            Ii beddel waqtiga
          </Button>
        )}
        {canCancel && (
          <Button
            variant="danger"
            icon={<FiSlash />}
            loading={cancelling}
            onClick={() => setCancelModalOpen(true)}
          >
            {t('booking.cancel')}
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate('/app/bookings')}>
          {t('booking.backToBookings')}
        </Button>
      </div>

      {showMatchPass && (
        <Card className="mt-8 max-w-md p-6">
          <CardHeader>
            <CardTitle>{t('booking.receipt')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted">{t('booking.receiptHint')}</p>
            <MatchPass booking={booking} />
          </CardContent>
        </Card>
      )}

      {(isTeamACaptain || isTeamBCaptain) && lineupEnabled && (
        <LineupBuilder booking={booking} unlocked={canLineup} teamSide={mySide || 'teamA'} />
      )}

      {/* Step 1: Confirmation Prompt Modal */}
      <Modal
        open={rescheduleConfirmOpen}
        onClose={() => setRescheduleConfirmOpen(false)}
        title="Xaqiijinta Beddelka Waqtiga (Confirm Reschedule)"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
            <FiAlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Ma xaqiijinaysaa inaad rabto inaad beddesho waqtiga ballankaaga?</p>
              <p className="text-xs opacity-80 mt-1">
                Do you want to change your time slot? Haddii aad sii wadato waxaad dooranaysaa maalin iyo saacad kale oo banaan.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-warmwhite p-3.5 text-xs text-muted space-y-2 dark:bg-dark-surface dark:border-dark-border">
            <p className="font-semibold text-charcoal dark:text-dark-text">Faahfaahinta Waqtiga Hadda:</p>
            <div className="flex justify-between border-b border-border/40 pb-1.5 dark:border-dark-border/40">
              <span>🏟️ Garoonka:</span>
              <span className="font-medium text-charcoal dark:text-dark-text">{booking.stadium?.name} · {booking.field?.name}</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5 dark:border-dark-border/40">
              <span>⏰ Waqtiga hadda:</span>
              <span className="font-medium text-charcoal dark:text-dark-text">
                {booking.startTime ? new Date(booking.startTime).toLocaleDateString() : ''} · {wallClockHHMM(booking.startTime) ? formatLabel(wallClockHHMM(booking.startTime)) : ''} (GMT+3)
              </span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>💡 Xeerka beddelka:</span>
              <span className="font-medium text-brand-green">Beddelka &gt; 24 saac ka hor waa bilaash ($0)</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50 dark:border-dark-border/50">
            <Button
              variant="outline"
              type="button"
              onClick={() => setRescheduleConfirmOpen(false)}
            >
              Maya, ka noqo (No, go back)
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                setRescheduleConfirmOpen(false);
                openSlotPicker();
              }}
            >
              Haa, ii beddel (Yes, proceed)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Step 2 & 3: Date & Available Slot Selector Modal */}
      <Modal
        open={reschedulePickerOpen}
        onClose={() => setReschedulePickerOpen(false)}
        title="Dooro Maalin & Waqti Cusub (Select Date & Time)"
        size="lg"
      >
        <div className="space-y-4">
          {/* 1. Date Picker */}
          <div>
            <label className="text-xs font-semibold uppercase text-muted mb-1 block">
              1. Dooro Maalinta Aad Rabto (Pick Date)
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleDateChange(getTodayYMD())}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  rescheduleDate === getTodayYMD()
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-border bg-white hover:border-brand-green/40 dark:bg-dark-surface dark:border-dark-border'
                )}
              >
                Maanta (Today)
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(getTomorrowYMD())}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  rescheduleDate === getTomorrowYMD()
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-border bg-white hover:border-brand-green/40 dark:bg-dark-surface dark:border-dark-border'
                )}
              >
                Berri (Tomorrow)
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(getDayAfterTomorrowYMD())}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  rescheduleDate === getDayAfterTomorrowYMD()
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-border bg-white hover:border-brand-green/40 dark:bg-dark-surface dark:border-dark-border'
                )}
              >
                Saadambe
              </button>
            </div>
            <Input
              type="date"
              value={rescheduleDate}
              min={getTodayYMD()}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
          </div>

          {/* 2. Available Slots Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-muted">
                2. Dooro Saacadda Banaan (Pick Slot — GMT+3 / EAT)
              </label>
              <span className="text-[11px] text-muted">Aagga waqtiga: Bariga Afrika (GMT+3)</span>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-sm text-muted">
                <FullPageSpinner />
                <p className="mt-2 text-xs">Waxaa la soo rarayaa boosaska banaan...</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted dark:border-dark-border">
                Ma jiraan boosas ciyaareed oo la heli karo maalintan. Fadlan dooro maalin kale.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                {availableSlots.map((s) => {
                  const isAvail = s.state === 'available';
                  const isSelected = selectedSlot?.startTime === s.startTime;
                  const time12 = formatLabel(s.startLabel);

                  return (
                    <button
                      key={s.startTime}
                      type="button"
                      disabled={!isAvail}
                      onClick={() => setSelectedSlot(s)}
                      className={clsx(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-all',
                        isSelected
                          ? 'border-brand-green bg-brand-green/10 text-brand-green font-bold shadow-sm ring-2 ring-brand-green/30'
                          : isAvail
                            ? 'border-border bg-white hover:border-brand-green text-charcoal dark:bg-dark-surface dark:border-dark-border dark:text-dark-text'
                            : 'border-border/40 bg-black/[0.03] text-disabled cursor-not-allowed dark:bg-white/[0.03]'
                      )}
                    >
                      <span className="font-semibold tabular-nums">{s.startLabel} – {s.endLabel}</span>
                      <span className="text-[11px] opacity-80">{time12} (GMT+3)</span>
                      <span
                        className={clsx(
                          'mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          isSelected
                            ? 'bg-brand-green text-white'
                            : isAvail
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-black/5 text-disabled dark:bg-white/5'
                        )}
                      >
                        {isSelected ? '✓ La Doortay' : isAvail ? 'Banaan' : (s.labelSo || 'La qabsaday')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Selected Slot Summary & Reason */}
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 rounded-xl border border-brand-green/20 bg-brand-green/[0.04] p-3 text-xs dark:border-brand-green/30 dark:bg-brand-green/10"
            >
              <div className="flex justify-between items-center">
                <span className="text-muted">Waqtiga Cusub Ee La Doortay:</span>
                <span className="font-bold text-brand-green tabular-nums">
                  {rescheduleDate} · {selectedSlot.startLabel} – {selectedSlot.endLabel} ({formatLabel(selectedSlot.startLabel)} GMT+3)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Kharashka Beddelka:</span>
                <span className="font-semibold text-charcoal dark:text-dark-text">$0.00 (Bilaash)</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Sababta Aad U Beddelayso (Ikhtiyaari):
                </label>
                <Textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Tusaale: Howl degdeg ah oo ciyaartoyda qaar soo gashay..."
                  className="mt-1"
                />
              </div>
            </motion.div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50 dark:border-dark-border/50">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setReschedulePickerOpen(false);
                setRescheduleConfirmOpen(true);
              }}
            >
              Dib u noqo (Back)
            </Button>
            <Button
              variant="primary"
              disabled={!selectedSlot}
              loading={rescheduling}
              onClick={handleRescheduleSubmit}
            >
              Xaqiiji & Gudbi Codsiga
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Change Request Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Diid Waqtiga Cusub Ee La Soo Jeediyay"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Haddii aad diiddo waqtigan, ballankaagu wuxuu ku sii jirayaa waqtigii hore ee la ballamay.
          </p>
          <div>
            <label className="text-xs font-semibold text-muted">Sababta aad u diidayso (ikhtiyaari)</label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Waqtigan nooma habboona..."
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Ka noqo
            </Button>
            <Button
              variant="danger"
              loading={respondingId === rejectRequestId}
              onClick={() => handleRespondChangeRequest(rejectRequestId, 'REJECT', rejectReason)}
            >
              Xaqiiji Diidmada
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel with Policy Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Kansal Ballanka Ciyaarta"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-semibold">Xeerka Kansalaashada & Lacag-celinta:</p>
            <p className="mt-1">
              Lacagtaada waxaa loo celin doonaa sida waafaqsan xeerka garoonka (Policy):
              Kansalaashada waqtigeeda &gt; 24 saac waxay xaq u leedahay 100% lacag-celin buuxda.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted">Sababta Kansalaashada</label>
            <Textarea
              rows={3}
              value={cancelReasonText}
              onChange={(e) => setCancelReasonText(e.target.value)}
              placeholder="Sababta aad u kansalayso ballanka..."
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Ha kansalin
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={() => handleCancelWithPolicy(false)}
            >
              Haa, Kansal Ballanka
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('booking.inviteTitle')}>
        <form onSubmit={handleInvite} className="space-y-4">
          <SomaliPhoneInput
            label={t('booking.opponentPhone')}
            carrierId={inviteCarrier}
            onCarrierChange={setInviteCarrier}
            localNumber={inviteLocal}
            onLocalNumberChange={setInviteLocal}
            required
            hint={t('booking.inviteHint')}
          />
          <p className="text-xs text-muted">
            {coveredFull
              ? t('booking.fullPaidInvite')
              : t('booking.invitePayNote', { amount: `$${teamShare.toFixed(2)}` })}
          </p>
          <Button type="submit" className="w-full" loading={inviting}>
            {t('booking.sendInvite')}
          </Button>
        </form>
      </Modal>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        booking={booking}
        side={paySide}
        coverFullMatch={payFull}
        defaultPhone={user?.phone}
        defaultName={user?.name}
        onPaid={() => {
          load();
        }}
      />
    </PageTransition>
  );
}
