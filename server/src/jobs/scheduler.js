const bookingService = require('../services/booking.service');
const paymentService = require('../services/payment.service');
const lineupService = require('../services/lineup.service');
const Booking = require('../models/Booking');
const Stadium = require('../models/Stadium');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { emitFieldUpdate } = require('../sockets');
const { getBusiness } = require('../services/platformSettings.service');

const INTERVAL_MS = 60 * 1000; // every minute
/** Sweep stale lineups every 5 minutes (BR-007d). */
const LINEUP_CLEANUP_EVERY_MS = 5 * 60 * 1000;
/** Refresh tracked-city play-risk weather (BR-009e). */
const WEATHER_REFRESH_EVERY_MS = 30 * 60 * 1000;

let lastLineupCleanupAt = 0;
let lastWeatherRefreshAt = 0;

async function advanceMatchLifecycle() {
  const now = new Date();

  // CONFIRMED / CHECKED_IN past start → IN_PROGRESS
  const toStart = await Booking.find({
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
    startTime: { $lte: now },
    endTime: { $gt: now },
  });
  for (const booking of toStart) {
    booking.status = BOOKING_STATUS.IN_PROGRESS;
    await booking.save();
    emitFieldUpdate(booking.field.toString(), 'booking:updated', { bookingId: booking._id, status: booking.status });
    try {
      const { notifyMatchStarted } = require('../services/notification.service');
      const stadium = await Stadium.findById(booking.stadium).select('name');
      await notifyMatchStarted({
        stadiumId: booking.stadium,
        bookingId: booking._id,
        stadiumName: stadium?.name,
      });
    } catch (err) {
      console.warn('[jobs] match-started notify failed', booking._id.toString(), err.message);
    }
  }

  // Past endTime → COMPLETED (then settlement after stadium payout policy)
  const toComplete = await Booking.find({
    status: { $in: [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CONFIRMED] },
    endTime: { $lte: now },
  });
  for (const booking of toComplete) {
    booking.status = BOOKING_STATUS.COMPLETED;
    await booking.save();
    emitFieldUpdate(booking.field.toString(), 'booking:updated', { bookingId: booking._id, status: booking.status });
    // BR-007d: hard-delete lineups as soon as match ends
    try {
      const { deletedCount } = await lineupService.deleteLineupsForBooking(booking._id);
      if (deletedCount) {
        console.log(`[jobs] deleted ${deletedCount} lineup(s) for completed booking ${booking._id}`);
      }
    } catch (err) {
      console.warn('[jobs] lineup delete on COMPLETED failed', booking._id.toString(), err.message);
    }
  }

  // COMPLETED + per-stadium delay → SETTLED
  const completed = await Booking.find({ status: BOOKING_STATUS.COMPLETED })
    .select('_id field stadium endTime')
    .limit(200);

  if (completed.length) {
    const stadiumIds = [...new Set(completed.map((b) => String(b.stadium)))];
    const stadiums = await Stadium.find({ _id: { $in: stadiumIds } }).select('payoutPolicy');
    const delayByStadium = Object.fromEntries(
      stadiums.map((s) => {
        const minutes =
          Number(s.payoutPolicy?.delayMinutes) ||
          getBusiness().ownerPayoutDelayMinutes ||
          20;
        return [String(s._id), minutes];
      })
    );

    for (const booking of completed) {
      const delayMin =
        delayByStadium[String(booking.stadium)] ?? getBusiness().ownerPayoutDelayMinutes ?? 20;
      const readyAt = new Date(booking.endTime.getTime() + delayMin * 60 * 1000);
      if (readyAt > now) continue;

      try {
        await paymentService.settleBooking(booking._id);
        emitFieldUpdate(booking.field.toString(), 'booking:updated', {
          bookingId: booking._id,
          status: BOOKING_STATUS.SETTLED,
        });
      } catch (err) {
        console.warn('[jobs] settle failed', booking._id.toString(), err.message);
      }
    }
  }
}

async function maybeCleanupEndedLineups(force = false) {
  const now = Date.now();
  if (!force && now - lastLineupCleanupAt < LINEUP_CLEANUP_EVERY_MS) return;
  lastLineupCleanupAt = now;
  try {
    const result = await lineupService.cleanupEndedLineups();
    if (result.deletedCount) {
      console.log(
        `[jobs] lineup cleanup removed ${result.deletedCount} doc(s) across ${result.bookingIds.length} booking(s)`
      );
    }
  } catch (err) {
    console.warn('[jobs] lineup cleanup failed:', err.message);
  }
}

async function maybeRefreshWeather() {
  if (!getBusiness().weatherEnabled) return;
  const now = Date.now();
  if (now - lastWeatherRefreshAt < WEATHER_REFRESH_EVERY_MS) return;
  lastWeatherRefreshAt = now;
  try {
    const { refreshAll } = require('../services/weather.service');
    await refreshAll({ days: 2 });
  } catch (err) {
    console.warn('[jobs] weather refresh failed:', err.message);
  }
}

async function runOnce() {
  try {
    // Settle mobile-money payments the customer approved after the charge call returned.
    try {
      await paymentService.reconcileProcessingPayments();
    } catch (err) {
      console.warn('[jobs] payment reconcile failed:', err.message);
    }
    const expired = await bookingService.expireStaleHolds();
    if (expired.length) {
      console.log(`[jobs] expired ${expired.length} stale hold / Team B timeout(s)`);
      for (const id of expired) {
        const b = await Booking.findById(id);
        if (b) emitFieldUpdate(b.field.toString(), 'booking:updated', { bookingId: id, status: BOOKING_STATUS.EXPIRED });
        try {
          await lineupService.deleteLineupsForBooking(id);
        } catch (err) {
          console.warn('[jobs] lineup delete on EXPIRED failed', String(id), err.message);
        }
      }
    }
    await advanceMatchLifecycle();
    await maybeCleanupEndedLineups();
    await maybeRefreshWeather();
  } catch (err) {
    console.error('[jobs] tick error:', err.message);
  }
}

let lastTickAt = 0;
let tickInFlight = null;

/**
 * Run a job tick if none ran in the last `minIntervalMs`. Serverless deployments have no
 * always-on timer, so this lets ordinary traffic expire stale holds and settle pending payments
 * even when no external cron is calling /api/cron. Safe to call on every request.
 */
async function runOnceIfDue(minIntervalMs = 60 * 1000, maxWaitMs = 3000) {
  if (!tickInFlight) {
    if (Date.now() - lastTickAt < minIntervalMs) return;
    lastTickAt = Date.now();
    tickInFlight = runOnce().finally(() => {
      tickInFlight = null;
    });
  }
  // Never hold up a user request for long; the tick keeps running in the background.
  await Promise.race([tickInFlight, new Promise((resolve) => setTimeout(resolve, maxWaitMs))]);
}

function startJobs() {
  console.log(
    '[jobs] scheduler started (hold expiry + demand-based Team B window + match lifecycle + settlement + lineup cleanup every 5m + weather risk every 30m)'
  );
  runOnce();
  return setInterval(runOnce, INTERVAL_MS);
}

module.exports = { startJobs, runOnce, runOnceIfDue, maybeCleanupEndedLineups };
