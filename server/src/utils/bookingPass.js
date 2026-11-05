const crypto = require('crypto');

/** Minutes before kickoff when gate QR becomes valid (players arrive early). */
const EARLY_MINUTES = 120;
/** Minutes before kickoff when staff may press “start game” (waiting OK). */
const EARLY_START_MINUTES = 10;

function generateBookingCode() {
  const part = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `KUL-${part}`;
}

/** QR / gate valid from EARLY_MINUTES before kickoff until slot end. */
function qrValidityWindow(booking) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const validFrom = new Date(start.getTime() - EARLY_MINUTES * 60 * 1000);
  return { validFrom, validUntil: end, start, end };
}

function isQrValidNow(booking, now = new Date()) {
  const { validFrom, validUntil } = qrValidityWindow(booking);
  return now >= validFrom && now <= validUntil;
}

function qrWindowStatus(booking, now = new Date()) {
  const window = qrValidityWindow(booking);
  if (now < window.validFrom) {
    return { ok: false, reason: 'too_early', ...window };
  }
  if (now > window.validUntil) {
    return { ok: false, reason: 'expired', ...window };
  }
  return { ok: true, reason: null, ...window };
}

function formatLocal(dt) {
  try {
    return new Date(dt).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dt);
  }
}

/**
 * Gate start window vs the booked hour (startTime–endTime).
 * - too_early: now < start − earlyStartMinutes → cannot start (other hour/day)
 * - ok: within early window or on time within grace
 * - late: past grace but still ≤ end → start still allowed (advisory)
 * - expired: now > end → cannot start
 */
function slotTimeState(booking, now = new Date(), graceMinutes = 15, earlyStartMinutes = EARLY_START_MINUTES) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();
  const earlyMs = Math.max(0, Number(earlyStartMinutes) || 0) * 60 * 1000;
  const openFromMs = startMs - earlyMs;
  const secondsUntilStart = Math.max(0, Math.ceil((startMs - nowMs) / 1000));
  const secondsUntilEnd = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
  const minutesLate = Math.max(0, Math.floor((nowMs - startMs) / 60000));

  let timeState;
  let canStart;
  if (nowMs < openFromMs) {
    timeState = 'too_early';
    canStart = false;
  } else if (nowMs > endMs) {
    timeState = 'expired';
    canStart = false;
  } else if (nowMs < startMs) {
    // Few minutes early — waiting, but start allowed
    timeState = 'ok';
    canStart = true;
  } else if (minutesLate > graceMinutes) {
    timeState = 'late';
    canStart = true;
  } else {
    timeState = 'ok';
    canStart = true;
  }

  const startLabel = formatLocal(start);
  const messages = {
    ok: {
      en:
        nowMs < startMs
          ? `Slot opens soon — starts at ${startLabel}. You can start.`
          : 'Time slot matches — you can start the game.',
      so:
        nowMs < startMs
          ? `Wakhtigu wuu dhow yahay — ${startLabel}. Waad bilaabi kartaa.`
          : 'Wakhtiga waa sax — waad bilaabi kartaa ciyaarta.',
    },
    too_early: {
      en: `Not this slot yet. Your time starts at ${startLabel}. You cannot start outside the booked hour.`,
      so: `Ma bilaabi kartid — maaha wakhtigan. Wakhtigaagu wuxuu bilaabmaa ${startLabel}`,
    },
    late: {
      en: `Team is late (${minutesLate} min past start). Start still allowed until slot ends.`,
      so: `Kooxdu way daahday (${minutesLate} daqiiqo). Wali waad bilaabi kartaa ilaa wakhtiga dhamaadka.`,
    },
    expired: {
      en: 'Your time slot expired — you cannot start outside the booked hour.',
      so: 'Wakhtigagii aad ciyaari lahaydeen wuu dhacay — ma bilaabi kartid.',
    },
  };

  return {
    timeState,
    canStart,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    secondsUntilStart,
    secondsUntilEnd,
    minutesLate,
    graceMinutes,
    earlyStartMinutes,
    messageEn: messages[timeState].en,
    messageSo: messages[timeState].so,
  };
}

function buildQrPayload(booking) {
  const { validUntil } = qrValidityWindow(booking);
  return JSON.stringify({
    v: 1,
    code: booking.bookingCode,
    bookingId: String(booking._id),
    expiresAt: validUntil.toISOString(),
  });
}

module.exports = {
  EARLY_MINUTES,
  EARLY_START_MINUTES,
  generateBookingCode,
  qrValidityWindow,
  isQrValidNow,
  qrWindowStatus,
  slotTimeState,
  formatLocal,
  buildQrPayload,
};
