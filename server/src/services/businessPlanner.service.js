const Field = require('../models/Field');
const Stadium = require('../models/Stadium');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { calculatePrice, calculateCommission } = require('./pricing.service');
const { getBusiness } = require('./platformSettings.service');
const profitReportService = require('./profitReport.service');
const { evaluateExpression, assertFinitePercent, assertFiniteNumber } = require('../utils/safeMath');

const BANDS = ['morning', 'afternoon', 'evening', 'night'];

const DEFAULT_MULTIPLIERS = {
  morning: 1,
  afternoon: 1,
  evening: 1.5,
  night: 1.7,
};

const DEFAULT_OCCUPANCY = {
  morning: 20,
  afternoon: 35,
  evening: 55,
  night: 40,
};

const LIVE_BOOKING = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.SETTLED,
];

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function parseMinutes(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return fallback;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function bandOfMinutes(totalMin) {
  const m = ((totalMin % 1440) + 1440) % 1440;
  if (m >= 6 * 60 && m < 12 * 60) return 'morning';
  if (m >= 12 * 60 && m < 17 * 60) return 'afternoon';
  if (m >= 17 * 60 && m < 21 * 60) return 'evening';
  return 'night';
}

function bandOfHour(hour) {
  const h = Number(hour);
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function slotsForField(field) {
  const open = parseMinutes(field.openingTime, 6 * 60);
  let close = parseMinutes(field.closingTime, 23 * 60);
  const dur = Math.max(15, Number(field.slotDurationMinutes) || 60);
  if (close <= open) close += 1440;
  const slots = [];
  for (let t = open; t + dur <= close; t += dur) {
    slots.push({ startMin: ((t % 1440) + 1440) % 1440, band: bandOfMinutes(t) });
  }
  return slots;
}

function median(nums) {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : roundMoney((arr[mid - 1] + arr[mid]) / 2);
}

function clampPct(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

function formulaVars(projection, scenario, inventory) {
  return {
    gmv: projection.gmv,
    commission: projection.commission,
    ownerPayout: projection.ownerPayout,
    subscription: projection.subscription,
    profit: projection.profit,
    bookings: projection.bookings,
    occupancy: projection.avgOccupancy,
    commissionPercent: scenario.commissionPercent,
    subscriptionAmount: scenario.subscriptionAmount,
    fields: inventory.activeFields + scenario.extraFields,
    stadiums: inventory.stadiums + scenario.extraStadiums,
    morningGmv: projection.byBand.morning.gmv,
    afternoonGmv: projection.byBand.afternoon.gmv,
    eveningGmv: projection.byBand.evening.gmv,
    nightGmv: projection.byBand.night.gmv,
    days: scenario.days,
  };
}

function emptyBandRow() {
  return { slotsPerDay: 0, bookings: 0, gmv: 0, commission: 0 };
}

async function loadInventory(geoStadiumIds) {
  const stadiumFilter = geoStadiumIds ? { _id: { $in: geoStadiumIds } } : {};
  const stadiums = await Stadium.find(stadiumFilter).select('name city region openingTime closingTime').lean();
  const stadiumIds = stadiums.map((s) => s._id);
  if (!stadiumIds.length) {
    return {
      stadiums: 0,
      fieldCount: 0,
      activeFields: 0,
      priceMin: 0,
      priceMax: 0,
      priceMedian: 0,
      all: [],
      active: [],
    };
  }
  const fields = await Field.find({ stadium: { $in: stadiumIds } })
    .select(
      'name type capacity pricingMode pricePerPlayer fixedPrice currency openingTime closingTime slotDurationMinutes status isOnline stadium'
    )
    .lean();

  const stadiumById = new Map(stadiums.map((s) => [String(s._id), s]));
  const rows = [];
  const prices = [];

  for (const field of fields) {
    const stadium = stadiumById.get(String(field.stadium)) || {};
    let price;
    try {
      price = calculatePrice(field);
    } catch {
      continue;
    }
    const slots = slotsForField({
      openingTime: field.openingTime || stadium.openingTime,
      closingTime: field.closingTime || stadium.closingTime,
      slotDurationMinutes: field.slotDurationMinutes,
    });
    const slotsByBand = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const slot of slots) slotsByBand[slot.band] += 1;
    prices.push(price.totalPrice);
    rows.push({
      fieldId: String(field._id),
      fieldName: field.name,
      stadiumId: String(field.stadium),
      stadiumName: stadium.name || '',
      city: stadium.city || null,
      type: field.type,
      pricingMode: field.pricingMode,
      baseTotal: roundMoney(price.totalPrice),
      teamShare: roundMoney(price.teamShare),
      unitPrice: roundMoney(price.unitPrice),
      currency: price.currency || 'USD',
      active: field.status === 'active' && field.isOnline !== false,
      slotsPerDay: slots.length,
      slotsByBand,
    });
  }

  const active = rows.filter((r) => r.active);
  return {
    stadiums: stadiums.length,
    fieldCount: rows.length,
    activeFields: active.length,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    priceMedian: median(prices),
    all: rows,
    active,
  };
}

async function observedOccupancy({ from, to, fields, spanDays }) {
  const byBand = {
    morning: { bookings: 0, capacity: 0, occupancyPct: 0 },
    afternoon: { bookings: 0, capacity: 0, occupancyPct: 0 },
    evening: { bookings: 0, capacity: 0, occupancyPct: 0 },
    night: { bookings: 0, capacity: 0, occupancyPct: 0 },
  };
  const days = Math.max(1, spanDays);
  for (const f of fields) {
    for (const band of BANDS) {
      byBand[band].capacity += (f.slotsByBand[band] || 0) * days;
    }
  }

  const fieldIds = fields.map((f) => f.fieldId).filter(Boolean);
  if (!fieldIds.length) return byBand;

  const bookings = await Booking.find({
    field: { $in: fieldIds },
    startTime: { $gte: from, $lte: to },
    status: { $in: LIVE_BOOKING },
  })
    .select('startTime')
    .lean();

  for (const b of bookings) {
    const band = bandOfHour(new Date(b.startTime).getHours());
    byBand[band].bookings += 1;
  }
  for (const band of BANDS) {
    const cap = byBand[band].capacity;
    byBand[band].occupancyPct = cap > 0 ? roundMoney((byBand[band].bookings / cap) * 100) : 0;
  }
  return byBand;
}

function normalizeScenario(raw = {}, baseline) {
  const days = Math.round(assertFiniteNumber(raw.days ?? baseline.spanDays ?? 30, 'days', { min: 1, max: 366 }));
  const extraFields = Math.round(
    assertFiniteNumber(raw.extraFields ?? 0, 'extraFields', { min: 0, max: 500 })
  );
  const extraStadiums = Math.round(
    assertFiniteNumber(raw.extraStadiums ?? 0, 'extraStadiums', { min: 0, max: 200 })
  );
  const commissionPercent = assertFinitePercent(
    raw.commissionPercent ?? baseline.policy.platformCommissionPercent,
    'commissionPercent',
    { min: 0, max: 40 }
  );
  const subscriptionAmount = roundMoney(
    assertFiniteNumber(
      raw.subscriptionAmount ?? baseline.policy.fieldSubscriptionAmount ?? 0,
      'subscriptionAmount',
      { min: 0, max: 10000 }
    )
  );
  const subscriptionEnabled =
    raw.subscriptionEnabled == null
      ? Boolean(baseline.policy.fieldSubscriptionEnabled)
      : Boolean(raw.subscriptionEnabled);

  const multipliers = {};
  const occupancyByBand = {};
  for (const band of BANDS) {
    multipliers[band] = roundMoney(
      assertFiniteNumber(
        raw.multipliers?.[band] ?? DEFAULT_MULTIPLIERS[band],
        `${band} multiplier`,
        { min: 0, max: 10 }
      )
    );
    occupancyByBand[band] = clampPct(
      raw.occupancyByBand?.[band] ??
        (raw.occupancyPct != null ? raw.occupancyPct : DEFAULT_OCCUPANCY[band]),
      DEFAULT_OCCUPANCY[band]
    );
    assertFinitePercent(occupancyByBand[band], `${band} occupancy`);
  }

  const extraFieldBasePrice = roundMoney(
    assertFiniteNumber(
      raw.extraFieldBasePrice ?? baseline.inventory.priceMedian ?? 0,
      'extraFieldBasePrice',
      { min: 0, max: 100000 }
    )
  );

  const formula = String(raw.formula || '(commission + subscription) * 12').slice(0, 220);

  return {
    days,
    extraFields,
    extraStadiums,
    extraFieldBasePrice,
    commissionPercent,
    subscriptionAmount,
    subscriptionEnabled,
    multipliers,
    occupancyByBand,
    occupancyPct: raw.occupancyPct != null ? clampPct(raw.occupancyPct, null) : null,
    formula,
  };
}

function projectField(field, scenario) {
  const byBand = {};
  let bookings = 0;
  let gmv = 0;
  for (const band of BANDS) {
    const slots = field.slotsByBand[band] || 0;
    const occ = scenario.occupancyByBand[band] / 100;
    const price = roundMoney(field.baseTotal * scenario.multipliers[band]);
    const expected = slots * occ * scenario.days;
    const bandGmv = roundMoney(expected * price);
    byBand[band] = {
      slotsPerDay: slots,
      occupancyPct: scenario.occupancyByBand[band],
      slotPrice: price,
      bookings: roundMoney(expected),
      gmv: bandGmv,
    };
    bookings += expected;
    gmv += bandGmv;
  }
  const { commissionAmount, ownerPayoutAmount } = calculateCommission(gmv, scenario.commissionPercent);
  return {
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    stadiumName: field.stadiumName,
    city: field.city,
    type: field.type,
    baseTotal: field.baseTotal,
    bookings: roundMoney(bookings),
    gmv: roundMoney(gmv),
    commission: commissionAmount,
    ownerPayout: ownerPayoutAmount,
    byBand,
  };
}

function syntheticField(scenario) {
  const slotsByBand = { morning: 3, afternoon: 5, evening: 4, night: 2 };
  return {
    fieldId: 'extra',
    fieldName: 'New field (plan)',
    stadiumName: 'New stadium (plan)',
    city: null,
    type: '7v7',
    pricingMode: 'fixed',
    baseTotal: scenario.extraFieldBasePrice,
    teamShare: roundMoney(scenario.extraFieldBasePrice / 2),
    unitPrice: scenario.extraFieldBasePrice,
    currency: 'USD',
    active: true,
    slotsPerDay: 14,
    slotsByBand,
  };
}

function buildInsights({ baseline, scenario, projection, comparison }) {
  const items = [];
  const inv = baseline.inventory;
  if (inv.priceMax - inv.priceMin > 0.009) {
    items.push({
      tone: 'info',
      title: 'Stadiums do not share one fee',
      body: `Active match totals run from $${inv.priceMin.toFixed(2)} to $${inv.priceMax.toFixed(2)} (median $${inv.priceMedian.toFixed(2)}). Evening multipliers apply on each field’s own base, not a flat $1.`,
    });
  } else if (inv.activeFields) {
    items.push({
      tone: 'warn',
      title: 'Little price spread',
      body: 'Most fields share a similar match total. Evening vs afternoon will only move profit if you raise the evening multiplier or add higher-priced fields.',
    });
  }

  const aft = scenario.multipliers.afternoon || 1;
  const eve = scenario.multipliers.evening;
  if (aft > 0 && eve !== aft) {
    const lift = roundMoney(((eve - aft) / aft) * 100);
    items.push({
      tone: lift > 0 ? 'good' : 'warn',
      title: `Evening is ${lift > 0 ? '+' : ''}${lift}% vs afternoon`,
      body: `Example: afternoon $${(1 * aft).toFixed(2)} → evening $${(1 * eve).toFixed(2)} on a $1 base. On a $${inv.priceMedian.toFixed(2)} median field that is $${roundMoney(inv.priceMedian * aft).toFixed(2)} vs $${roundMoney(inv.priceMedian * eve).toFixed(2)} per booked slot.`,
    });
  }

  const bandOrder = BANDS.map((band) => ({
    band,
    gmv: projection.byBand[band].gmv,
    commission: projection.byBand[band].commission,
  })).sort((a, b) => b.gmv - a.gmv);
  const top = bandOrder[0];
  if (top && top.gmv > 0) {
    items.push({
      tone: 'good',
      title: `Best window: ${top.band}`,
      body: `${top.band} carries $${top.gmv.toFixed(2)} GMV and $${top.commission.toFixed(2)} commission in this plan. Protect occupancy there before adding morning slots.`,
    });
  }

  const pctPoint = roundMoney(projection.gmv * 0.01);
  items.push({
    tone: 'info',
    title: `1 point of commission ≈ $${pctPoint.toFixed(2)}`,
    body: `Policy is ${scenario.commissionPercent}%. Moving to ${scenario.commissionPercent + 1}% would add about $${pctPoint.toFixed(2)} on this occupancy. Owner payout moves the other way.`,
  });

  if (scenario.subscriptionEnabled) {
    const months = Math.max(1, Math.round(scenario.days / 30));
    items.push({
      tone: 'info',
      title: 'Subscription is inventory, not occupancy',
      body: `${projection.fieldCount} fields × $${scenario.subscriptionAmount.toFixed(2)} × ${months} mo = $${projection.subscription.toFixed(2)}. Empty pitches still owe the field fee.`,
    });
  } else {
    items.push({
      tone: 'warn',
      title: 'Field subscription is off',
      body: 'Profit in this plan is commission only. Turn subscription on in Platform Settings (or this scenario) to model the $7/field/month style fee.',
    });
  }

  if (comparison && comparison.actualCollected > 0) {
    const gap = roundMoney(projection.gmv - comparison.actualCollected);
    const gapPct = roundMoney((gap / comparison.actualCollected) * 100);
    items.push({
      tone: gap >= 0 ? 'good' : 'warn',
      title: gap >= 0 ? 'Plan is above actual GMV' : 'Plan is below actual GMV',
      body: `Actual collected $${comparison.actualCollected.toFixed(2)} vs planned GMV $${projection.gmv.toFixed(2)} (${gapPct > 0 ? '+' : ''}${gapPct}%). Use observed occupancy if you want the plan to track the last period.`,
    });
  }

  if (projection.formula?.ok) {
    items.push({
      tone: 'good',
      title: 'Custom formula result',
      body: `${scenario.formula} = ${roundMoney(projection.formula.value).toFixed(2)}. Names: gmv, commission, subscription, profit, bookings, occupancy, fields, afternoonGmv, eveningGmv.`,
    });
  } else if (projection.formula && !projection.formula.ok) {
    items.push({
      tone: 'warn',
      title: 'Formula did not run',
      body: projection.formula.error,
    });
  }

  return items;
}

async function runPlan(query = {}, rawScenario = {}) {
  const { period, from, to } = profitReportService.resolvePeriodRange(query);
  const geo = await profitReportService.resolveStadiumGeoFilter(query);
  if (geo.stadiumIds && geo.stadiumIds.length === 0) {
    throw ApiError.badRequest('No stadiums match that city/region');
  }

  const spanDays = Math.max(1, Math.round((to - from) / 86400000) + 1);
  const business = getBusiness();
  const inventoryPack = await loadInventory(geo.stadiumIds);
  const profit = await profitReportService.buildProfitReport(query);
  const observed = await observedOccupancy({
    from,
    to,
    fields: inventoryPack.active,
    spanDays,
  });

  const baseline = {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    spanDays,
    generatedAt: new Date().toISOString(),
    currency: 'USD',
    policy: {
      platformCommissionPercent: Number(business.platformCommissionPercent) || 4,
      fieldSubscriptionEnabled: Boolean(business.fieldSubscriptionEnabled),
      fieldSubscriptionAmount: Number(business.fieldSubscriptionAmount) || 0,
    },
    geo: profit.geo,
    geoOptions: profit.geoOptions,
    inventory: {
      stadiums: inventoryPack.stadiums,
      fields: inventoryPack.fieldCount,
      activeFields: inventoryPack.activeFields,
      priceMin: inventoryPack.priceMin,
      priceMax: inventoryPack.priceMax,
      priceMedian: inventoryPack.priceMedian,
    },
    actuals: {
      bookingCount: profit.totals.bookingCount,
      collected: profit.totals.collected,
      commission: profit.totals.commission,
      subscriptionPaid: profit.totals.subscriptionPaid,
      subscriptionOwed: profit.totals.subscriptionOwed,
      profit: profit.totals.profit,
    },
    observedOccupancy: observed,
    fields: inventoryPack.active,
  };

  const suggestedOccupancy = {};
  for (const band of BANDS) {
    const seen = observed[band]?.occupancyPct || 0;
    suggestedOccupancy[band] = seen > 0 ? seen : DEFAULT_OCCUPANCY[band];
  }

  const scenario = normalizeScenario(
    {
      days: spanDays,
      occupancyByBand: suggestedOccupancy,
      ...rawScenario,
      occupancyByBand:
        rawScenario.occupancyPct != null && rawScenario.occupancyPct !== ''
          ? undefined
          : { ...suggestedOccupancy, ...(rawScenario.occupancyByBand || {}) },
      multipliers: { ...DEFAULT_MULTIPLIERS, ...(rawScenario.multipliers || {}) },
    },
    baseline
  );

  const workFields = inventoryPack.active.map((f) => f);
  for (let i = 0; i < scenario.extraFields; i += 1) {
    workFields.push({
      ...syntheticField(scenario),
      fieldId: `extra-${i + 1}`,
      fieldName: `New field ${i + 1}`,
    });
  }

  const fieldRows = workFields.map((f) => projectField(f, scenario));
  const byBand = {
    morning: emptyBandRow(),
    afternoon: emptyBandRow(),
    evening: emptyBandRow(),
    night: emptyBandRow(),
  };
  let gmv = 0;
  let bookings = 0;
  let slotCapacity = 0;
  let weightedOcc = 0;

  for (const row of fieldRows) {
    gmv += row.gmv;
    bookings += row.bookings;
    for (const band of BANDS) {
      const b = row.byBand[band];
      byBand[band].slotsPerDay += b.slotsPerDay;
      byBand[band].bookings += b.bookings;
      byBand[band].gmv += b.gmv;
    }
  }

  for (const band of BANDS) {
    byBand[band].gmv = roundMoney(byBand[band].gmv);
    byBand[band].bookings = roundMoney(byBand[band].bookings);
    byBand[band].commission = calculateCommission(byBand[band].gmv, scenario.commissionPercent).commissionAmount;
    const cap = byBand[band].slotsPerDay * scenario.days;
    slotCapacity += cap;
    weightedOcc += cap * (scenario.occupancyByBand[band] / 100);
  }

  gmv = roundMoney(gmv);
  bookings = roundMoney(bookings);
  const { commissionAmount, ownerPayoutAmount } = calculateCommission(gmv, scenario.commissionPercent);
  const months = Math.max(1, scenario.days / 30);
  const fieldCount = workFields.length;
  const subscription = scenario.subscriptionEnabled
    ? roundMoney(fieldCount * scenario.subscriptionAmount * months)
    : 0;
  const profitAmt = roundMoney(commissionAmount + subscription);
  const avgOccupancy = slotCapacity > 0 ? roundMoney((weightedOcc / slotCapacity) * 100) : 0;

  const projection = {
    fieldCount,
    bookings,
    gmv,
    commission: commissionAmount,
    ownerPayout: ownerPayoutAmount,
    subscription,
    profit: profitAmt,
    avgOccupancy,
    byBand,
    fields: fieldRows.sort((a, b) => b.gmv - a.gmv),
  };

  const formula = evaluateExpression(scenario.formula, formulaVars(projection, scenario, baseline.inventory));
  projection.formula = formula.ok
    ? { ok: true, value: roundMoney(formula.value) }
    : { ok: false, error: formula.error, value: null };

  const comparison = {
    actualCollected: baseline.actuals.collected,
    actualCommission: baseline.actuals.commission,
    actualProfit: baseline.actuals.profit,
    plannedGmv: projection.gmv,
    plannedCommission: projection.commission,
    plannedProfit: projection.profit,
    gmvDelta: roundMoney(projection.gmv - baseline.actuals.collected),
    commissionDelta: roundMoney(projection.commission - baseline.actuals.commission),
    profitDelta: roundMoney(projection.profit - baseline.actuals.profit),
  };

  return {
    baseline: {
      ...baseline,
      defaults: {
        multipliers: DEFAULT_MULTIPLIERS,
        occupancyByBand: DEFAULT_OCCUPANCY,
        suggestedOccupancy,
        formula: '(commission + subscription) * 12',
        bandHours: {
          morning: '06:00–12:00',
          afternoon: '12:00–17:00',
          evening: '17:00–21:00',
          night: '21:00–06:00',
        },
      },
    },
    scenario,
    projection,
    comparison,
    insights: buildInsights({ baseline, scenario, projection, comparison }),
  };
}

module.exports = {
  runPlan,
  BANDS,
  DEFAULT_MULTIPLIERS,
  DEFAULT_OCCUPANCY,
};
