import { formatSlotTime } from './dateUtils';

/** Parse match-pass QR / manual code into API payload fields. */
export function parseGateScanInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'joogto_card' || parsed.cardNumber || parsed.qrSignature || parsed.token) {
        return {
          isJoogto: true,
          cardNumber: parsed.cardNumber ? String(parsed.cardNumber).trim().toUpperCase() : undefined,
          qrToken: parsed.token || parsed.qrSignature || trimmed,
          pin: parsed.pin ? String(parsed.pin).trim() : undefined,
          stadiumId: parsed.stadiumId,
          qrPayload: trimmed,
        };
      }
      const code = parsed.code || parsed.bookingCode;
      if (code) {
        return {
          bookingCode: String(code).trim().toUpperCase(),
          qrPayload: trimmed,
        };
      }
    } catch {
      /* fall through */
    }
    return { qrPayload: trimmed };
  }

  if (trimmed.toUpperCase().startsWith('JG-')) {
    return {
      isJoogto: true,
      cardNumber: trimmed.toUpperCase(),
      bookingCode: trimmed.toUpperCase(),
    };
  }

  return { bookingCode: trimmed.toUpperCase() };
}

export function formatSlotRange(startTime, endTime) {
  if (!startTime) return '—';
  try {
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return String(startTime);
    const day = start.toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const t0 = formatSlotTime(startTime);
    const t1 = endTime ? formatSlotTime(endTime) : '';
    return t1 ? `${day} · ${t0} – ${t1}` : `${day} · ${t0}`;
  } catch {
    return String(startTime);
  }
}

export function formatMoney(amount, currency = 'USD') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const cur = String(currency || 'USD').toUpperCase();
  if (cur === 'SLL' || cur === 'SLSH') {
    return `${Number(amount || 0).toLocaleString()} SlSh`;
  }
  return `$${Number(amount || 0).toFixed(2)}`;
}

export function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

/** Seconds remaining until an ISO timestamp (0 if past). */
export function secondsUntil(iso, nowMs = Date.now()) {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}

/** Format countdown as H:MM:SS or M:SS. */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

/** Prefer API time fields; fall back to gateSummary. */
export function pickGateTime(result) {
  const s = result?.gateSummary || {};
  return {
    timeState: result?.timeState || s.timeState || 'ok',
    canStart: result?.canStart ?? s.canStart ?? true,
    startsAt: result?.startsAt || s.startsAt || s.startTime,
    endsAt: result?.endsAt || s.endsAt || s.endTime,
    secondsUntilStart: result?.secondsUntilStart ?? s.secondsUntilStart ?? 0,
    secondsUntilEnd: result?.secondsUntilEnd ?? s.secondsUntilEnd ?? 0,
    messageEn: result?.messageEn || s.messageEn || '',
    messageSo: result?.messageSo || s.messageSo || '',
  };
}
