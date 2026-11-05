import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDownload,
  FiPrinter,
  FiAlertCircle,
  FiCheckCircle,
  FiCloud,
  FiBell,
  FiChevronDown,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import Button from '../common/Button';
import { uploadApi } from '../../api/uploadApi';
import { toastApiError } from '../../lib/support';
import { syncWebMatchReminders, cancelWebMatchReminders } from '../../lib/matchReminders';
import { buildMatchPassShareText, whatsAppShareUrl } from '../../lib/matchShare';
import toast from 'react-hot-toast';

function bookingCodeOf(booking) {
  return (
    booking.bookingCode ||
    booking.matchPass?.bookingCode ||
    `KUL-${String(booking._id).slice(-6).toUpperCase()}`
  );
}

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtSlot(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const t0 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const t1 = e ? e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return t1 ? `${day} · ${t0} – ${t1}` : `${day} · ${t0}`;
}

function sideFromBooking(booking, key) {
  const pass = booking.matchPass?.[key];
  if (pass) return pass;
  const party = booking[key];
  if (!party) return null;
  return {
    teamName: party.team?.name || (key === 'teamA' ? 'Team A' : 'Team B'),
    captainName: party.captain?.name,
    captainPhone: party.captain?.phone,
    payerPhoneDisplay:
      key === 'teamA' ? booking.teamAPayerPhoneDisplay || booking.teamAPayerPhone : null,
    paidAt: key === 'teamA' ? booking.teamAPaidAt : null,
    paymentMethodLabel: null,
    amountPaid: party.amountDue,
    paymentStatus: party.paymentStatus,
  };
}

function phoneOf(side) {
  if (!side) return null;
  return (
    side.payerPhoneDisplay ||
    side.payerPhone ||
    side.captainPhoneDisplay ||
    side.captainPhone ||
    null
  );
}

function isPaid(side) {
  if (!side) return false;
  if (side.coveredByTeamA) return true;
  if (side.paidAt) return true;
  const st = String(side.paymentStatus || '').toUpperCase();
  return st === 'PAID' || st === 'COVERED';
}

