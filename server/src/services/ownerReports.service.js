const Booking = require('../models/Booking');
const Stadium = require('../models/Stadium');
const Field = require('../models/Field');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const RecurringBooking = require('../models/RecurringBooking');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { resolveScopedStadiumIds } = require('./ownerAccept.service');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { BOOKED_STATUSES, classifyBookingSlot } = require('./slot.service');
const { ownerCanSeeCommission, getBusiness } = require('./platformSettings.service');
const Payment = require('../models/Payment');

function parseDateBound(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid date');
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function hourLabel(date) {
  const h = new Date(date).getHours();
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Scoped owner/manager reports with day/week/month revenue, captains, hour charts.
 */
async function buildOwnerReports(user, query = {}) {
  const isManager = user.role === ROLES.STADIUM_MANAGER;
  const showCommission = ownerCanSeeCommission(user);
  const stadiumIds = await resolveScopedStadiumIds(user, query.stadiumId);
  if (stadiumIds.length === 0) {
    return emptyReports({ days: Number(query.days) || 14, isManager, showCommission });
  }

  const days = Math.min(Math.max(Number(query.days) || 14, 1), 365);
  let since = parseDateBound(query.from);
  let until = parseDateBound(query.to, true);
  if (!since) {
    since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
  }
  if (!until) {
    until = new Date();
    until.setHours(23, 59, 59, 999);
  }

  const stadiums = await Stadium.find({ _id: { $in: stadiumIds } }).select(
    'name ratingAverage ratingCount payoutPolicy bookingAcceptMode'
  );
  const fields = await Field.find({ stadium: { $in: stadiumIds } }).select('name stadium type capacity');

  const bookings = await Booking.find({
    stadium: { $in: stadiumIds },
    startTime: { $gte: since, $lte: until },
  })
    .select(
      'status startTime endTime field stadium ownerPayoutAmount commissionAmount pricing teamA teamB coveredFullMatch settledAt'
    )
    .populate('field', 'name')
    .populate('stadium', 'name')
    .populate('teamA.captain', 'name phone email')
    .populate('teamB.captain', 'name phone email')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .lean();

  const byDayMap = {};
  const revenueByDayMap = {};
  const spanMs = until - since;
  const dayCount = Math.max(1, Math.ceil(spanMs / (24 * 60 * 60 * 1000)));
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDayMap[key] = 0;
    revenueByDayMap[key] = 0;
  }

  const byStatus = {};
  const byField = {};
  const byHour = {};
  for (let h = 0; h < 24; h++) {
    byHour[`${String(h).padStart(2, '0')}:00`] = 0;
  }
  const captainsMap = {};
  let revenueSettled = 0;
  let commissionTotal = 0;
  let grossBooked = 0;

  for (const b of bookings) {
    const day = new Date(b.startTime).toISOString().slice(0, 10);
    if (byDayMap[day] != null) byDayMap[day] += 1;

    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    const fieldKey = b.field?.name || String(b.field);
    if (!byField[fieldKey]) byField[fieldKey] = { bookings: 0, revenue: 0 };
    byField[fieldKey].bookings += 1;

    const hour = hourLabel(b.startTime);
    if (byHour[hour] != null) byHour[hour] += 1;

    const total = Number(b.pricing?.totalPrice || 0);
    if (b.status !== 'CANCELLED' && b.status !== 'EXPIRED') {
      grossBooked += total;
    }

    if (b.status === BOOKING_STATUS.SETTLED && !isManager) {
      const pay = Number(b.ownerPayoutAmount || 0);
      byField[fieldKey].revenue += pay;
      revenueSettled += pay;
      commissionTotal += Number(b.commissionAmount || 0);
      if (revenueByDayMap[day] != null) revenueByDayMap[day] += pay;
    }

    const caps = [b.teamA?.captain, b.teamB?.captain].filter(Boolean);
    for (const c of caps) {
      const id = String(c._id || c);
      if (!captainsMap[id]) {
        captainsMap[id] = {
          id,
          name: c.name || 'Captain',
          phone: c.phone || '',
          bookings: 0,
        };
      }
      captainsMap[id].bookings += 1;
    }
  }

  // Week buckets (ISO week start Mon)
  const byWeekMap = {};
  for (const b of bookings) {
    const d = new Date(b.startTime);
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    if (!byWeekMap[key]) byWeekMap[key] = { bookings: 0, revenue: 0 };
    byWeekMap[key].bookings += 1;
    if (b.status === BOOKING_STATUS.SETTLED && !isManager) {
      byWeekMap[key].revenue += Number(b.ownerPayoutAmount || 0);
    }
  }

  // Month buckets
  const byMonthMap = {};
  for (const b of bookings) {
    const key = new Date(b.startTime).toISOString().slice(0, 7);
    if (!byMonthMap[key]) byMonthMap[key] = { bookings: 0, revenue: 0 };
    byMonthMap[key].bookings += 1;
    if (b.status === BOOKING_STATUS.SETTLED && !isManager) {
      byMonthMap[key].revenue += Number(b.ownerPayoutAmount || 0);
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayBookings = await Booking.countDocuments({
    stadium: { $in: stadiumIds },
    startTime: { $gte: todayStart, $lte: todayEnd },
    status: { $nin: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.EXPIRED] },
  });
  const pendingPayout = await Booking.countDocuments({
    stadium: { $in: stadiumIds },
    status: BOOKING_STATUS.COMPLETED,
  });

  const avgRating =
    stadiums.length > 0
      ? stadiums.reduce((s, st) => s + (st.ratingAverage || 0), 0) / stadiums.length
      : 0;
  const reviewCount = stadiums.reduce((s, st) => s + (st.ratingCount || 0), 0);

  const captains = Object.values(captainsMap)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 25);

  const bookingIds = bookings.map((b) => b._id);
  const payments = await Payment.find({
    booking: { $in: bookingIds },
    status: { $in: ['SUCCESS', 'HELD', 'SETTLED'] },
  })
    .select('booking side amount currency payCurrency amountUsd amountSll exchangeRate')
    .lean();

  const paymentByBooking = {};
  let totalPaidUsd = 0;
  let totalPaidSll = 0;
  let countPaidUsd = 0;
  let countPaidSll = 0;

  for (const p of payments) {
    const bId = String(p.booking);
    if (!paymentByBooking[bId]) paymentByBooking[bId] = [];
    paymentByBooking[bId].push(p);

    const isSll = p.currency === 'SLL' || p.payCurrency === 'SLL';
    if (isSll) {
      countPaidSll += 1;
      totalPaidSll += Number(p.amountSll || p.amount || 0);
    } else {
      countPaidUsd += 1;
      totalPaidUsd += Number(p.amountUsd || p.amount || 0);
    }
  }

  const biz = getBusiness();
  const rate = Number(biz?.sllPerUsd || 8500);
  const revenueSettledSll = Math.round(revenueSettled * rate);
  const grossBookedSll = Math.round(grossBooked * rate);

  return {
    days: dayCount,
    from: since.toISOString(),
    to: until.toISOString(),
    todayBookings,
    pendingPayout,
    totalBookings: bookings.length,
    sllPerUsd: rate,
    grossBooked: isManager ? null : Math.round(grossBooked * 100) / 100,
    grossBookedSll: isManager ? null : grossBookedSll,
    revenueSettled: isManager ? null : Math.round(revenueSettled * 100) / 100,
    revenueSettledSll: isManager ? null : revenueSettledSll,
    currencyBreakdown: {
      countPaidUsd,
      countPaidSll,
      totalPaidUsd: Math.round(totalPaidUsd * 100) / 100,
      totalPaidSll,
    },
    commissionTotal: showCommission ? Math.round(commissionTotal * 100) / 100 : null,
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount,
    bookingsByDay: Object.entries(byDayMap).map(([date, count]) => ({
      date,
      count,
      revenue: isManager ? null : revenueByDayMap[date] || 0,
      revenueSll: isManager ? null : Math.round((revenueByDayMap[date] || 0) * rate),
    })),
    revenueByDay: Object.entries(revenueByDayMap).map(([date, revenue]) => ({
      date,
      revenue: isManager ? null : revenue,
      revenueSll: isManager ? null : Math.round((revenue || 0) * rate),
    })),
    bookingsByWeek: Object.entries(byWeekMap)
      .map(([weekStart, v]) => ({
        weekStart,
        count: v.bookings,
        revenue: isManager ? null : v.revenue,
        revenueSll: isManager ? null : Math.round((v.revenue || 0) * rate),
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    bookingsByMonth: Object.entries(byMonthMap)
      .map(([month, v]) => ({
        month,
        count: v.bookings,
        revenue: isManager ? null : v.revenue,
        revenueSll: isManager ? null : Math.round((v.revenue || 0) * rate),
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    bookingsByHour: Object.entries(byHour)
      .map(([hour, count]) => ({ hour, count }))
      .filter((r) => r.count > 0 || ['06:00', '12:00', '18:00', '21:00'].includes(r.hour)),
    bookingsByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    byField: Object.entries(byField)
      .map(([name, v]) => ({
        name,
        bookings: v.bookings,
        revenue: isManager ? null : v.revenue,
        revenueSll: isManager ? null : Math.round((v.revenue || 0) * rate),
      }))
      .sort((a, b) => b.bookings - a.bookings),
    captains,
    stadiums: stadiums.map((s) => ({
      id: s._id,
      name: s.name,
      ratingAverage: s.ratingAverage,
      ratingCount: s.ratingCount,
      payoutPolicy: s.payoutPolicy || { mode: 'after_match', delayMinutes: 20 },
      bookingAcceptMode: s.bookingAcceptMode || 'auto',
    })),
    fieldsCount: fields.length,
    rows: bookings.map((b) => {
      const bPayments = paymentByBooking[String(b._id)] || [];
      const paymentCurrencies =
        [...new Set(bPayments.map((p) => p.currency || 'USD'))].join(', ') || 'USD';
      return {
        id: b._id,
        stadium: b.stadium?.name || '',
        field: b.field?.name || '',
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        totalPrice: b.pricing?.totalPrice ?? null,
        totalPriceSll:
          b.pricing?.totalPrice != null ? Math.round(b.pricing.totalPrice * rate) : null,
        ownerPayout: isManager ? null : b.ownerPayoutAmount ?? null,
        ownerPayoutSll:
          isManager ? null : b.ownerPayoutAmount != null ? Math.round(b.ownerPayoutAmount * rate) : null,
        paidCurrency: paymentCurrencies,
        teamA: b.teamA?.team?.name || '',
        teamB: b.teamB?.team?.name || '',
        captainA: b.teamA?.captain?.name || '',
        captainB: b.teamB?.captain?.name || '',
      };
    }),
  };
}

function emptyReports({ days, isManager, showCommission = false }) {
  return {
    days,
    from: null,
    to: null,
    todayBookings: 0,
    pendingPayout: 0,
    totalBookings: 0,
    sllPerUsd: 8500,
    grossBooked: isManager ? null : 0,
    grossBookedSll: isManager ? null : 0,
    revenueSettled: isManager ? null : 0,
    revenueSettledSll: isManager ? null : 0,
    currencyBreakdown: { countPaidUsd: 0, countPaidSll: 0, totalPaidUsd: 0, totalPaidSll: 0 },
    commissionTotal: showCommission ? 0 : null,
    avgRating: 0,
    reviewCount: 0,
    bookingsByDay: [],
    revenueByDay: [],
    bookingsByWeek: [],
    bookingsByMonth: [],
    bookingsByHour: [],
    bookingsByStatus: [],
    byField: [],
    captains: [],
    stadiums: [],
    fieldsCount: 0,
    rows: [],
  };
}

async function buildExportBuffer(user, query = {}) {
  const reports = await buildOwnerReports(user, query);
  const format = String(query.format || 'xlsx').toLowerCase();
  if (format === 'pdf') {
    return { buffer: await renderPdf(reports), contentType: 'application/pdf', ext: 'pdf' };
  }
  return {
    buffer: await renderXlsx(reports),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  };
}

async function renderXlsx(reports) {
  let ExcelJS;
  try {
    ExcelJS = require('exceljs');
  } catch {
    throw ApiError.badRequest('Excel export requires exceljs — run npm install exceljs in server/');
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'E-Garoon';
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['E-Garoon — Owner Report']);
  summary.addRow(['From', reports.from]);
  summary.addRow(['To', reports.to]);
  summary.addRow(['Total bookings', reports.totalBookings]);
  summary.addRow(['Revenue settled', reports.revenueSettled ?? '—']);
  summary.addRow(['Gross booked', reports.grossBooked ?? '—']);
  if (reports.commissionTotal != null) {
    summary.addRow(['Commission', reports.commissionTotal]);
  }
  summary.addRow([]);
  summary.addRow(['Captains', 'Bookings']);
  for (const c of reports.captains || []) {
    summary.addRow([c.name, c.bookings]);
  }

  const daily = wb.addWorksheet('Daily');
  daily.addRow(['Date', 'Bookings', 'Revenue']);
  for (const r of reports.bookingsByDay || []) {
    daily.addRow([r.date, r.count, r.revenue ?? '']);
  }

  const hours = wb.addWorksheet('By hour');
  hours.addRow(['Hour', 'Bookings']);
  for (const r of reports.bookingsByHour || []) {
    hours.addRow([r.hour, r.count]);
  }

  const detail = wb.addWorksheet('Bookings');
  detail.addRow([
    'Stadium',
    'Field',
    'Start',
    'End',
    'Status',
    'Total',
    'Payout',
    'Team A',
    'Team B',
    'Captain A',
    'Captain B',
  ]);
  for (const r of reports.rows || []) {
    detail.addRow([
      r.stadium,
      r.field,
      r.startTime ? new Date(r.startTime).toISOString() : '',
      r.endTime ? new Date(r.endTime).toISOString() : '',
      r.status,
      r.totalPrice,
      r.ownerPayout,
      r.teamA,
      r.teamB,
      r.captainA,
      r.captainB,
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function renderPdf(reports) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw ApiError.badRequest('PDF export requires pdfkit — run npm install pdfkit in server/');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('E-Garoon — Warbixin', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444');
    doc.text(`Muddo: ${reports.from || '—'} → ${reports.to || '—'}`);
    doc.text(`Ballamo: ${reports.totalBookings}`);
    if (reports.revenueSettled != null) {
      doc.text(`Dakhli (settled): $${Number(reports.revenueSettled).toFixed(2)}`);
    }
    if (reports.grossBooked != null) {
      doc.text(`Qiimaha ballan: $${Number(reports.grossBooked).toFixed(2)}`);
    }
    doc.moveDown();

    doc.fillColor('#000').fontSize(12).text('Saacadaha la ballansaday');
    doc.fontSize(9).fillColor('#333');
    for (const r of (reports.bookingsByHour || []).filter((x) => x.count > 0)) {
      doc.text(`${r.hour}  ${'█'.repeat(Math.min(20, r.count))} ${r.count}`);
    }
    doc.moveDown();

    doc.fillColor('#000').fontSize(12).text('Captains');
    doc.fontSize(9).fillColor('#333');
    for (const c of (reports.captains || []).slice(0, 15)) {
      doc.text(`${c.name} — ${c.bookings} ballan`);
    }
    doc.moveDown();

    doc.fillColor('#000').fontSize(12).text('Ballamo (ugu horreeya 40)');
    doc.fontSize(8).fillColor('#333');
    for (const r of (reports.rows || []).slice(0, 40)) {
      const when = r.startTime ? new Date(r.startTime).toLocaleString() : '';
      doc.text(
        `${when} · ${r.stadium}/${r.field} · ${r.teamA} vs ${r.teamB || '—'} · ${r.status} · $${r.totalPrice ?? '—'}`
      );
    }

    doc.end();
  });
}

/**
 * Slot utilization for owner/manager.
 *
 * Definitions (aligned with public slot grid):
 * - bookableSlots: hourly open→close slots that are not blocked/recurring-locked
 * - bookedSlots: bookable slots overlapping a CONFIRMED+ (paid/locked) booking
 * - heldSlots: bookable future/current slots under active HELD / Team-B wait
 * - availableRemaining: future bookable slots with no live booking lock
 * - lostSlots: past bookable slots with no CONFIRMED+ booking (empty / expired hold / cancelled)
 * - utilizationPercent: bookedSlots / (bookedSlots + lostSlots) for past bookable inventory
 * - unbookedDays: calendar days (per field) where past bookable slots > 0 and bookedSlots === 0
 */
async function buildSlotReports(user, query = {}) {
  const stadiumIds = await resolveScopedStadiumIds(user, query.stadiumId);
  if (stadiumIds.length === 0) {
    return emptySlotReports();
  }

  const days = Math.min(Math.max(Number(query.days) || 14, 1), 90);
  let since = parseDateBound(query.from);
  let until = parseDateBound(query.to, true);
  if (!since) {
    since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
  }
  if (!until) {
    until = new Date();
    until.setHours(23, 59, 59, 999);
  }

  // Cap range to 90 calendar days for report cost
  const maxSpan = 90 * 24 * 60 * 60 * 1000;
  if (until - since > maxSpan) {
    since = new Date(until.getTime() - maxSpan);
    since.setHours(0, 0, 0, 0);
  }

  const now = Date.now();
  const fields = await Field.find({
    stadium: { $in: stadiumIds },
    status: { $ne: 'inactive' },
  }).select('name stadium openingTime closingTime slotDurationMinutes type');

  const stadiums = await Stadium.find({ _id: { $in: stadiumIds } }).select('name');
  const stadiumNameById = Object.fromEntries(stadiums.map((s) => [String(s._id), s.name]));

  if (fields.length === 0) {
    return {
      ...emptySlotReports(),
      from: since.toISOString(),
      to: until.toISOString(),
      stadiums: stadiums.map((s) => ({ id: s._id, name: s.name })),
    };
  }

  const fieldIds = fields.map((f) => f._id);
  const rangeStart = new Date(since);
  const rangeEnd = new Date(until);

  const [bookings, blocks, recurring] = await Promise.all([
    Booking.find({
      field: { $in: fieldIds },
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
      status: {
        $in: [
          BOOKING_STATUS.HELD,
          BOOKING_STATUS.PAYMENT_PENDING,
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.CHECKED_IN,
          BOOKING_STATUS.IN_PROGRESS,
          BOOKING_STATUS.COMPLETED,
          BOOKING_STATUS.SETTLED,
        ],
      },
    }).select(
      'field stadium startTime endTime status holdExpiresAt teamBPaymentDueAt teamAPaidAt coveredFullMatch createdAt teamA.paymentStatus teamA.paymentDeadline teamB.paymentStatus teamB.paymentDeadline'
    ),
    AvailabilityBlock.find({
      startsAt: { $lt: rangeEnd },
      endsAt: { $gt: rangeStart },
      $or: [
        { field: { $in: fieldIds } },
        { scope: 'stadium', stadium: { $in: stadiumIds } },
      ],
    }),
    RecurringBooking.find({
      field: { $in: fieldIds },
      status: 'active',
      startDate: { $lte: rangeEnd },
      $or: [{ endDate: null }, { endDate: { $gte: rangeStart } }],
    }),
  ]);

  const bookingsByField = groupById(bookings, 'field');
  const blocksByField = {};
  for (const b of blocks) {
    if (b.scope === 'stadium') {
      for (const f of fields) {
        if (String(f.stadium) === String(b.stadium)) {
          const k = String(f._id);
          if (!blocksByField[k]) blocksByField[k] = [];
          blocksByField[k].push(b);
        }
      }
    } else if (b.field) {
      const k = String(b.field);
      if (!blocksByField[k]) blocksByField[k] = [];
      blocksByField[k].push(b);
    }
  }
  const recurringByField = groupById(recurring, 'field');

  const totals = {
    totalSlots: 0,
    bookableSlots: 0,
    bookedSlots: 0,
    pastBookedSlots: 0,
    heldSlots: 0,
    availableRemaining: 0,
    lostSlots: 0,
    blockedSlots: 0,
  };
  const byField = [];
  const byDayMap = {};
  const unbookedDays = [];
  const lostExamples = [];

  for (const field of fields) {
    const fid = String(field._id);
    const fieldBookings = bookingsByField[fid] || [];
    const fieldBlocks = blocksByField[fid] || [];
    const fieldRecurring = recurringByField[fid] || [];
    const fieldStats = {
      fieldId: field._id,
      fieldName: field.name,
      stadiumId: field.stadium,
      stadiumName: stadiumNameById[String(field.stadium)] || '',
      bookableSlots: 0,
      bookedSlots: 0,
      pastBookedSlots: 0,
      heldSlots: 0,
      availableRemaining: 0,
      lostSlots: 0,
      blockedSlots: 0,
      utilizationPercent: 0,
      unbookedDays: 0,
    };

    const dayCursor = new Date(since);
    dayCursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(until);
    lastDay.setHours(0, 0, 0, 0);

    while (dayCursor <= lastDay) {
      const dateKey = toYmdLocal(dayCursor);
      if (!byDayMap[dateKey]) {
        byDayMap[dateKey] = {
          date: dateKey,
          bookable: 0,
          booked: 0,
          held: 0,
          available: 0,
          lost: 0,
          blocked: 0,
        };
      }

      const daySlots = buildDaySlotStates({
        field,
        day: dayCursor,
        bookings: fieldBookings,
        blocks: fieldBlocks,
        recurring: fieldRecurring,
        now,
      });

      let dayBookablePast = 0;
      let dayBookedPast = 0;

      for (const slot of daySlots) {
        totals.totalSlots += 1;
        byDayMap[dateKey].blocked += slot.state === 'blocked' ? 1 : 0;
        if (slot.state === 'blocked') {
          fieldStats.blockedSlots += 1;
          totals.blockedSlots += 1;
          continue;
        }

        fieldStats.bookableSlots += 1;
        totals.bookableSlots += 1;
        byDayMap[dateKey].bookable += 1;

        if (slot.state === 'booked') {
          fieldStats.bookedSlots += 1;
          totals.bookedSlots += 1;
          byDayMap[dateKey].booked += 1;
          if (slot.past) {
            fieldStats.pastBookedSlots += 1;
            totals.pastBookedSlots += 1;
            dayBookablePast += 1;
            dayBookedPast += 1;
          }
        } else if (slot.state === 'held' && !slot.past) {
          fieldStats.heldSlots += 1;
          totals.heldSlots += 1;
          byDayMap[dateKey].held += 1;
        } else if (slot.past && slot.state !== 'booked') {
          fieldStats.lostSlots += 1;
          totals.lostSlots += 1;
          byDayMap[dateKey].lost += 1;
          dayBookablePast += 1;
            if (lostExamples.length < 40) {
            lostExamples.push({
              fieldId: field._id,
              fieldName: field.name,
              stadiumName: fieldStats.stadiumName,
              date: dateKey,
              startTime: slot.startTime,
              endTime: slot.endTime,
              reason: slot.state === 'held' ? 'EXPIRED_HOLD' : 'UNBOOKED',
            });
          }
        } else {
          fieldStats.availableRemaining += 1;
          totals.availableRemaining += 1;
          byDayMap[dateKey].available += 1;
        }
      }

      if (dayBookablePast > 0 && dayBookedPast === 0) {
        fieldStats.unbookedDays += 1;
        unbookedDays.push({
          date: dateKey,
          fieldId: field._id,
          fieldName: field.name,
          stadiumId: field.stadium,
          stadiumName: fieldStats.stadiumName,
          lostSlots: dayBookablePast,
        });
      }

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const pastDenom = fieldStats.pastBookedSlots + fieldStats.lostSlots;
    fieldStats.utilizationPercent =
      pastDenom > 0 ? Math.round((fieldStats.pastBookedSlots / pastDenom) * 1000) / 10 : 0;
    byField.push(fieldStats);
  }

  const pastDenom = totals.pastBookedSlots + totals.lostSlots;
  const utilizationPercent =
    pastDenom > 0 ? Math.round((totals.pastBookedSlots / pastDenom) * 1000) / 10 : 0;

  // Booking history for the same window (scoped)
  const history = await Booking.find({
    stadium: { $in: stadiumIds },
    startTime: { $gte: since, $lte: until },
  })
    .select('status startTime endTime field stadium pricing teamA teamB coveredFullMatch createdAt')
    .populate('field', 'name')
    .populate('stadium', 'name')
    .populate('teamA.captain', 'name phone')
    .populate('teamB.captain', 'name phone')
    .populate('teamA.team', 'name')
    .populate('teamB.team', 'name')
    .sort({ startTime: -1 })
    .limit(100)
    .lean();

  return {
    from: since.toISOString(),
    to: until.toISOString(),
    generatedAt: new Date().toISOString(),
    definitions: {
      lostSlots:
        'Past open hours with no CONFIRMED+ booking (includes empty slots and expired/cancelled holds). Blocked/recurring locks are excluded.',
      availableRemaining: 'Future open hours not held and not booked.',
      utilizationPercent: 'pastBookedSlots / (pastBookedSlots + lostSlots) × 100.',
      unbookedDays: 'Field-days where every past bookable slot was empty (no paid booking).',
    },
    totals: {
      ...totals,
      utilizationPercent,
      unbookedDayCount: unbookedDays.length,
    },
    byDay: Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date)),
    byField: byField.sort((a, b) => b.lostSlots - a.lostSlots),
    unbookedDays: unbookedDays.sort((a, b) => a.date.localeCompare(b.date)),
    lostExamples,
    bookingHistory: history.map((b) => ({
      id: b._id,
      stadium: b.stadium?.name || '',
      field: b.field?.name || '',
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      totalPrice: b.pricing?.totalPrice ?? null,
      teamA: b.teamA?.team?.name || '',
      teamB: b.teamB?.team?.name || '',
      captainA: b.teamA?.captain?.name || '',
      captainB: b.teamB?.captain?.name || '',
      createdAt: b.createdAt,
    })),
    stadiums: stadiums.map((s) => ({ id: s._id, name: s.name })),
  };
}

function emptySlotReports() {
  return {
    from: null,
    to: null,
    generatedAt: new Date().toISOString(),
    definitions: {},
    totals: {
      totalSlots: 0,
      bookableSlots: 0,
      bookedSlots: 0,
      pastBookedSlots: 0,
      heldSlots: 0,
      availableRemaining: 0,
      lostSlots: 0,
      blockedSlots: 0,
      utilizationPercent: 0,
      unbookedDayCount: 0,
    },
    byDay: [],
    byField: [],
    unbookedDays: [],
    lostExamples: [],
    bookingHistory: [],
    stadiums: [],
  };
}

function groupById(docs, key) {
  const map = {};
  for (const d of docs) {
    const id = String(d[key]?._id || d[key]);
    if (!map[id]) map[id] = [];
    map[id].push(d);
  }
  return map;
}

function toYmdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHHMM(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return fallback;
  return { h, m: Number.isNaN(m) ? 0 : m };
}

/**
 * Build slot states for one field-day (mirrors slot.service hourly grid).
 * Uses local wall clock like owner date filters (not UTC-only).
 */
function buildDaySlotStates({ field, day, bookings, blocks, recurring, now }) {
  const open = parseHHMM(field.openingTime || '06:00', { h: 6, m: 0 });
  const close = parseHHMM(field.closingTime || '23:00', { h: 23, m: 0 });
  const durationMin = Math.max(30, Number(field.slotDurationMinutes) || 60);

  const dayStart = new Date(day);
  dayStart.setHours(open.h, open.m, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(close.h, close.m, 0, 0);

  const dayOfWeek = dayStart.getDay();
  const slots = [];
  const cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setMinutes(end.getMinutes() + durationMin);
    if (end > dayEnd) break;

    const past = start.getTime() <= now;
    let state = 'available';

    const block = blocks.find((b) => b.startsAt < end && b.endsAt > start);
    if (block) {
      state = 'blocked';
    } else {
      const rec = recurring.find((r) => {
        if (r.dayOfWeek !== dayOfWeek) return false;
        const [sh, sm] = String(r.startTimeLocal || '00:00').split(':').map(Number);
        const [eh, em] = String(r.endTimeLocal || '00:00').split(':').map(Number);
        const recStart = new Date(day);
        recStart.setHours(sh, sm || 0, 0, 0);
        const recEnd = new Date(day);
        recEnd.setHours(eh, em || 0, 0, 0);
        return recStart < end && recEnd > start;
      });
      if (rec) {
        state = 'blocked';
      } else {
        const booking = bookings.find((b) => b.startTime < end && b.endTime > start);
        if (booking) {
          if (BOOKED_STATUSES.includes(booking.status) || booking.status === BOOKING_STATUS.SETTLED) {
            state = 'booked';
          } else {
            const classified = classifyBookingSlot(booking);
            if (classified.state === 'booked') state = 'booked';
            else if (classified.state === 'selected') state = 'held';
            else state = 'available';
          }
        }
      }
    }

    slots.push({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      state,
      past,
    });

    cursor.setMinutes(cursor.getMinutes() + durationMin);
  }

  return slots;
}

module.exports = {
  buildOwnerReports,
  buildExportBuffer,
  buildSlotReports,
};
