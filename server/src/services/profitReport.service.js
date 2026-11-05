const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Stadium = require('../models/Stadium');
const Field = require('../models/Field');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const { calculateCommission } = require('./pricing.service');
const { getBusiness } = require('./platformSettings.service');
const fieldSubscriptionService = require('./fieldSubscription.service');

const PAID_PAYMENT_STATUSES = [
  PAYMENT_STATUS.HELD,
  PAYMENT_STATUS.SUCCESS,
  PAYMENT_STATUS.SETTLED,
  PAYMENT_STATUS.SETTLEMENT_PENDING,
];

const COMMISSION_ELIGIBLE_BOOKING = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.SETTLED,
];

function toCents(n) {
  return Math.round(Number(n || 0) * 100);
}

function fromCents(c) {
  return Math.round(Number(c || 0)) / 100;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Resolve report window from period + optional from/to.
 * period: day|week|month|quarter|semiannual|year|custom
 */
function resolvePeriodRange(query = {}) {
  const period = String(query.period || 'month').toLowerCase();
  const now = new Date();

  if (query.from || query.to || period === 'custom') {
    if (!query.from || !query.to) {
      throw ApiError.badRequest('Custom range requires from and to (YYYY-MM-DD)');
    }
    const from = startOfDay(new Date(query.from));
    const to = endOfDay(new Date(query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw ApiError.badRequest('Invalid from/to date');
    }
    if (from > to) throw ApiError.badRequest('from must be before to');
    return { period: period === 'custom' ? 'custom' : period, from, to };
  }

  let from;
  let to = endOfDay(now);

  switch (period) {
    case 'day':
      from = startOfDay(now);
      break;
    case 'week': {
      from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      break;
    }
    case 'month': {
      from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      break;
    }
    case 'quarter': {
      from = startOfDay(now);
      from.setDate(from.getDate() - 89);
      break;
    }
    case 'semiannual': {
      from = startOfDay(now);
      from.setDate(from.getDate() - 181);
      break;
    }
    case 'year': {
      from = startOfDay(now);
      from.setDate(from.getDate() - 364);
      break;
    }
    default:
      throw ApiError.badRequest(
        'period must be day|week|month|quarter|semiannual|year|custom'
      );
  }

  return { period, from, to };
}

function bucketKey(date, period) {
  const d = new Date(date);
  if (period === 'day' || period === 'week') {
    return d.toISOString().slice(0, 10);
  }
  if (period === 'month' || period === 'quarter' || period === 'semiannual' || period === 'year' || period === 'custom') {
    // For longer ranges use day buckets when span ≤ 45d, else week or month
    return d.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Resolve optional city/region → stadium ids (case-insensitive exact match).
 * Empty city+region → no geo filter (platform-wide).
 */
async function resolveStadiumGeoFilter(query = {}) {
  const city = query.city ? String(query.city).trim() : '';
  const region = query.region ? String(query.region).trim() : '';
  if (!city && !region) {
    return { city: '', region: '', stadiumIds: null, stadiums: [] };
  }

  const filter = {};
  if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
  if (region) filter.region = new RegExp(`^${escapeRegex(region)}$`, 'i');

  const stadiums = await Stadium.find(filter).select('_id name city region').lean();
  return {
    city,
    region,
    stadiumIds: stadiums.map((s) => s._id),
    stadiums,
  };
}

async function listGeoOptions() {
  const rows = await Stadium.find({})
    .select('city region')
    .lean();
  const cities = new Set();
  const regions = new Set();
  for (const r of rows) {
    if (r.city) cities.add(String(r.city).trim());
    if (r.region) regions.add(String(r.region).trim());
  }
  return {
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    regions: [...regions].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Commission for one booking (cents).
 *
 * Rules (BR-009 + historical correctness):
 * 1. If booking.commissionAmount is set → use it (settlement snapshot).
 * 2. Else if booking.commissionPercent is set → apply to paid payment totals.
 * 3. Else estimate with current platformCommissionPercent on paid payment totals.
 *    estimated=true so reports distinguish live snapshots vs backfill estimates.
 */
function resolveBookingCommission(booking, paymentsByBooking, currentPct) {
  const paid = (paymentsByBooking.get(String(booking._id)) || []).filter((p) =>
    PAID_PAYMENT_STATUSES.includes(p.status)
  );
  const collectedCents = paid.reduce((s, p) => s + toCents(p.amount), 0);

  if (booking.commissionAmount != null && booking.commissionAmount !== undefined) {
    return {
      commissionCents: toCents(booking.commissionAmount),
      collectedCents,
      percent: booking.commissionPercent != null ? Number(booking.commissionPercent) : currentPct,
      source: 'stored',
      estimated: false,
    };
  }

  const pct =
    booking.commissionPercent != null ? Number(booking.commissionPercent) : Number(currentPct);
  const { commissionAmount } = calculateCommission(fromCents(collectedCents), pct);
  return {
    commissionCents: toCents(commissionAmount),
    collectedCents,
    percent: pct,
    source: booking.commissionPercent != null ? 'rate_snapshot' : 'current_policy',
    estimated: true,
  };
}

/**
 * Optionally persist missing commissionAmount on SETTLED / paid bookings
 * so future reports stay stable when policy % changes.
 */
async function backfillCommissionSnapshots({ dryRun = false, limit = 500 } = {}) {
  const currentPct = getBusiness().platformCommissionPercent;
  const bookings = await Booking.find({
    status: { $in: COMMISSION_ELIGIBLE_BOOKING },
    $or: [{ commissionAmount: null }, { commissionAmount: { $exists: false } }],
  })
    .select('_id status commissionPercent commissionAmount pricing')
    .limit(limit)
    .lean();

  if (!bookings.length) return { updated: 0, dryRun };

  const ids = bookings.map((b) => b._id);
  const payments = await Payment.find({
    booking: { $in: ids },
    status: { $in: PAID_PAYMENT_STATUSES },
  })
    .select('booking amount status')
    .lean();

  const byBooking = new Map();
  for (const p of payments) {
    const k = String(p.booking);
    if (!byBooking.has(k)) byBooking.set(k, []);
    byBooking.get(k).push(p);
  }

  let updated = 0;
  for (const b of bookings) {
    const resolved = resolveBookingCommission(b, byBooking, currentPct);
    if (resolved.collectedCents <= 0) continue;
    if (dryRun) {
      updated += 1;
      continue;
    }
    await Booking.updateOne(
      { _id: b._id },
      {
        $set: {
          commissionPercent: resolved.percent,
          commissionAmount: fromCents(resolved.commissionCents),
        },
      }
    );
    updated += 1;
  }

  return { updated, dryRun, scanned: bookings.length };
}

async function buildProfitReport(query = {}) {
  const { period, from, to } = resolvePeriodRange(query);
  const currentPct = getBusiness().platformCommissionPercent;
  const spanDays = Math.max(1, Math.ceil((to - from) / (24 * 60 * 60 * 1000)));
  const geo = await resolveStadiumGeoFilter(query);

  if ((geo.city || geo.region) && (!geo.stadiumIds || geo.stadiumIds.length === 0)) {
    const emptySub = await fieldSubscriptionService.aggregateSubscriptionRevenue(from, to, {
      stadiumIds: [],
    });
    const geoOptions = await listGeoOptions();
    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      spanDays,
      generatedAt: new Date().toISOString(),
      currency: 'USD',
      sllPerUsd: Number(getBusiness().sllPerUsd || 8500),
      policy: {
        platformCommissionPercent: currentPct,
        fieldSubscriptionEnabled: emptySub.enabled,
        fieldSubscriptionAmount: emptySub.rate ?? getBusiness().fieldSubscriptionAmount,
        fieldSubscriptionCurrency: emptySub.currency || 'USD',
      },
      geo: {
        city: geo.city || null,
        region: geo.region || null,
        stadiumCount: 0,
        stadiumIds: [],
      },
      geoOptions,
      totals: {
        bookingCount: 0,
        collected: 0,
        collectedSll: 0,
        commission: 0,
        commissionSll: 0,
        subscriptionOwed: 0,
        subscriptionPaid: 0,
        subscriptionWaived: 0,
        profit: 0,
        profitSll: 0,
      },
      commissionSources: {
        storedSnapshots: 0,
        estimated: 0,
        rule:
          'Prefer booking.commissionAmount (settlement snapshot). Else apply booking.commissionPercent or current platformCommissionPercent to paid payment totals.',
      },
      inventory: {
        stadiums: 0,
        fields: 0,
        activeFields: 0,
      },
      series: [],
      byStadium: [],
      byField: [],
      insights: {
        topStadiumsByCommission: [],
        peakHours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          label: `${String(hour).padStart(2, '0')}:00`,
          commission: 0,
          bookings: 0,
        })),
        peakWeekdays: WEEKDAY_LABELS.map((label, weekday) => ({
          weekday,
          label,
          commission: 0,
          bookings: 0,
        })),
        definitions: {
          peakHours:
            'Commission attributed by match slot startTime hour (0–23 local server TZ).',
          peakWeekdays:
            'Commission attributed by match slot startTime weekday (0=Sunday … 6=Saturday).',
          topStadiums: 'Top 10 stadiums ranked by platform commission (not subscription).',
        },
      },
    };
  }

  // Attribute commission to settledAt when present, else startTime (match day).
  const bookingFilter = {
    status: { $in: COMMISSION_ELIGIBLE_BOOKING },
    $or: [
      { settledAt: { $gte: from, $lte: to } },
      {
        settledAt: { $exists: false },
        startTime: { $gte: from, $lte: to },
      },
      {
        settledAt: null,
        startTime: { $gte: from, $lte: to },
      },
    ],
  };
  if (geo.stadiumIds) {
    bookingFilter.stadium = { $in: geo.stadiumIds };
  }

  const bookings = await Booking.find(bookingFilter)
    .select(
      'stadium field status startTime settledAt pricing commissionAmount commissionPercent ownerPayoutAmount'
    )
    .populate('stadium', 'name city region')
    .populate('field', 'name')
    .lean();

  // Also include SETTLED in range by settledAt primarily — refine filter in memory
  const inRange = bookings.filter((b) => {
    const t = b.settledAt ? new Date(b.settledAt) : new Date(b.startTime);
    return t >= from && t <= to;
  });

  const bookingIds = inRange.map((b) => b._id);
  const payments = bookingIds.length
    ? await Payment.find({
        booking: { $in: bookingIds },
        status: { $in: PAID_PAYMENT_STATUSES },
      })
        .select('booking amount status')
        .lean()
    : [];

  const paymentsByBooking = new Map();
  for (const p of payments) {
    const k = String(p.booking);
    if (!paymentsByBooking.has(k)) paymentsByBooking.set(k, []);
    paymentsByBooking.get(k).push(p);
  }

  let commissionCents = 0;
  let collectedCents = 0;
  let estimatedCount = 0;
  let storedCount = 0;
  const byStadium = {};
  const byField = {};
  const byBucket = {};
  const byHour = {};
  const byWeekday = {};
  for (let h = 0; h < 24; h += 1) byHour[h] = { hour: h, commissionCents: 0, bookings: 0 };
  for (let d = 0; d < 7; d += 1) byWeekday[d] = { weekday: d, commissionCents: 0, bookings: 0 };

  for (const b of inRange) {
    const resolved = resolveBookingCommission(b, paymentsByBooking, currentPct);
    if (resolved.collectedCents <= 0 && resolved.commissionCents <= 0) continue;

    commissionCents += resolved.commissionCents;
    collectedCents += resolved.collectedCents;
    if (resolved.estimated) estimatedCount += 1;
    else storedCount += 1;

    const sid = String(b.stadium?._id || b.stadium);
    const sName = b.stadium?.name || sid;
    if (!byStadium[sid]) {
      byStadium[sid] = {
        stadiumId: sid,
        stadiumName: sName,
        city: b.stadium?.city || null,
        region: b.stadium?.region || null,
        commissionCents: 0,
        collectedCents: 0,
        bookings: 0,
      };
    }
    byStadium[sid].commissionCents += resolved.commissionCents;
    byStadium[sid].collectedCents += resolved.collectedCents;
    byStadium[sid].bookings += 1;

    const fid = String(b.field?._id || b.field);
    const fName = b.field?.name || fid;
    if (!byField[fid]) {
      byField[fid] = {
        fieldId: fid,
        fieldName: fName,
        stadiumId: sid,
        stadiumName: sName,
        commissionCents: 0,
        collectedCents: 0,
        bookings: 0,
      };
    }
    byField[fid].commissionCents += resolved.commissionCents;
    byField[fid].collectedCents += resolved.collectedCents;
    byField[fid].bookings += 1;

    const t = b.settledAt || b.startTime;
    const key = bucketKey(t, period);
    if (!byBucket[key]) byBucket[key] = { key, commissionCents: 0, subscriptionPaidCents: 0, profitCents: 0 };
    byBucket[key].commissionCents += resolved.commissionCents;

    // Peak insights use match slot startTime (when the pitch was booked), not settlement.
    const slotStart = new Date(b.startTime);
    const hour = slotStart.getHours();
    const weekday = slotStart.getDay();
    byHour[hour].commissionCents += resolved.commissionCents;
    byHour[hour].bookings += 1;
    byWeekday[weekday].commissionCents += resolved.commissionCents;
    byWeekday[weekday].bookings += 1;
  }

  const sub = await fieldSubscriptionService.aggregateSubscriptionRevenue(from, to, {
    stadiumIds: geo.stadiumIds || undefined,
  });

  // Merge subscription paid into time buckets (month key → expand to month start day)
  for (const [ym, v] of Object.entries(sub.byMonth || {})) {
    const dayKey = `${ym}-01`;
    if (!byBucket[dayKey]) {
      byBucket[dayKey] = { key: dayKey, commissionCents: 0, subscriptionPaidCents: 0, profitCents: 0 };
    }
    byBucket[dayKey].subscriptionPaidCents += v.paidCents;
  }

  for (const row of Object.values(byBucket)) {
    row.profitCents = row.commissionCents + row.subscriptionPaidCents;
  }

  // Stadium / field merge with subscription
  for (const [sid, v] of Object.entries(sub.byStadium || {})) {
    if (!byStadium[sid]) {
      byStadium[sid] = {
        stadiumId: sid,
        stadiumName: v.stadiumName,
        commissionCents: 0,
        collectedCents: 0,
        bookings: 0,
      };
    }
    byStadium[sid].subscriptionOwedCents = v.owedCents;
    byStadium[sid].subscriptionPaidCents = v.paidCents;
  }
  for (const row of Object.values(byStadium)) {
    row.subscriptionOwedCents = row.subscriptionOwedCents || 0;
    row.subscriptionPaidCents = row.subscriptionPaidCents || 0;
    row.profitCents = row.commissionCents + row.subscriptionPaidCents;
  }

  for (const [fid, v] of Object.entries(sub.byField || {})) {
    if (!byField[fid]) {
      byField[fid] = {
        fieldId: fid,
        fieldName: v.fieldName,
        stadiumId: v.stadiumId,
        stadiumName: v.stadiumName,
        commissionCents: 0,
        collectedCents: 0,
        bookings: 0,
      };
    }
    byField[fid].subscriptionOwedCents = v.owedCents;
    byField[fid].subscriptionPaidCents = v.paidCents;
  }
  for (const row of Object.values(byField)) {
    row.subscriptionOwedCents = row.subscriptionOwedCents || 0;
    row.subscriptionPaidCents = row.subscriptionPaidCents || 0;
    row.profitCents = row.commissionCents + row.subscriptionPaidCents;
  }

  const [stadiumCount, fieldCount, activeFieldCount] = await Promise.all([
    geo.stadiumIds
      ? Promise.resolve(geo.stadiumIds.length)
      : Stadium.countDocuments({}),
    geo.stadiumIds
      ? Field.countDocuments({ stadium: { $in: geo.stadiumIds } })
      : Field.countDocuments({}),
    geo.stadiumIds
      ? Field.countDocuments({ stadium: { $in: geo.stadiumIds }, status: 'active' })
      : Field.countDocuments({ status: 'active' }),
  ]);

  const series = Object.values(byBucket)
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .map((r) => ({
      key: r.key,
      commission: fromCents(r.commissionCents),
      subscriptionPaid: fromCents(r.subscriptionPaidCents),
      profit: fromCents(r.profitCents),
    }));

  const mapMoney = (row) => ({
    ...row,
    commission: fromCents(row.commissionCents),
    collected: fromCents(row.collectedCents || 0),
    subscriptionOwed: fromCents(row.subscriptionOwedCents || 0),
    subscriptionPaid: fromCents(row.subscriptionPaidCents || 0),
    profit: fromCents(row.profitCents || 0),
  });

  const profitCents = commissionCents + sub.paidCents;
  const byStadiumMapped = Object.values(byStadium)
    .map(mapMoney)
    .sort((a, b) => b.profit - a.profit);

  const topStadiumsByCommission = [...byStadiumMapped]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 10)
    .map((r, idx) => ({
      rank: idx + 1,
      stadiumId: r.stadiumId,
      stadiumName: r.stadiumName,
      city: r.city || null,
      region: r.region || null,
      commission: r.commission,
      collected: r.collected,
      bookings: r.bookings,
      profit: r.profit,
    }));

  const peakHours = Object.values(byHour).map((r) => ({
    hour: r.hour,
    label: `${String(r.hour).padStart(2, '0')}:00`,
    commission: fromCents(r.commissionCents),
    bookings: r.bookings,
  }));

  const peakWeekdays = Object.values(byWeekday).map((r) => ({
    weekday: r.weekday,
    label: WEEKDAY_LABELS[r.weekday],
    commission: fromCents(r.commissionCents),
    bookings: r.bookings,
  }));

  const geoOptions = await listGeoOptions();

  const sllRate = Number(getBusiness().sllPerUsd || 8500);

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    spanDays,
    generatedAt: new Date().toISOString(),
    currency: 'USD',
    sllPerUsd: sllRate,
    policy: {
      platformCommissionPercent: currentPct,
      fieldSubscriptionEnabled: sub.enabled,
      fieldSubscriptionAmount: sub.rate ?? getBusiness().fieldSubscriptionAmount,
      fieldSubscriptionCurrency: sub.currency || 'USD',
    },
    geo: {
      city: geo.city || null,
      region: geo.region || null,
      stadiumCount: geo.stadiumIds ? geo.stadiumIds.length : stadiumCount,
      stadiumIds: geo.stadiumIds ? geo.stadiumIds.map(String) : null,
    },
    geoOptions,
    totals: {
      bookingCount: inRange.length,
      collected: fromCents(collectedCents),
      collectedSll: Math.round(fromCents(collectedCents) * sllRate),
      commission: fromCents(commissionCents),
      commissionSll: Math.round(fromCents(commissionCents) * sllRate),
      subscriptionOwed: fromCents(sub.owedCents),
      subscriptionPaid: fromCents(sub.paidCents),
      subscriptionWaived: fromCents(sub.waivedCents),
      profit: fromCents(profitCents),
      profitSll: Math.round(fromCents(profitCents) * sllRate),
      /** Profit uses paid subscription + commission; owed is informational. */
    },
    commissionSources: {
      storedSnapshots: storedCount,
      estimated: estimatedCount,
      rule:
        'Prefer booking.commissionAmount (settlement snapshot). Else apply booking.commissionPercent or current platformCommissionPercent to paid payment totals.',
    },
    inventory: {
      stadiums: stadiumCount,
      fields: fieldCount,
      activeFields: activeFieldCount,
    },
    series,
    byStadium: byStadiumMapped,
    byField: Object.values(byField)
      .map(mapMoney)
      .sort((a, b) => b.profit - a.profit),
    insights: {
      topStadiumsByCommission,
      peakHours,
      peakWeekdays,
      definitions: {
        peakHours:
          'Commission attributed by match slot startTime hour (0–23, server local TZ).',
        peakWeekdays:
          'Commission attributed by match slot startTime weekday (0=Sunday … 6=Saturday).',
        topStadiums: 'Top 10 stadiums ranked by platform commission (not subscription).',
      },
    },
  };
}