function TeamRow({ letter, side }) {
  const paid = isPaid(side);
  const phone = phoneOf(side);
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-green text-xs font-extrabold text-white">
        {letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-brand-navy dark:text-white">
          {side?.teamName || 'Weli ma jiro'}
        </p>
        {phone ? <p className="truncate text-xs text-muted">{phone}</p> : null}
      </div>
      {side ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            paid
              ? 'bg-brand-green/15 text-brand-green'
              : 'bg-brand-navy/5 text-muted dark:bg-white/10'
          }`}
        >
          {paid ? (side.coveredByTeamA ? 'Covered' : 'Paid') : '—'}
        </span>
      ) : null}
    </div>
  );
}

/** Compact PNG for gallery / share — navy header, QR, short team rows. */
function buildPassCanvas(booking, qrCanvas) {
  const pass = booking.matchPass || {};
  const start = pass.startTime || booking.startTime;
  const end = pass.endTime || booking.endTime;
  const bookingCode = bookingCodeOf(booking);
  const teamA = sideFromBooking(booking, 'teamA');
  const teamB = sideFromBooking(booking, 'teamB');
  const stadium = pass.stadiumName || booking.stadium?.name || '';
  const field = pass.fieldName || booking.field?.name || '';
  const place = [stadium, field].filter(Boolean).join(' · ');
  const slot = fmtSlot(start, end);

  const W = 560;
  const H = 520;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');

  // Card background
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  // Navy header
  ctx.fillStyle = '#1E2433';
  roundRect(ctx, 0, 0, W, 64, 24, true);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui,sans-serif';
  ctx.fillText('E-GAROON', 28, 40);
  // Green badge
  ctx.fillStyle = '#10B981';
  roundRect(ctx, W - 140, 18, 112, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui,sans-serif';
  ctx.fillText('MATCH PASS', W - 128, 37);

  ctx.fillStyle = '#1E2433';
  ctx.font = 'bold 18px system-ui,sans-serif';
  ctx.fillText(String(place).slice(0, 42), 28, 100);
  ctx.fillStyle = '#59635d';
  ctx.font = '14px system-ui,sans-serif';
  ctx.fillText(String(slot).slice(0, 48), 28, 124);

  // QR
  if (qrCanvas) {
    const qx = (W - 160) / 2;
    ctx.fillStyle = '#38BDF8';
    roundRect(ctx, qx - 6, 142, 172, 172, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    roundRect(ctx, qx, 148, 160, 160, 10);
    ctx.fill();
    ctx.drawImage(qrCanvas, qx + 10, 158, 140, 140);
  }

  ctx.fillStyle = '#1E2433';
  ctx.font = 'bold 18px ui-monospace,monospace';
  const codeW = ctx.measureText(bookingCode).width;
  ctx.fillText(bookingCode, (W - codeW) / 2, 350);
  ctx.fillStyle = '#59635d';
  ctx.font = '12px system-ui,sans-serif';
  const hint = 'Tus albaabka · scan QR';
  ctx.fillText(hint, (W - ctx.measureText(hint).width) / 2, 370);

  // Team rows
  drawTeamRow(ctx, 28, 392, 'A', teamA);
  ctx.strokeStyle = 'rgba(30,36,51,0.12)';
  ctx.beginPath();
  ctx.moveTo(66, 440);
  ctx.lineTo(W - 28, 440);
  ctx.stroke();
  drawTeamRow(ctx, 28, 452, 'B', teamB);

  // Green border
  ctx.strokeStyle = 'rgba(16,185,129,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 24);
  ctx.stroke();

  return out;
}

function drawTeamRow(ctx, x, y, letter, side) {
  ctx.fillStyle = '#10B981';
  roundRect(ctx, x, y, 28, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui,sans-serif';
  ctx.fillText(letter, x + 9, y + 19);

  ctx.fillStyle = '#1E2433';
  ctx.font = 'bold 14px system-ui,sans-serif';
  ctx.fillText(String(side?.teamName || 'Weli ma jiro').slice(0, 26), x + 40, y + 13);
  const phone = phoneOf(side);
  if (phone) {
    ctx.fillStyle = '#59635d';
    ctx.font = '12px system-ui,sans-serif';
    ctx.fillText(String(phone).slice(0, 28), x + 40, y + 28);
  }

  const paid = isPaid(side);
  const label = paid ? (side?.coveredByTeamA ? 'Covered' : 'Paid') : '—';
  ctx.fillStyle = paid ? 'rgba(16,185,129,0.15)' : 'rgba(30,36,51,0.06)';
  const bw = paid ? 58 : 28;
  roundRect(ctx, 560 - 28 - bw, y + 4, bw, 22, 11);
  ctx.fill();
  ctx.fillStyle = paid ? '#10B981' : '#59635d';
  ctx.font = 'bold 11px system-ui,sans-serif';
  ctx.fillText(label, 560 - 28 - bw + 8, y + 19);
}

/** roundRect with optional top-only corners for header strip */
function roundRect(ctx, x, y, w, h, r, topOnly = false) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (topOnly) {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + w, y, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export default function MatchPass({ booking, showActions = true }) {
  const passRef = useRef(null);
  const [cloudUrl, setCloudUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sharingWa, setSharingWa] = useState(false);

  const pass = booking.matchPass || {};
  const start = pass.startTime || booking.startTime;
  const end = pass.endTime || booking.endTime;
  const bookingCode = bookingCodeOf(booking);
  const qrValue = pass.qrPayload || booking.qrPayload || bookingCode;
  const validUntil = booking.qrValidUntil ? new Date(booking.qrValidUntil) : end ? new Date(end) : null;
  const expired = booking.qrValidNow === false && validUntil && new Date() > validUntil;
  const gateDone = Boolean(booking.gateCheckedInAt);
  const teamA = sideFromBooking(booking, 'teamA');
  const teamB = sideFromBooking(booking, 'teamB');
  const stadium = pass.stadiumName || booking.stadium?.name;
  const field = pass.fieldName || booking.field?.name;
  const slotLabel = fmtSlot(start, end);

  const shareText = buildMatchPassShareText({
    stadiumName: stadium,
    fieldName: field,
    slotLabel,
    bookingCode,
    teamAName: teamA?.teamName,
    teamBName: teamB?.teamName,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (['CANCELLED', 'EXPIRED'].includes(booking.status)) {
        cancelWebMatchReminders(booking._id);
        if (alive) setRemindersOn(false);
        return;
      }
      const ok = await syncWebMatchReminders(booking, { silent: true });
      if (alive) setRemindersOn(Boolean(ok?.scheduled));
    })();
    return () => {
      alive = false;
    };
  }, [booking._id, booking.status, booking.startTime]);

  const getPassCanvas = () => {
    const qrCanvas = passRef.current?.querySelector('canvas');
    if (!qrCanvas) return null;
    return buildPassCanvas(booking, qrCanvas);
  };

  const downloadPng = () => {
    const out = getPassCanvas();
    if (!out) return;
    const link = document.createElement('a');
    link.download = `${bookingCode}-match-pass.png`;
    link.href = out.toDataURL('image/png');
    link.click();
    toast.success('Match Pass PNG waa la soo dejiyay');
  };

  const shareWhatsApp = async () => {
    setSharingWa(true);
    try {
      const out = getPassCanvas();
      if (out && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const blob = await canvasToBlob(out);
        if (blob) {
          const file = new File([blob], `${bookingCode}-match-pass.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'E-Garoon Match Pass',
              text: shareText,
            });
            toast.success('Door WhatsApp si aad u dirto sawirka');
            return;
          }
        }
      }
      // Fallback: open WhatsApp with short Somali text
      window.open(whatsAppShareUrl(shareText), '_blank', 'noopener,noreferrer');
      toast('Text WhatsApp — sawirka Keydi gallery ka dib ku dheji');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      window.open(whatsAppShareUrl(shareText), '_blank', 'noopener,noreferrer');
    } finally {
      setSharingWa(false);
    }
  };

  const saveToCloudinary = async () => {
    const out = getPassCanvas();
    if (!out) return;
    setUploading(true);
    try {
      const dataUri = out.toDataURL('image/png');
      const { data } = await uploadApi.uploadDataUri(dataUri, {
        folder: 'receipts',
        resourceType: 'image',
        publicId: `pass-${bookingCode}`,
      });
      setCloudUrl(data.data.upload.url);
      toast.success('Receipt / QR saved to Cloudinary');
    } catch (err) {
      toastApiError(err, 'Could not upload receipt');
    } finally {
      setUploading(false);
    }
  };

  const enableReminders = async () => {
    const result = await syncWebMatchReminders(booking, { silent: false });
    setRemindersOn(Boolean(result?.scheduled));
  };

  const printPass = () => {
    const w = window.open('', '_blank', 'width=480,height=720');
    if (!w) return;
    w.document.write(`
      <html><head><title>${bookingCode}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;background:#f5f5f2;color:#1E2433}
        .card{max-width:400px;margin:0 auto;background:#fff;border:2px solid rgba(16,185,129,.35);border-radius:16px;overflow:hidden}
        .head{background:#1E2433;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
        .badge{background:#10B981;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:800}
        .body{padding:20px}
        .place{font-weight:700;font-size:16px}
        .when{color:#59635d;font-size:13px;margin-top:2px}
        .code{font-family:monospace;font-weight:700;margin-top:16px;text-align:center}
        .row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #eee}
        .letter{width:28px;height:28px;border-radius:8px;background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}
        @media print{body{background:#fff}}
      </style></head><body onload="window.print();setTimeout(()=>window.close(),400)">
      <div class="card">
        <div class="head"><span>E-GAROON</span><span class="badge">MATCH PASS</span></div>
        <div class="body">
          <div class="place">${stadium || ''} ${field ? `· ${field}` : ''}</div>
          <div class="when">${slotLabel}</div>
          <div class="code">${bookingCode}</div>
          <div class="row"><span class="letter">A</span><div><strong>${teamA?.teamName || '—'}</strong><br/>${phoneOf(teamA) || ''}</div></div>
          <div class="row"><span class="letter">B</span><div><strong>${teamB?.teamName || '—'}</strong><br/>${phoneOf(teamB) || ''}</div></div>
          <p style="font-size:11px;color:#59635d;margin-top:12px;text-align:center">Tus albaabka. Manager-ku wuxuu scan-garaacaa QR-kan.</p>
        </div>
      </div></body></html>
    `);
    w.document.close();
  };

  return (
    <div>
      <motion.div
        ref={passRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border-2 border-brand-green/30 bg-white shadow-card dark:bg-dark-surface"
      >
        <div className="flex items-center justify-between bg-brand-navy px-4 py-3 text-white">
          <span className="text-xs font-extrabold tracking-[0.12em]">E-GAROON</span>
          <span className="rounded-full bg-brand-green px-2.5 py-1 text-[10px] font-extrabold tracking-wide">
            {expired ? 'EXPIRED' : gateDone ? 'GATE OK' : 'MATCH PASS'}
          </span>
        </div>

        <div className="px-4 pb-4 pt-3">
          <p className="truncate font-display text-base font-bold text-brand-navy dark:text-white">
            {[stadium, field].filter(Boolean).join(' · ') || 'Garoon'}
          </p>
          <p className="truncate text-xs text-muted">{slotLabel}</p>

          <div className="mt-3 flex flex-col items-center">
            <div
              className={`rounded-xl border-2 border-brand-blue bg-white p-2 ${expired ? 'opacity-40' : ''}`}
            >
              <QRCodeCanvas value={String(qrValue)} size={128} fgColor="#1E2433" />
            </div>
            <p className="mt-2 font-mono text-sm font-bold tracking-wide text-brand-navy dark:text-white">
              {bookingCode}
            </p>
            <p className="text-[11px] text-muted">Tus albaabka · scan QR</p>
          </div>

          <div className="mt-3 divide-y divide-brand-navy/10 rounded-xl bg-brand-navy/[0.04] px-2 dark:bg-white/5 dark:divide-white/10">
            <TeamRow letter="A" side={teamA} />
            <TeamRow letter="B" side={teamB} />
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-xs font-semibold text-muted hover:text-brand-navy dark:hover:text-white"
      >
        Faafaahin
        <FiChevronDown
          className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {detailsOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 space-y-2 rounded-xl bg-surface-inset p-3 text-sm dark:bg-dark-surface-2">
              <p>
                <span className="text-xs text-muted">Booking</span>
                <br />
                <span className="font-semibold">{fmtWhen(pass.bookedAt || booking.createdAt)}</span>
              </p>
              {booking.matchCode ? (
                <p>
                  <span className="text-xs text-muted">Match code</span>
                  <br />
                  <span className="font-mono font-semibold">{booking.matchCode}</span>
                </p>
              ) : null}
              <p>
                <span className="text-xs text-muted">Team A lacag (Receipt)</span>
                <br />
                <span className="font-semibold">
                  {[
                    teamA?.paymentMethodLabel || teamA?.paymentMethod,
                    teamA?.amountPaid != null
                      ? teamA.currency === 'SLL'
                        ? `${Number(teamA.amountSll || teamA.amountPaid).toLocaleString()} SlSh${teamA.amountUsd ? ` ($${Number(teamA.amountUsd).toFixed(2)})` : ''}`
                        : `$${Number(teamA.amountPaid).toFixed(2)} USD`
                      : null,
                    teamA?.exchangeRate && teamA.currency === 'SLL'
                      ? `Sarifka: $1 = ${Number(teamA.exchangeRate).toLocaleString()} SlSh`
                      : null,
                    teamA?.paidAt ? fmtWhen(teamA.paidAt) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </p>
              <p>
                <span className="text-xs text-muted">Team B lacag (Receipt)</span>
                <br />
                <span className="font-semibold">
                  {teamB?.coveredByTeamA
                    ? 'Team A ayaa dhammaan bixiyay'
                    : [
                        teamB?.paymentMethodLabel || teamB?.paymentMethod,
                        teamB?.amountPaid != null
                          ? teamB.currency === 'SLL'
                            ? `${Number(teamB.amountSll || teamB.amountPaid).toLocaleString()} SlSh${teamB.amountUsd ? ` ($${Number(teamB.amountUsd).toFixed(2)})` : ''}`
                            : `$${Number(teamB.amountPaid).toFixed(2)} USD`
                          : null,
                        teamB?.exchangeRate && teamB.currency === 'SLL'
                          ? `Sarifka: $1 = ${Number(teamB.exchangeRate).toLocaleString()} SlSh`
                          : null,
                        teamB?.paidAt ? fmtWhen(teamB.paidAt) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || (teamB ? '—' : 'Weli ma jiro')}
                </span>
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {expired && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-status-cancelled-text">
          <FiAlertCircle /> QR expired with this time slot. Ask the manager only during kickoff window.
        </p>
      )}
      {gateDone && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-status-confirmed-text">
          <FiCheckCircle /> Manager verified at gate {new Date(booking.gateCheckedInAt).toLocaleString()}
        </p>
      )}

      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<FiDownload />} onClick={downloadPng}>
            Keydi gallery
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<FaWhatsapp />}
            loading={sharingWa}
            onClick={shareWhatsApp}
            className="!bg-[#25D366] hover:!opacity-90"
          >
            WhatsApp
          </Button>
          <Button size="sm" variant="outline" icon={<FiPrinter />} onClick={printPass}>
            Print
          </Button>
          <Button size="sm" variant="outline" icon={<FiCloud />} loading={uploading} onClick={saveToCloudinary}>
            Cloud
          </Button>
          <Button size="sm" variant="outline" icon={<FiBell />} onClick={enableReminders}>
            {remindersOn ? 'Xusuusin ✓' : 'Xusuusin'}
          </Button>
        </div>
      )}

      {cloudUrl && (
        <p className="mt-2 truncate text-xs text-muted">
          Cloud URL:{' '}
          <a href={cloudUrl} target="_blank" rel="noreferrer" className="text-forest underline">
            {cloudUrl}
          </a>
        </p>
      )}
    </div>
  );
}
