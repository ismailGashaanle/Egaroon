import toast from 'react-hot-toast';

const PREFIX = 'kul-match-web';
const timers = new Map();

function timerKey(bookingId) {
  return `${PREFIX}-${bookingId}`;
}

function beepTwice() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = (at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + at;
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    };
    play(0);
    play(0.45);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* ignore */
  }
}

function clearBookingTimers(bookingId) {
  const key = timerKey(bookingId);
  const list = timers.get(key) || [];
  list.forEach((id) => clearTimeout(id));
  timers.delete(key);
}

export function cancelWebMatchReminders(bookingId) {
  if (!bookingId) return;
  clearBookingTimers(bookingId);
}

async function ensureNotificationPermission({ silent }) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    if (!silent) {
      toast('Browser notifications lama heli karo — toast + sound waa la isticmaalayaa', {
        icon: 'ℹ️',
      });
    }
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    if (!silent) {
      toast.error('Ogeysiis waa la diiday — fur browser settings');
    }
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    if (result !== 'granted' && !silent) {
      toast('Ogeysiis lama oggolaan — xusuusin local sound/toast', { icon: 'ℹ️' });
    }
    return result === 'granted';
  } catch {
    if (!silent) toast.error('Notification permission way fashilantay');
    return false;
  }
}

function fireReminder({ title, body, notify }) {
  beepTwice();
  if (notify && Notification.permission === 'granted') {
    try {
      // eslint-disable-next-line no-new
      new Notification(title, { body, requireInteraction: true });
    } catch {
      /* ignore */
    }
  }
  toast(`${title}: ${body}`, { duration: 8000, icon: '🚨' });
}

/**
 * Browser timers for T-30m (2 pulses) + T-5m. Survives only while tab is open.
 */
export async function syncWebMatchReminders(booking, { silent = false } = {}) {
  const bookingId = booking?._id;
  if (!bookingId || !booking?.startTime) return { scheduled: false };

  if (['CANCELLED', 'EXPIRED', 'COMPLETED', 'SETTLED'].includes(booking.status)) {
    cancelWebMatchReminders(bookingId);
    return { scheduled: false, reason: 'terminal' };
  }

  const confirmed = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(booking.status);
  if (!confirmed) {
    cancelWebMatchReminders(bookingId);
    return { scheduled: false, reason: 'not_confirmed' };
  }

  const notify = await ensureNotificationPermission({ silent });
  clearBookingTimers(bookingId);

  const start = new Date(booking.startTime).getTime();
  const now = Date.now();
  const ids = [];

  const schedule = (offsetMs, fn) => {
    const when = start - offsetMs;
    const delay = when - now;
    if (delay <= 1500) return;
    ids.push(setTimeout(fn, delay));
  };

  const place = [booking.stadium?.name || booking.matchPass?.stadiumName, booking.field?.name || booking.matchPass?.fieldName]
    .filter(Boolean)
    .join(' · ');

  // T-30m pulse 1
  schedule(30 * 60 * 1000, () =>
    fireReminder({
      title: '30 daqiiqo — ciyaarta',
      body: `Diyaariso! ${place}. Tus Match Pass / QR.`,
      notify,
    })
  );
  // T-30m pulse 2 (~4s later)
  schedule(30 * 60 * 1000 - 4000, () =>
    fireReminder({
      title: '30 daqiiqo — xusuusin 2aad',
      body: place || 'Match Pass',
      notify,
    })
  );
  // T-5m
  schedule(5 * 60 * 1000, () =>
    fireReminder({
      title: 'Ciyaarta waa dhowdahay',
      body: 'Please be ready — tag albaabka / tus QR.',
      notify,
    })
  );

  if (!ids.length) {
    if (!silent) toast('Wakhtiga xusuusinta wuu dhaafay ama waa dhow', { icon: 'ℹ️' });
    return { scheduled: false, reason: 'past' };
  }

  timers.set(timerKey(bookingId), ids);
  if (!silent) toast.success('Xusuusin 30m + 5m waa la qorsheeyay (tab-ka furan)');
  return { scheduled: true };
}
