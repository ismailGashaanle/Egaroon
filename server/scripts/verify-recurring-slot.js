/**
 * Verify joogto (RecurringBooking) locks field+weekday+hour.
 * Usage: node scripts/verify-recurring-slot.js
 * Does not print MONGO_URI / secrets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { recurringOverlapsRange, findOverlappingRecurring, teamDisplayName } =
  require('../src/services/recurring.service');
const { wallClockHHMM, formatWallClock12 } = require('../src/utils/venueClock');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('  ok ', msg);
}

function nextWeekdayUtc(dayOfWeek, hour, minute = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, hour, minute, 0, 0));
  while (d.getUTCDay() !== dayOfWeek) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function runOverlapUnit() {
  console.log('[verify] recurringOverlapsRange');
  const rec = {
    status: 'active',
    dayOfWeek: 5,
    startTimeLocal: '20:00',
    endTimeLocal: '21:00',
    startDate: new Date('2020-01-01T00:00:00.000Z'),
    endDate: null,
    teamName: 'Doctors FC',
  };

  const friday = nextWeekdayUtc(5, 20);
  const fridayEnd = new Date(friday.getTime() + 60 * 60 * 1000);
  const nextFriday = new Date(friday);
  nextFriday.setUTCDate(nextFriday.getUTCDate() + 7);
  const nextFridayEnd = new Date(nextFriday.getTime() + 60 * 60 * 1000);
  const thursday = new Date(friday);
  thursday.setUTCDate(thursday.getUTCDate() - 1);
  const thursdayEnd = new Date(thursday.getTime() + 60 * 60 * 1000);
  const friday19 = new Date(friday);
  friday19.setUTCHours(19, 0, 0, 0);
  const friday19End = new Date(friday19.getTime() + 60 * 60 * 1000);

  assert(wallClockHHMM(friday) === '20:00', 'venue clock label 20:00 (not EAT-shifted)');
  assert(formatWallClock12('20:00') === '8:00 PM', '12h label 8:00 PM');
  assert(recurringOverlapsRange(rec, friday, fridayEnd), 'locks matching Friday 20:00–21:00');
  assert(recurringOverlapsRange(rec, nextFriday, nextFridayEnd), 'locks the next Friday too');
  assert(!recurringOverlapsRange(rec, thursday, thursdayEnd), 'does not lock a different weekday');
  assert(!recurringOverlapsRange(rec, friday19, friday19End), 'does not lock a different hour');
  assert(
    !recurringOverlapsRange({ ...rec, status: 'paused' }, friday, fridayEnd),
    'paused joogto does not lock'
  );
  assert(
    !recurringOverlapsRange({ ...rec, endDate: new Date('2020-02-01T00:00:00.000Z') }, friday, fridayEnd),
    'ended date range does not lock future Fridays'
  );
  assert(teamDisplayName(rec) === 'Doctors FC', 'team display name');
  return { friday, fridayEnd };
}

(async () => {
  runOverlapUnit();

  if (!process.env.MONGO_URI) {
    console.log('[verify] no MONGO_URI — skip live slot/hold check');
    return;
  }

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[verify] connected');

  const RecurringBooking = require('../src/models/RecurringBooking');
  const { getFieldSlots } = require('../src/services/slot.service');
  const bookingService = require('../src/services/booking.service');

  const rec = await RecurringBooking.findOne({ status: 'active' }).lean();
  if (!rec) {
    console.log('[verify] no active RecurringBooking in DB — overlap unit passed only');
    await mongoose.disconnect();
    return;
  }

  const date = (() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    while (d.getUTCDay() !== Number(rec.dayOfWeek)) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const [hh, mm] = String(rec.startTimeLocal || '20:00').split(':').map(Number);
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCHours(hh, mm || 0, 0, 0);
  const end = new Date(start);
  const [eh, em] = String(rec.endTimeLocal || '21:00').split(':').map(Number);
  end.setUTCHours(eh, em || 0, 0, 0);

  console.log('[verify] live joogto', {
    field: String(rec.field),
    team: rec.teamName,
    date,
    start: start.toISOString(),
  });

  const feed = await getFieldSlots({ fieldId: rec.field, date });
  const hit = (feed.slots || []).find(
    (s) => new Date(s.startTime).getTime() === start.getTime()
  );
  if (!hit) {
    console.log('[verify] no hourly cell at that time (field hours?) — skip feed assert');
  } else {
    assert(hit.state !== 'available', `slot state is ${hit.state}, not available`);
    assert(hit.labelHint === 'RECURRING' || String(hit.reason || '').startsWith('RECURRING'), 'labelHint RECURRING');
    assert(hit.isRecurring === true, 'isRecurring true');
    const uiStart = hit.startLabel || wallClockHHMM(hit.startTime);
    const uiEnd = hit.endLabel || wallClockHHMM(hit.endTime);
    assert(uiStart === rec.startTimeLocal, `UI start ${uiStart} matches joogto ${rec.startTimeLocal}`);
    assert(uiEnd === rec.endTimeLocal, `UI end ${uiEnd} matches joogto ${rec.endTimeLocal}`);
    console.log('  feed', {
      startTime: hit.startTime,
      state: hit.state,
      labelSo: hit.labelSo,
      teamName: hit.teamName,
      startLabel: uiStart,
      endLabel: uiEnd,
      ui12h: `${formatWallClock12(uiStart)} – ${formatWallClock12(uiEnd)}`,
    });
  }

  const overlap = await findOverlappingRecurring(rec.field, start, end);
  assert(Boolean(overlap), 'findOverlappingRecurring finds the joogto');

  try {
    await bookingService.assertSlotIsFree(rec.field, start, end, {});
    throw new Error('assertSlotIsFree should have thrown RECURRING_SLOT');
  } catch (err) {
    assert(err.statusCode === 409, `conflict status ${err.statusCode}`);
    assert(err.details?.code === 'RECURRING_SLOT', `code ${err.details?.code}`);
    console.log('  hold reject', err.message, err.details?.code);
  }

  await mongoose.disconnect();
  console.log('[verify] done');
})().catch(async (err) => {
  console.error('[verify] FAIL', err.message);
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState) await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
