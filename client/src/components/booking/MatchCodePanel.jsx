import { useState } from 'react';
import { FiCopy, FiCheck, FiClock, FiShare2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import HoldCountdown from './HoldCountdown';
import SomaliPhoneInput, { composedPhone } from '../common/SomaliPhoneInput';
import { bookingApi } from '../../api/bookingApi';
import { formatPhoneDisplay, formatSharePhone } from '../../lib/somaliPhone';
import {
  buildMatchSharePackage,
  resolveTeamAShareName,
  whatsAppShareUrl,
} from '../../lib/matchShare';
import { toastApiError } from '../../lib/support';

const PHASE_LABEL = {
  PRIORITY: 'Mudnaanta Team B',
  GRACE: 'Kordhin (grace)',
  FINAL_GRACE: 'Daqiiqado ugu dambeeya',
  CLOSED: 'Xidhan',
};

/**
 * After Team A split pay: Match Code + Copy + WhatsApp + optional invite phone lock.
 */
export default function MatchCodePanel({ booking, onExpired, onUpdated }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteCarrier, setInviteCarrier] = useState('hormuud');
  const [inviteLocal, setInviteLocal] = useState('');
  const [locking, setLocking] = useState(false);

  const code = booking?.matchCode;
  const win = booking?.opponentWindowPublic || booking?.opponentWindow || {};
  const expiresAt =
    win.finalGraceEndsAt ||
    booking?.teamBPaymentDueAt ||
    booking?.holdExpiresAt ||
    win.priorityEndsAt;
  const messageSo =
    booking?.messageSo ||
    win.messageSo ||
    'Waad bixisay lacagta teamkaaga. Waxaan sugaynaa Team B inuu lacagta ku bixiyo…';

  const sharePhone =
    formatSharePhone(booking?.teamAPayerPhone) ||
    (booking?.teamAPayerPhoneE164 || booking?.teamAPayerPhoneLocal
      ? {
          e164: booking.teamAPayerPhoneE164,
          local0: booking.teamAPayerPhoneLocal,
          display: booking.teamAPayerPhoneDisplay,
        }
      : null) ||
    formatSharePhone(booking?.teamA?.captain?.phone);

  const teamAPhoneDisplay =
    sharePhone?.display ||
    booking?.teamAPayerPhoneDisplay ||
    (booking?.teamAPayerPhone ? formatPhoneDisplay(booking.teamAPayerPhone) : null) ||
    (booking?.teamA?.captain?.phone ? formatPhoneDisplay(booking.teamA.captain.phone) : null);

  if (!code || booking?.coveredFullMatch) return null;
  if (!['PAYMENT_PENDING', 'HELD'].includes(booking?.status)) return null;

  const sharePkg = buildMatchSharePackage({
    code,
    teamAPhone:
      sharePhone?.e164 ||
      booking?.teamAPayerPhoneE164 ||
      booking?.teamAPayerPhone ||
      booking?.teamA?.captain?.phone,
    teamAName: resolveTeamAShareName(booking),
  });
  const shareText = sharePkg?.text || code;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(sharePkg?.code || code);
      setCopiedCode(true);
      toast.success('Match Code waa la copy-gareeyay');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Copy ma suurtogelin');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Match Code + tilmaamaha la copy-gareeyay');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy ma suurtogelin');
    }
  };

  const shareWhatsApp = () => {
    window.open(whatsAppShareUrl(shareText), '_blank', 'noopener,noreferrer');
  };

  const lockInvite = async () => {
    const phone = composedPhone(inviteCarrier, inviteLocal);
    if (!phone) {
      toast.error('Geli telefoon sax ah (Team B)');
      return;
    }
    setLocking(true);
    try {
      await bookingApi.lockInvitePhone(booking._id, { invitePhone: phone });
      toast.success('Telefoonka Team B waa la xidhay — kaliya isaga ayaa ku biiri kara');
      onUpdated?.();
    } catch (err) {
      toastApiError(err, 'Xidhitaanka telefoonka wuu fashilmay');
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand-green/30 bg-gradient-to-b from-brand-green/[0.08] via-warmwhite to-warmwhite shadow-soft dark:from-brand-green/15 dark:via-dark-surface dark:to-dark-surface">
      <div className="bg-brand-gradient px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
          E-Garoon · Match Code
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">{messageSo}</p>
      </div>

      <div className="space-y-4 p-5">
        {sharePkg?.teamAName ? (
          <p className="text-sm text-muted">
            Kooxda:{' '}
            <span className="font-semibold text-charcoal dark:text-dark-text">
              {sharePkg.teamAName}
            </span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={copyCode}
          className="group w-full rounded-2xl border-2 border-brand-green/35 bg-brand-navy px-4 py-4 text-center transition hover:border-brand-green focus-ring"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Match Code · riix si aad u copy-gareyso
          </p>
          <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.2em] text-brand-green">
            {code}
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/70">
            {copiedCode ? <FiCheck className="text-brand-green" /> : <FiCopy />}
            {copiedCode ? 'Copied' : 'Copy code'}
          </span>
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-green/30 bg-white px-3 py-2.5 text-sm font-medium text-brand-green hover:bg-brand-green/5 dark:border-brand-green/40 dark:bg-dark-surface-2"
          >
            {copied ? <FiCheck /> : <FiCopy />}
            {copied ? 'Copied' : 'Copy tilmaamaha'}
          </button>
          <button
            type="button"
            onClick={shareWhatsApp}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#1fb85a]"
          >
            <FiShare2 />
            WhatsApp
          </button>
        </div>

        <ol className="space-y-2 rounded-xl border border-brand-green/15 bg-white/70 p-4 text-sm dark:bg-dark-surface-2/50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
            Tallaabooyinka Team B
          </p>
          {(sharePkg?.steps || []).map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-xs font-bold text-brand-green">
                {i + 1}
              </span>
              <span className="pt-0.5 text-charcoal dark:text-dark-text">{step}</span>
            </li>
          ))}
        </ol>

        {teamAPhoneDisplay && (
          <p className="text-xs text-muted">
            Telefoonka lacag-bixiyaha (Team A):{' '}
            <span className="font-semibold text-charcoal dark:text-dark-text">
              {sharePhone?.e164 || teamAPhoneDisplay}
              {sharePhone?.local0 ? ` · ${sharePhone.local0}` : ''}
            </span>
          </p>
        )}

        <p className="text-xs text-muted">
          Code kaliya kuma filna — Match Code + telefoonka Team A (anti-scam). Ha dirin OTP /
          password.
        </p>

        {!booking?.teamB && (
          <div className="space-y-2 border-t border-border/60 pt-4 dark:border-dark-border">
            <p className="text-xs font-medium text-charcoal dark:text-dark-text">
              Ikhtiyaari: xidhi telefoonka Team B (kaliya isaga ayaa ku biiri kara)
            </p>
            {booking?.invitePhoneLocked || booking?.invitePhone ? (
              <p className="text-xs text-brand-green">
                Locked:{' '}
                {booking.invitePhoneDisplay ||
                  formatPhoneDisplay(booking.invitePhone) ||
                  'Team B phone'}
              </p>
            ) : (
              <>
                <SomaliPhoneInput
                  label="Telefoonka Team B"
                  carrierId={inviteCarrier}
                  onCarrierChange={setInviteCarrier}
                  localNumber={inviteLocal}
                  onLocalNumberChange={setInviteLocal}
                  hint="Marka la xidho, joiner account phone waa inuu la mid yahay"
                />
                <button
                  type="button"
                  disabled={locking}
                  onClick={lockInvite}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-dark-border dark:hover:bg-dark-elevated"
                >
                  {locking ? '…' : 'Xidh telefoonka Team B'}
                </button>
              </>
            )}
          </div>
        )}

        {win.phase && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-status-pending-text">
            <FiClock />
            {PHASE_LABEL[win.phase] || win.phase}
            {win.graceExtensionsUsed > 0 ? ` · extensions ${win.graceExtensionsUsed}` : ''}
            {win.competingAttemptCount > 0 ? ` · demand ${win.competingAttemptCount}` : ''}
          </p>
        )}
        {expiresAt && (
          <div>
            <HoldCountdown expiresAt={expiresAt} onExpired={onExpired} showPayHint={false} />
          </div>
        )}
        {booking?.teamACredit?.status && booking.teamACredit.status !== 'NONE' && (
          <p className="text-xs text-muted">
            Team A credit: {booking.teamACredit.status} · $
            {Number(booking.teamACredit.amount || 0).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