/**
 * Dedicated insights payload (same money rules + geo filters as profit report).
 */
async function buildProfitInsights(query = {}) {
  const report = await buildProfitReport(query);
  return {
    period: report.period,
    from: report.from,
    to: report.to,
    spanDays: report.spanDays,
    generatedAt: report.generatedAt,
    currency: report.currency,
    geo: report.geo,
    geoOptions: report.geoOptions,
    totals: {
      bookingCount: report.totals.bookingCount,
      commission: report.totals.commission,
      collected: report.totals.collected,
      subscriptionPaid: report.totals.subscriptionPaid,
      profit: report.totals.profit,
    },
    topStadiumsByCommission: report.insights.topStadiumsByCommission,
    peakHours: report.insights.peakHours,
    peakWeekdays: report.insights.peakWeekdays,
    definitions: report.insights.definitions,
  };
}

async function buildExportBuffer(query = {}) {
  const report = await buildProfitReport(query);
  const format = String(query.format || 'xlsx').toLowerCase();
  if (format === 'pdf') {
    return { buffer: await renderPdf(report), contentType: 'application/pdf', ext: 'pdf', report };
  }
  return {
    buffer: await renderXlsx(report),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
    report,
  };
}

/* ─── Shared report formatting (PDF + Excel) ─── */

