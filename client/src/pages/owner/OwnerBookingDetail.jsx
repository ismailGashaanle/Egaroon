import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheck, FiMaximize, FiArrowLeft, FiRefreshCw, FiClock } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import { FullPageSpinner } from '../../components/common/Spinner';
import { ownerApi, bookingApi } from '../../api/bookingApi';
import { useTranslation } from '../../i18n/LanguageContext';

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

function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0 dark:border-dark-border/60">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-charcoal dark:text-dark-text">{value}</span>
    </div>
  );
}

export default function OwnerBookingDetail() {
  const { bookingId } = useParams();
  const { t } = useTranslation();
  const [booking, setBooking] = useState(null);
  const [card, setCard] = useState(null);
  const [gate, setGate] = useState(null);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // Propose Reschedule states
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('20:00');
  const [rescheduleEnd, setRescheduleEnd] = useState('21:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const load = async () => {
    try {
      const [{ data }, crRes] = await Promise.all([
        ownerApi.getBooking(bookingId),
        bookingApi.getChangeRequests(bookingId).catch(() => ({ data: { data: { requests: [] } } })),
      ]);
      setBooking(data.data.booking);
      setCard(data.data.detailCard);
      setGate(data.data.gateSummary);
      setChangeRequests(crRes.data?.data?.requests || []);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.bookingsLoadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const stadiumId = String(booking?.stadium?._id || booking?.stadium || card?.stadiumId || '');

  const handleAccept = async () => {
    setBusy('accept');
    try {
      const { data } = await ownerApi.acceptBooking(bookingId);
      toast.success(data.data.alreadyAccepted ? t('owner.alreadyAccepted') : t('owner.acceptSuccess'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.acceptFail'));
    } finally {
      setBusy(null);
    }
  };

  const handleGate = async () => {
    if (!stadiumId) return toast.error(t('owner.pickStadiumFirst'));
    setBusy('gate');
    try {
      const { data } = await ownerApi.gateCheckIn({
        stadiumId,
        bookingCode: booking.bookingCode || card?.bookingCode,
      });
      toast.success(
        data.data.alreadyCheckedIn ? t('owner.alreadyCheckedIn') : `${t('owner.gateOk')} · ${data.data.booking?.status}`
      );
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.checkInFail'));
    } finally {
      setBusy(null);
    }
  };

  const handleProposeReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      toast.error('Fadlan dooro taariikhda iyo saacadaha la soo jeedinayo');
      return;
    }
    setSubmittingReschedule(true);
    try {
      const { data } = await bookingApi.requestReschedule(bookingId, {
        proposedDate: rescheduleDate,
        proposedStartTime: rescheduleStart,
        proposedEndTime: rescheduleEnd,
        reason: rescheduleReason.trim() || 'Soo jeedin ka timid mulkiilaha garoonka',
      });
      toast.success(data.data?.message || 'Codsiga beddelka waqtiga waa loo diray kabtanka');
      setRescheduleOpen(false);
      setRescheduleReason('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Soo jeedinta beddelku way fashilantay');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!booking) return null;

  const start = formatVenueDateTime(booking.startTime);
  const end = new Date(booking.endTime).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Mogadishu',
  });

  const pendingChangeRequest = changeRequests.find((r) => r.status === 'PENDING');
  const canProposeReschedule =
    ['CONFIRMED', 'HELD', 'PAYMENT_PENDING'].includes(booking.status) && !pendingChangeRequest;

  return (
    <PageTransition>
      <PageHeader
        title={booking.bookingCode || t('owner.bookingDetail')}
        description={`${booking.stadium?.name || ''} · ${booking.field?.name || ''}`}
        breadcrumbs={[
          { label: t('owner.navHome'), to: '/owner' },
          { label: t('owner.navGate'), to: '/owner/bookings' },
          { label: booking.bookingCode || t('owner.bookingDetail') },
        ]}
        actions={
          <Button as={Link} to="/owner/bookings" size="sm" variant="outline" icon={<FiArrowLeft />}>
            {t('common.back')}
          </Button>
        }
      />

      {pendingChangeRequest && (
        <div className="mb-5 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm dark:border-amber-600 dark:bg-amber-950/40">
          <div className="flex items-center gap-2">
            <Badge variant="warning">CODSI BEDDELKII WAQTIGA</Badge>
            <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              {pendingChangeRequest.requestedBy === 'STADIUM_OWNER'
                ? 'Waxaad soo jeedisay waqti cusub (waxay sugaysaa kabtanka)'
                : 'Kabtanka ayaa codsaday beddelka waqtiga'}
            </span>
          </div>
          <p className="mt-2 text-sm text-amber-950 dark:text-amber-100">
            <strong>Sababta:</strong> {pendingChangeRequest.reason || '—'}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-white/80 p-2.5 border border-amber-200 dark:bg-dark-surface/80 dark:border-amber-800">
              <span className="font-semibold text-muted">Waqtigii Hore:</span>
              <p className="mt-0.5 font-bold text-charcoal dark:text-dark-text">
                {formatVenueDateTime(pendingChangeRequest.currentSlot?.startTime)}
              </p>
            </div>
            <div className="rounded-lg bg-brand-green/10 p-2.5 border border-brand-green/30">
              <span className="font-semibold text-brand-green">Waqtiga Cusub Ee La Soo Jeediyay:</span>
              <p className="mt-0.5 font-bold text-brand-green-dark">
                {formatVenueDateTime(pendingChangeRequest.proposedSlot?.startTime)}
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-amber-800 dark:text-amber-300">
            Xaaladda: <strong>{pendingChangeRequest.status}</strong> — Ballanka lama beddelayo ilaa kabtanka kooxdu aqbalo.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge status={booking.status}>{booking.status}</Badge>
            {booking.needsOwnerAccept && <Badge variant="warning">{t('owner.needsAccept')}</Badge>}
            {card?.walkIn && <Badge variant="info">{t('owner.walkInBadge')}</Badge>}
            {(booking.gateCheckedInAt || card?.gateCheckedInAt) && (
              <Badge variant="success">{t('owner.gateOk')}</Badge>
            )}
          </div>

          <Row label={t('owner.when')} value={`${start} – ${end}`} />
          <Row label={t('owner.filterStadium')} value={booking.stadium?.name} />
          <Row label={t('owner.field')} value={booking.field?.name} />
          <Row
            label={t('owner.teams')}
            value={`${booking.teamA?.team?.name || card?.captainName || 'Team A'}${
              booking.teamB?.team?.name ? ` vs ${booking.teamB.team.name}` : ''
            }`}
          />
          <Row label={t('owner.walkInCaptain')} value={card?.captainName || booking.teamA?.captain?.name} />
          <Row label={t('owner.walkInPhone')} value={card?.captainPhone || booking.teamA?.captain?.phone} />
          <Row label={t('owner.paymentMethod')} value={card?.paymentMethodLabel || card?.paymentMethod} />
          <Row
            label={t('owner.amountPaid')}
            value={card?.amountPaid != null ? `$${Number(card.amountPaid).toFixed(2)}` : null}
          />
          <Row
            label={t('owner.feeTotal')}
            value={booking.pricing?.totalPrice != null ? `$${Number(booking.pricing.totalPrice).toFixed(2)}` : null}
          />
          <Row
            label={t('owner.payout')}
            value={booking.ownerPayoutAmount != null ? `$${Number(booking.ownerPayoutAmount).toFixed(2)}` : null}
          />
          <Row label={t('owner.reference')} value={card?.reference || card?.tixraac} />
          {gate?.messageEn && <p className="mt-3 text-sm text-muted">{gate.messageEn}</p>}
        </Card>

        <Card className="space-y-3 p-5">
          <CardTitle>{t('owner.actions')}</CardTitle>
          {booking.needsOwnerAccept && (
            <Button className="w-full" icon={<FiCheck />} loading={busy === 'accept'} onClick={handleAccept}>
              {t('owner.acceptBtn')}
            </Button>
          )}
          <Button
            className="w-full"
            variant="outline"
            icon={<FiMaximize />}
            loading={busy === 'gate'}
            onClick={handleGate}
          >
            {t('owner.verifyStart')}
          </Button>

          {canProposeReschedule && (
            <Button
              className="w-full"
              variant="outline"
              icon={<FiRefreshCw />}
              onClick={() => {
                const d = new Date(booking.startTime);
                setRescheduleDate(d.toISOString().slice(0, 10));
                setRescheduleOpen(true);
              }}
            >
              Soo jeedi Waqti Cusub
            </Button>
          )}

          <Button as={Link} to={`/owner/slots?stadiumId=${stadiumId}`} variant="ghost" className="w-full">
            {t('owner.navSlots')}
          </Button>
        </Card>
      </div>

      {/* Propose Reschedule Modal */}
      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Soo jeedi Waqti Cusub (Propose Reschedule)"
      >
        <form onSubmit={handleProposeReschedule} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-bold">Xeerka Badbaadada Kabtanka:</p>
            <p className="mt-1">
              Ballanka lama beddeli doono ilaa kabtanka kooxdu aqbalo waqtigan cusub. Haddii kabtanku diido, waqtigii hore ayuu ahaanayaa, ama wuxuu xaq u leeyahay 100% lacag-celin buuxda haddii aadan garoonka siin karin.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted">Taariikhda La Soo Jeedinayo</label>
            <Input
              type="date"
              value={rescheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setRescheduleDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted">Saacadda Bilowga (GMT+3)</label>
              <Input
                type="time"
                value={rescheduleStart}
                onChange={(e) => setRescheduleStart(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">Saacadda Dhammaadka (GMT+3)</label>
              <Input
                type="time"
                value={rescheduleEnd}
                onChange={(e) => setRescheduleEnd(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted">Sababta Aad U Soo Jeedinayso Beddelka</label>
            <Textarea
              rows={3}
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="Tusaale: Cilad koronto oo degdeg ah ama dayactir garoonka..."
              required
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setRescheduleOpen(false)}>
              Ka noqo
            </Button>
            <Button type="submit" loading={submittingReschedule}>
              Dir Soo Jeedinta
            </Button>
          </div>
        </form>
      </Modal>
    </PageTransition>
  );
}
