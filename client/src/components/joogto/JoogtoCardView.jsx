import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiCalendar,
  FiClock,
  FiUser,
  FiPhone,
  FiShare2,
  FiPrinter,
  FiLock,
  FiEye,
  FiEyeOff,
  FiDollarSign,
} from 'react-icons/fi';
import Button from '../common/Button';

const DAY_NAMES = [
  'Axad (Sun)',
  'Isniin (Mon)',
  'Talaado (Tue)',
  'Arbaco (Wed)',
  'Khamiis (Thu)',
  'Jimce (Fri)',
  'Sabti (Sat)',
];

export default function JoogtoCardView({
  membership,
  onMarkPaid,
  showActions = true,
  isManager = false,
}) {
  const [showPin, setShowPin] = useState(false);

  if (!membership) return null;

  const {
    cardNumber,
    securityPin,
    qrSignature,
    teamName,
    captainName,
    captainPhone,
    stadium,
    field,
    dayOfWeek,
    additionalDays = [],
    startTimeLocal,
    endTimeLocal,
    monthlyFee,
    currency = 'USD',
    cardStatus = 'active',
    billingCycle = {},
    gracePeriodDays = 3,
  } = membership;

  const validUntil = billingCycle.endDate ? new Date(billingCycle.endDate) : null;
  const graceUntil = billingCycle.gracePeriodEndsAt ? new Date(billingCycle.gracePeriodEndsAt) : null;
  const now = new Date();

  // Days remaining calculation
  let daysRemaining = 0;
  if (validUntil) {
    daysRemaining = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Grace days remaining calculation
  let graceDaysRemaining = 0;
  if (graceUntil) {
    graceDaysRemaining = Math.max(0, Math.ceil((graceUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const allDays = [dayOfWeek, ...(additionalDays || [])]
    .map((d) => DAY_NAMES[d]?.split(' ')[0])
    .join(', ');

  const qrPayload = qrSignature || cardNumber;

  const handleShare = () => {
    const text = `Kaarka Joogtada ah: ${teamName}\nGaroonka: ${stadium?.name || ''}\nCard No: ${cardNumber}\nMaalmaha: ${allDays} (${startTimeLocal} - ${endTimeLocal})\nValid until: ${validUntil ? validUntil.toLocaleDateString() : 'N/A'}`;
    if (navigator.share) {
      navigator.share({ title: `Kaarka Joogtada - ${teamName}`, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      alert('Xogta kaarka waa la koobiyeeyay!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 p-6 text-white shadow-2xl transition-all">
      {/* Decorative Pitch Lines / Watermark */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10 opacity-40" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full border border-emerald-500/20 opacity-30" />

      {/* Header Row */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-emerald-300">
            E-GAROON VIP PASS
          </span>
          <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
            {stadium?.name || 'Garoonka Kubadda Cagta'}
          </h3>
          <p className="text-xs text-white/70">
            {field?.name ? `Qaybta: ${field.name}` : ''} {stadium?.location?.city ? `· ${stadium.location.city}` : ''}
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {cardStatus === 'active' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-200">
              <FiCheckCircle size={14} className="text-emerald-400" />
              FIRFIRCOON (ACTIVE)
            </span>
          )}
          {cardStatus === 'grace_period' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/30 px-3 py-1 text-xs font-bold text-amber-200 animate-pulse">
              <FiAlertTriangle size={14} className="text-amber-300" />
              MUDDO-DHAAF ({graceDaysRemaining} Maalmood Baa Hadhay)
            </span>
          )}
          {(cardStatus === 'expired' || cardStatus === 'blocked') && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-600/30 px-3 py-1 text-xs font-bold text-red-200">
              <FiXCircle size={14} className="text-red-400" />
              XIDHAN (EXPIRED / UNPAID)
            </span>
          )}
        </div>
      </div>

      {/* Body Section */}
      <div className="relative z-10 mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Kooxda Joogtada ah</p>
            <p className="font-display text-2xl font-bold tracking-wide text-emerald-400">{teamName}</p>
          </div>

          <div className="grid gap-2 text-xs text-white/85 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <FiUser className="text-emerald-400" size={14} />
              <span>Kabtanka: <strong>{captainName || '—'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FiPhone className="text-emerald-400" size={14} />
              <span>Tel: <strong>{captainPhone || '—'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-emerald-400" size={14} />
              <span>Maalmaha: <strong>{allDays}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FiClock className="text-emerald-400" size={14} />
              <span>Saacadda: <strong>{startTimeLocal} - {endTimeLocal}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/25 p-3 text-xs">
            <div>
              <p className="text-[10px] text-white/60 uppercase">Kaarka ID (Card No)</p>
              <p className="font-mono text-sm font-bold tracking-wider text-white">{cardNumber}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/60 uppercase">Security PIN</p>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300">
                <span>{showPin ? securityPin : '••••'}</span>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-white/60 hover:text-white"
                  title="Show/Hide PIN"
                >
                  {showPin ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/60 uppercase">Lacagta Bisha</p>
              <p className="text-sm font-bold text-emerald-300">
                ${monthlyFee} {currency !== 'USD' ? `(${currency})` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/60 uppercase">Dhicitaanka (Valid Until)</p>
              <p className="text-xs font-semibold text-white">
                {validUntil ? validUntil.toLocaleDateString() : 'N/A'}
                {cardStatus === 'active' && daysRemaining > 0 && (
                  <span className="ms-1 text-[11px] text-emerald-400">({daysRemaining}d hadhay)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code Container for Gate Scanning */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/20 bg-white p-3 text-slate-900 shadow-lg">
          <QRCodeSVG value={qrPayload} size={110} level="M" />
          <p className="mt-1.5 font-mono text-[9px] font-bold text-slate-600">Scan Gate Pass</p>
        </div>
      </div>

      {/* Action Footer */}
      {showActions && (
        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition-colors"
            >
              <FiShare2 size={13} />
              La wadaag Kabtanka
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition-colors"
            >
              <FiPrinter size={13} />
              Print Pass
            </button>
          </div>

          {onMarkPaid && isManager && (
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
              icon={<FiDollarSign />}
              onClick={() => onMarkPaid(membership)}
            >
              Xaqiiji Lacagta (Mark Paid / Renew 1 Month)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