const REPORT_MARGIN = 48;
const REPORT_PAGE = { width: 595.28, height: 841.89 };
const REPORT_BRAND = '#1B5E3B';
const REPORT_BRAND_LIGHT = '#E8F2EC';
const REPORT_INK = '#1A1A1A';
const REPORT_MUTED = '#555555';
const REPORT_RULE = '#C8D5CC';
const REPORT_PAPER = '#FFFEFA';
const REPORT_ACCENT = '#0F4A2C';

const PERIOD_LABELS = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
  semiannual: 'Last 6 months',
  year: 'Last 12 months',
  custom: 'Custom range',
};

function moneyUsd(n) {
  const v = Number(n || 0);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function dateOnly(iso) {
  if (!iso) return '—';
  return String(iso).slice(0, 10);
}

function formatGeneratedAt(iso) {
  try {
    return new Date(iso || Date.now()).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return String(iso || '');
  }
}

function periodLabel(report) {
  const base = PERIOD_LABELS[report.period] || report.period;
  return `${base} · ${dateOnly(report.from)} → ${dateOnly(report.to)}`;
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B5E3B' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFC8D5CC' } },
      left: { style: 'thin', color: { argb: 'FFC8D5CC' } },
      bottom: { style: 'thin', color: { argb: 'FFC8D5CC' } },
      right: { style: 'thin', color: { argb: 'FFC8D5CC' } },
    };
  });
  row.height = 22;
}

function styleMoneyCell(cell) {
  cell.numFmt = '"$"#,##0.00';
  cell.alignment = { horizontal: 'right' };
}

function styleDataRow(row, { totals = false } = {}) {
  row.eachCell((cell) => {
    cell.font = {
      bold: totals,
      size: 10,
      name: 'Calibri',
      color: { argb: totals ? 'FF0F4A2C' : 'FF1A1A1A' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5EBE7' } },
      left: { style: 'thin', color: { argb: 'FFE5EBE7' } },
      bottom: { style: 'thin', color: { argb: 'FFE5EBE7' } },
      right: { style: 'thin', color: { argb: 'FFE5EBE7' } },
    };
    if (totals) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F2EC' },
      };
    }
  });
}

async function renderXlsx(report) {
  let ExcelJS;
  try {
    ExcelJS = require('exceljs');
  } catch {
    throw ApiError.badRequest('Excel export requires exceljs — run npm install exceljs in server/');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'E-Garoon';
  wb.company = 'E-Garoon';
  wb.created = new Date(report.generatedAt || Date.now());
  wb.modified = new Date();
  wb.title = 'Platform Profit Report';
  wb.subject = periodLabel(report);

  // ── Summary ──
  const summary = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF1B5E3B' } },
    views: [{ showGridLines: false }],
  });
  summary.mergeCells('A1:B1');
  summary.getCell('A1').value = 'E-GAROON';
  summary.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF1B5E3B' }, name: 'Calibri' };
  summary.getRow(1).height = 28;

  summary.mergeCells('A2:B2');
  summary.getCell('A2').value = 'Platform Profit Report';
  summary.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FF1A1A1A' }, name: 'Calibri' };

  summary.mergeCells('A3:B3');
  summary.getCell('A3').value = periodLabel(report);
  summary.getCell('A3').font = { size: 10, color: { argb: 'FF555555' }, name: 'Calibri' };

  summary.mergeCells('A4:B4');
  summary.getCell('A4').value = `Generated: ${formatGeneratedAt(report.generatedAt)}`;
  summary.getCell('A4').font = { size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };

  summary.addRow([]);
  const metaHeader = summary.addRow(['Report details', '']);
  styleHeaderRow(metaHeader);

  const metaRows = [
    ['Period', PERIOD_LABELS[report.period] || report.period],
    ['From', dateOnly(report.from)],
    ['To', dateOnly(report.to)],
    ['Span (days)', report.spanDays],
    ['Commission policy', `${report.policy.platformCommissionPercent}%`],
    [
      'Field subscription',
      report.policy.fieldSubscriptionEnabled
        ? `$${Number(report.policy.fieldSubscriptionAmount || 0).toFixed(2)} / field / mo`
        : 'Disabled',
    ],
    ['Currency', report.currency || 'USD'],
    ['Stadiums on platform', report.inventory.stadiums],
    ['Active fields', report.inventory.activeFields],
  ];
  for (const [label, value] of metaRows) {
    const row = summary.addRow([label, value]);
    styleDataRow(row);
    row.getCell(1).font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF555555' } };
  }

  summary.addRow([]);
  const totalsHeader = summary.addRow(['Summary metric', 'Amount (USD)']);
  styleHeaderRow(totalsHeader);

  const totalDefs = [
    ['Eligible bookings', report.totals.bookingCount, false],
    ['Gross collected', report.totals.collected, true],
    ['Commission revenue', report.totals.commission, true],
    ['Subscription owed', report.totals.subscriptionOwed, true],
    ['Subscription paid', report.totals.subscriptionPaid, true],
    ['Subscription waived', report.totals.subscriptionWaived, true],
    ['Total profit (commission + sub paid)', report.totals.profit, true],
  ];
  for (const [label, value, isMoney] of totalDefs) {
    const row = summary.addRow([label, value]);
    const isProfit = label.startsWith('Total profit');
    styleDataRow(row, { totals: isProfit });
    if (isMoney) styleMoneyCell(row.getCell(2));
    else row.getCell(2).alignment = { horizontal: 'right' };
  }

  summary.addRow([]);
  summary.addRow([
    'Note',
    'Profit = booking commission + field subscription paid. Subscription owed is informational only.',
  ]);
  summary.addRow([
    'Commission sources',
    `${report.commissionSources.storedSnapshots} stored snapshots · ${report.commissionSources.estimated} estimated`,
  ]);

  summary.getColumn(1).width = 42;
  summary.getColumn(2).width = 28;

  // ── Time series ──
  const seriesWs = wb.addWorksheet('Time series', {
    properties: { tabColor: { argb: 'FF1B5E3B' } },
  });
  seriesWs.mergeCells('A1:D1');
  seriesWs.getCell('A1').value = 'E-GAROON — Platform Profit · Time series';
  seriesWs.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1B5E3B' }, name: 'Calibri' };
  seriesWs.mergeCells('A2:D2');
  seriesWs.getCell('A2').value = periodLabel(report);
  seriesWs.getCell('A2').font = { size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
  seriesWs.addRow([]);
  const seriesHeader = seriesWs.addRow(['Date', 'Commission', 'Subscription paid', 'Profit']);
  styleHeaderRow(seriesHeader);
  let seriesCommission = 0;
  let seriesSub = 0;
  let seriesProfit = 0;
  for (const r of report.series || []) {
    const row = seriesWs.addRow([r.key, r.commission, r.subscriptionPaid, r.profit]);
    styleDataRow(row);
    styleMoneyCell(row.getCell(2));
    styleMoneyCell(row.getCell(3));
    styleMoneyCell(row.getCell(4));
    seriesCommission += Number(r.commission) || 0;
    seriesSub += Number(r.subscriptionPaid) || 0;
    seriesProfit += Number(r.profit) || 0;
  }
  const seriesTotal = seriesWs.addRow(['TOTAL', seriesCommission, seriesSub, seriesProfit]);
  styleDataRow(seriesTotal, { totals: true });
  styleMoneyCell(seriesTotal.getCell(2));
  styleMoneyCell(seriesTotal.getCell(3));
  styleMoneyCell(seriesTotal.getCell(4));
  seriesWs.columns = [{ width: 14 }, { width: 14 }, { width: 18 }, { width: 14 }];

  // ── By stadium ──
  const stadWs = wb.addWorksheet('By stadium', {
    properties: { tabColor: { argb: 'FF1B5E3B' } },
  });
  stadWs.mergeCells('A1:F1');
  stadWs.getCell('A1').value = 'E-GAROON — Platform Profit · By stadium';
  stadWs.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1B5E3B' }, name: 'Calibri' };
  stadWs.mergeCells('A2:F2');
  stadWs.getCell('A2').value = periodLabel(report);
  stadWs.getCell('A2').font = { size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
  stadWs.addRow([]);
  const stadHeader = stadWs.addRow([
    'Stadium',
    'Bookings',
    'Commission',
    'Sub owed',
    'Sub paid',
    'Profit',
  ]);
  styleHeaderRow(stadHeader);
  let stadBookings = 0;
  let stadCommission = 0;
  let stadOwed = 0;
  let stadPaid = 0;
  let stadProfit = 0;
  for (const r of report.byStadium || []) {
    const row = stadWs.addRow([
      r.stadiumName,
      r.bookings,
      r.commission,
      r.subscriptionOwed,
      r.subscriptionPaid,
      r.profit,
    ]);
    styleDataRow(row);
    row.getCell(2).alignment = { horizontal: 'right' };
    styleMoneyCell(row.getCell(3));
    styleMoneyCell(row.getCell(4));
    styleMoneyCell(row.getCell(5));
    styleMoneyCell(row.getCell(6));
    stadBookings += Number(r.bookings) || 0;
    stadCommission += Number(r.commission) || 0;
    stadOwed += Number(r.subscriptionOwed) || 0;
    stadPaid += Number(r.subscriptionPaid) || 0;
    stadProfit += Number(r.profit) || 0;
  }
  const stadTotal = stadWs.addRow([
    'TOTAL',
    stadBookings,
    stadCommission,
    stadOwed,
    stadPaid,
    stadProfit,
  ]);
  styleDataRow(stadTotal, { totals: true });
  stadTotal.getCell(2).alignment = { horizontal: 'right' };
  styleMoneyCell(stadTotal.getCell(3));
  styleMoneyCell(stadTotal.getCell(4));
  styleMoneyCell(stadTotal.getCell(5));
  styleMoneyCell(stadTotal.getCell(6));
  stadWs.columns = [
    { width: 28 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  // ── By field ──
  const fieldWs = wb.addWorksheet('By field', {
    properties: { tabColor: { argb: 'FF1B5E3B' } },
  });
  fieldWs.mergeCells('A1:G1');
  fieldWs.getCell('A1').value = 'E-GAROON — Platform Profit · By field';
  fieldWs.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1B5E3B' }, name: 'Calibri' };
  fieldWs.mergeCells('A2:G2');
  fieldWs.getCell('A2').value = periodLabel(report);
  fieldWs.getCell('A2').font = { size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
  fieldWs.addRow([]);
  const fieldHeader = fieldWs.addRow([
    'Field',
    'Stadium',
    'Bookings',
    'Commission',
    'Sub owed',
    'Sub paid',
    'Profit',
  ]);
  styleHeaderRow(fieldHeader);
  let fieldBookings = 0;
  let fieldCommission = 0;
  let fieldOwed = 0;
  let fieldPaid = 0;
  let fieldProfit = 0;
  for (const r of report.byField || []) {
    const row = fieldWs.addRow([
      r.fieldName,
      r.stadiumName,
      r.bookings,
      r.commission,
      r.subscriptionOwed,
      r.subscriptionPaid,
      r.profit,
    ]);
    styleDataRow(row);
    row.getCell(3).alignment = { horizontal: 'right' };
    styleMoneyCell(row.getCell(4));
    styleMoneyCell(row.getCell(5));
    styleMoneyCell(row.getCell(6));
    styleMoneyCell(row.getCell(7));
    fieldBookings += Number(r.bookings) || 0;
    fieldCommission += Number(r.commission) || 0;
    fieldOwed += Number(r.subscriptionOwed) || 0;
    fieldPaid += Number(r.subscriptionPaid) || 0;
    fieldProfit += Number(r.profit) || 0;
  }
  const fieldTotal = fieldWs.addRow([
    'TOTAL',
    '',
    fieldBookings,
    fieldCommission,
    fieldOwed,
    fieldPaid,
    fieldProfit,
  ]);
  styleDataRow(fieldTotal, { totals: true });
  fieldTotal.getCell(3).alignment = { horizontal: 'right' };
  styleMoneyCell(fieldTotal.getCell(4));
  styleMoneyCell(fieldTotal.getCell(5));
  styleMoneyCell(fieldTotal.getCell(6));
  styleMoneyCell(fieldTotal.getCell(7));
  fieldWs.columns = [
    { width: 22 },
    { width: 24 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function pdfEnsureSpace(doc, needed) {
  if (doc.y + needed > REPORT_PAGE.height - 56) {
    doc.addPage();
    doc.rect(0, 0, REPORT_PAGE.width, REPORT_PAGE.height).fill(REPORT_PAPER);
    doc.fillColor(REPORT_INK);
    doc.y = REPORT_MARGIN;
  }
}

function pdfDrawHeader(doc) {
  doc.save();
  doc.rect(0, 0, REPORT_PAGE.width, 72).fill(REPORT_BRAND);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18);
  doc.text('E-GAROON', REPORT_MARGIN, REPORT_MARGIN - 8, { continued: false });
  doc.font('Helvetica').fontSize(9).fillColor('#D4E8DC');
  doc.text('Stadium booking platform · Somalia', REPORT_MARGIN, REPORT_MARGIN + 16);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
  doc.text('Super Admin · Confidential', REPORT_MARGIN, REPORT_MARGIN + 32, {
    width: REPORT_PAGE.width - REPORT_MARGIN * 2,
    align: 'right',
  });
  doc.restore();
  doc.y = 88;
}

function pdfDrawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const pageNo = i + 1;
    const y = REPORT_PAGE.height - 36;
    doc.save();
    doc.strokeColor(REPORT_RULE).lineWidth(0.6);
    doc.moveTo(REPORT_MARGIN, y - 8).lineTo(REPORT_PAGE.width - REPORT_MARGIN, y - 8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(REPORT_MUTED);
    doc.text('E-Garoon · Platform Profit Report · Confidential', REPORT_MARGIN, y, {
      width: REPORT_PAGE.width / 2 - REPORT_MARGIN,
      align: 'left',
      lineBreak: false,
    });
    doc.text(`Page ${pageNo} of ${range.count}`, REPORT_PAGE.width / 2, y, {
      width: REPORT_PAGE.width / 2 - REPORT_MARGIN,
      align: 'right',
      lineBreak: false,
    });
    doc.restore();
  }
}

function pdfSectionTitle(doc, title) {
  pdfEnsureSpace(doc, 28);
  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(REPORT_BRAND).text(title);
  doc
    .strokeColor(REPORT_RULE)
    .lineWidth(1)
    .moveTo(REPORT_MARGIN, doc.y + 2)
    .lineTo(REPORT_PAGE.width - REPORT_MARGIN, doc.y + 2)
    .stroke();
  doc.moveDown(0.5);
  doc.fillColor(REPORT_INK);
}

function pdfSummaryCards(doc, report) {
  const cards = [
    { label: 'Commission', value: moneyUsd(report.totals.commission) },
    { label: 'Subscription paid', value: moneyUsd(report.totals.subscriptionPaid) },
    { label: 'Total profit', value: moneyUsd(report.totals.profit) },
  ];
  const gap = 10;
  const cardW = (REPORT_PAGE.width - REPORT_MARGIN * 2 - gap * 2) / 3;
  const cardH = 52;
  const startY = doc.y;
  pdfEnsureSpace(doc, cardH + 8);

  cards.forEach((card, i) => {
    const x = REPORT_MARGIN + i * (cardW + gap);
    doc.save();
    doc.roundedRect(x, startY, cardW, cardH, 4).fill(REPORT_BRAND_LIGHT);
    doc.roundedRect(x, startY, cardW, cardH, 4).lineWidth(0.8).strokeColor(REPORT_RULE).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(REPORT_MUTED).text(card.label.toUpperCase(), x + 10, startY + 10, {
      width: cardW - 20,
    });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(REPORT_ACCENT).text(card.value, x + 10, startY + 26, {
      width: cardW - 20,
    });
    doc.restore();
  });
  doc.y = startY + cardH + 12;
}

function pdfDrawTable(doc, { columns, rows, totalsRow }) {
  const usable = REPORT_PAGE.width - REPORT_MARGIN * 2;
  const colWidths = columns.map((c) => c.width);
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const scale = usable / totalW;
  const widths = colWidths.map((w) => w * scale);
  const rowH = 16;
  const headerH = 18;

  const drawHeader = () => {
    pdfEnsureSpace(doc, headerH + 4);
    let x = REPORT_MARGIN;
    const y = doc.y;
    doc.save();
    doc.rect(REPORT_MARGIN, y, usable, headerH).fill(REPORT_BRAND);
    columns.forEach((col, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#FFFFFF')
        .text(col.label, x + 4, y + 5, {
          width: widths[i] - 8,
          align: col.align || 'left',
          lineBreak: false,
        });
      x += widths[i];
    });
    doc.restore();
    doc.y = y + headerH;
  };

  const drawRow = (cells, { isTotal = false } = {}) => {
    pdfEnsureSpace(doc, rowH + 2);
    if (doc.y < REPORT_MARGIN + 4) {
      // after page break, re-draw header
      drawHeader();
    }
    let x = REPORT_MARGIN;
    const y = doc.y;
    if (isTotal) {
      doc.save();
      doc.rect(REPORT_MARGIN, y, usable, rowH).fill(REPORT_BRAND_LIGHT);
      doc.restore();
    } else if (Math.floor((y - REPORT_MARGIN) / rowH) % 2 === 0) {
      doc.save();
      doc.rect(REPORT_MARGIN, y, usable, rowH).fill('#F7FAF8');
      doc.restore();
    }
    cells.forEach((val, i) => {
      const col = columns[i];
      doc
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor(isTotal ? REPORT_ACCENT : REPORT_INK)
        .text(String(val ?? '—'), x + 4, y + 4, {
          width: widths[i] - 8,
          align: col.align || 'left',
          lineBreak: false,
        });
      x += widths[i];
    });
    doc.y = y + rowH;
  };

  drawHeader();
  if (!rows.length) {
    drawRow(columns.map((_, i) => (i === 0 ? 'No data in this range' : '—')));
  } else {
    for (const row of rows) {
      // If near bottom, page break + header
      if (doc.y + rowH > REPORT_PAGE.height - 56) {
        doc.addPage();
        doc.rect(0, 0, REPORT_PAGE.width, REPORT_PAGE.height).fill(REPORT_PAPER);
        doc.y = REPORT_MARGIN;
        drawHeader();
      }
      drawRow(row);
    }
  }
  if (totalsRow) {
    if (doc.y + rowH > REPORT_PAGE.height - 56) {
      doc.addPage();
      doc.rect(0, 0, REPORT_PAGE.width, REPORT_PAGE.height).fill(REPORT_PAPER);
      doc.y = REPORT_MARGIN;
      drawHeader();
    }
    drawRow(totalsRow, { isTotal: true });
  }
  doc.moveDown(0.4);
}

async function renderPdf(report) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw ApiError.badRequest('PDF export requires pdfkit — run npm install pdfkit in server/');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: REPORT_MARGIN,
      bufferPages: true,
      info: {
        Title: 'E-Garoon — Platform Profit Report',
        Author: 'E-Garoon',
        Subject: periodLabel(report),
        CreationDate: new Date(report.generatedAt || Date.now()),
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, REPORT_PAGE.width, REPORT_PAGE.height).fill(REPORT_PAPER);
    pdfDrawHeader(doc);

    doc
      .fillColor(REPORT_INK)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('Platform Profit Report', REPORT_MARGIN, doc.y, {
        width: REPORT_PAGE.width - REPORT_MARGIN * 2,
        align: 'center',
      });
    doc.moveDown(0.35);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(REPORT_MUTED)
      .text(periodLabel(report), { align: 'center' });
    doc.text(`Generated ${formatGeneratedAt(report.generatedAt)}`, { align: 'center' });
    doc.moveDown(0.25);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(REPORT_MUTED)
      .text(
        `Commission policy ${report.policy.platformCommissionPercent}%` +
          (report.policy.fieldSubscriptionEnabled
            ? ` · Field subscription $${Number(report.policy.fieldSubscriptionAmount || 0).toFixed(2)}/mo`
            : ' · Field subscription off') +
          ` · ${report.totals.bookingCount} eligible bookings`,
        { align: 'center' }
      );
    doc.moveDown(0.7);

    pdfSectionTitle(doc, 'Summary');
    pdfSummaryCards(doc, report);

    doc.font('Helvetica').fontSize(8.5).fillColor(REPORT_MUTED);
    doc.text(
      `Gross collected ${moneyUsd(report.totals.collected)} · Sub owed ${moneyUsd(report.totals.subscriptionOwed)} · Sub waived ${moneyUsd(report.totals.subscriptionWaived)} · Inventory ${report.inventory.stadiums} stadiums / ${report.inventory.activeFields} active fields`
    );
    doc.text(
      `Commission sources: ${report.commissionSources.storedSnapshots} stored · ${report.commissionSources.estimated} estimated`
    );
    doc.moveDown(0.3);

    // Time series
    pdfSectionTitle(doc, 'Profit over time');
    const seriesRows = (report.series || []).map((r) => [
      r.key,
      moneyUsd(r.commission),
      moneyUsd(r.subscriptionPaid),
      moneyUsd(r.profit),
    ]);
    const seriesTotals = [
      'TOTAL',
      moneyUsd(report.totals.commission),
      moneyUsd(report.totals.subscriptionPaid),
      moneyUsd(report.totals.profit),
    ];
    pdfDrawTable(doc, {
      columns: [
        { label: 'Date', width: 90, align: 'left' },
        { label: 'Commission', width: 90, align: 'right' },
        { label: 'Subscription paid', width: 110, align: 'right' },
        { label: 'Profit', width: 90, align: 'right' },
      ],
      rows: seriesRows,
      totalsRow: seriesRows.length ? seriesTotals : null,
    });

    // By stadium
    pdfSectionTitle(doc, 'By stadium');
    const stadiumRows = (report.byStadium || []).map((r) => [
      r.stadiumName,
      String(r.bookings ?? 0),
      moneyUsd(r.commission),
      moneyUsd(r.subscriptionOwed),
      moneyUsd(r.subscriptionPaid),
      moneyUsd(r.profit),
    ]);
    const stadiumTotals = [
      'TOTAL',
      String((report.byStadium || []).reduce((s, r) => s + (r.bookings || 0), 0)),
      moneyUsd((report.byStadium || []).reduce((s, r) => s + (Number(r.commission) || 0), 0)),
      moneyUsd((report.byStadium || []).reduce((s, r) => s + (Number(r.subscriptionOwed) || 0), 0)),
      moneyUsd((report.byStadium || []).reduce((s, r) => s + (Number(r.subscriptionPaid) || 0), 0)),
      moneyUsd((report.byStadium || []).reduce((s, r) => s + (Number(r.profit) || 0), 0)),
    ];
    pdfDrawTable(doc, {
      columns: [
        { label: 'Stadium', width: 140, align: 'left' },
        { label: 'Bookings', width: 50, align: 'right' },
        { label: 'Commission', width: 70, align: 'right' },
        { label: 'Sub owed', width: 65, align: 'right' },
        { label: 'Sub paid', width: 65, align: 'right' },
        { label: 'Profit', width: 70, align: 'right' },
      ],
      rows: stadiumRows,
      totalsRow: stadiumRows.length ? stadiumTotals : null,
    });

    // By field
    pdfSectionTitle(doc, 'By field');
    const fieldRows = (report.byField || []).map((r) => [
      r.fieldName,
      r.stadiumName,
      String(r.bookings ?? 0),
      moneyUsd(r.commission),
      moneyUsd(r.subscriptionPaid),
      moneyUsd(r.profit),
    ]);
    const fieldTotals = [
      'TOTAL',
      '',
      String((report.byField || []).reduce((s, r) => s + (r.bookings || 0), 0)),
      moneyUsd((report.byField || []).reduce((s, r) => s + (Number(r.commission) || 0), 0)),
      moneyUsd((report.byField || []).reduce((s, r) => s + (Number(r.subscriptionPaid) || 0), 0)),
      moneyUsd((report.byField || []).reduce((s, r) => s + (Number(r.profit) || 0), 0)),
    ];
    pdfDrawTable(doc, {
      columns: [
        { label: 'Field', width: 100, align: 'left' },
        { label: 'Stadium', width: 110, align: 'left' },
        { label: 'Bookings', width: 50, align: 'right' },
        { label: 'Commission', width: 70, align: 'right' },
        { label: 'Sub paid', width: 65, align: 'right' },
        { label: 'Profit', width: 70, align: 'right' },
      ],
      rows: fieldRows,
      totalsRow: fieldRows.length ? fieldTotals : null,
    });

    doc.moveDown(0.5);
    pdfEnsureSpace(doc, 40);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(REPORT_MUTED)
      .text(
        'Profit = booking commission revenue + field subscription paid. Figures use stored commissionAmount when available; otherwise estimated from paid payments and policy rates.',
        { width: REPORT_PAGE.width - REPORT_MARGIN * 2, align: 'left' }
      );

    pdfDrawFooter(doc);
    doc.end();
  });
}

module.exports = {
  resolvePeriodRange,
  buildProfitReport,
  buildProfitInsights,
  buildExportBuffer,
  backfillCommissionSnapshots,
  resolveBookingCommission,
  resolveStadiumGeoFilter,
  listGeoOptions,
  renderPdf,
  renderXlsx,
  toCents,
  fromCents,
};
