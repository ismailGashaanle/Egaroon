const Stadium = require('../models/Stadium');
const { attachLocation } = Stadium;
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const { FIELD_TYPES } = require('../constants/fieldFormats');
const { haversineKm } = require('../utils/geo');
const managerService = require('./manager.service');
const { ROLES } = require('../constants/roles');
const { getStadiumOpsStatus } = require('../utils/stadiumAvailability');
const { getFieldOpsStatus } = require('../utils/fieldAvailability');
const { classifyBookingSlot, LIVE_STATUSES } = require('./slot.service');
const { venueNow } = require('../utils/venueClock');

/** Fallback USD one-team share bands when the catalog is too thin for percentiles. */
const DEFAULT_PRICE_BANDS = { lowMax: 20, midMax: 40 };

/** “Hadda banaan” — at least one free hourly slot starting within this window. */
const AVAILABLE_NOW_LOOKAHEAD_MS = 3 * 60 * 60 * 1000;

const SORTS = new Set(['nearest', 'price_asc', 'price_desc', 'rating', 'newest']);
const PRICE_BANDS = new Set(['low', 'mid', 'high']);
const COMMON_FACILITIES = ['parking', 'lighting', 'showers', 'seating', 'changing_rooms', 'cafeteria'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function softMatch(value) {
  return { $regex: escapeRegex(value.trim()), $options: 'i' };
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(value) {
  if (value == null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
}

function parseHHMMToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Stadium is "open now" if current local clock (server TZ) is within opening–closing.
 * Overnight windows (e.g. 18:00–02:00) are supported.
 */
function isOpenAt(stadium, date = new Date()) {
  const openM = parseHHMMToMinutes(stadium.openingTime || '06:00');
  const closeM = parseHHMMToMinutes(stadium.closingTime || '23:00');
  if (openM == null || closeM == null) return true;
  const nowM = date.getHours() * 60 + date.getMinutes();
  if (openM === closeM) return true;
  if (closeM > openM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
}

/**
 * Effective one-team listing price — matches pricing.service / list display:
 * fixed → fixedPrice / 2; per_player → pricePerPlayer × capacity.
 */
function teamShareExpr() {
  return {
    $cond: [
      { $eq: ['$pricingMode', 'fixed'] },
      { $divide: ['$fixedPrice', 2] },
      { $multiply: ['$pricePerPlayer', '$capacity'] },
    ],
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Price bands from active field team-share prices.
 * Approach: if ≥6 distinct prices, use ~P33 / ~P66; else fixed USD defaults (≤20 / ≤40 / >40).
 */
async function resolvePriceBands() {
  const prices = await Field.aggregate([
    { $match: { status: 'active' } },
    { $project: { price: teamShareExpr() } },
    { $match: { price: { $gt: 0 } } },
    { $group: { _id: null, prices: { $addToSet: '$price' } } },
  ]);

  const values = (prices[0]?.prices || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (values.length >= 6) {
    const lowMax = Math.round(percentile(values, 0.33) * 100) / 100;
    const midMax = Math.round(percentile(values, 0.66) * 100) / 100;
    return {
      source: 'percentiles',
      lowMax,
      midMax,
      sampleSize: values.length,
    };
  }

  return {
    source: 'defaults',
    lowMax: DEFAULT_PRICE_BANDS.lowMax,
    midMax: DEFAULT_PRICE_BANDS.midMax,
    sampleSize: values.length,
  };
}

function bandRange(band, bands) {
  // Mid/high are exclusive of the lower threshold so bands don't overlap.
  if (band === 'low') return { min: null, max: bands.lowMax, minExclusive: false };
  if (band === 'mid') return { min: bands.lowMax, max: bands.midMax, minExclusive: true };
  if (band === 'high') return { min: bands.midMax, max: null, minExclusive: true };
  return { min: null, max: null, minExclusive: false };
}

async function buildOwnershipFilter(query, user) {
  const filter = {};
  const isStaff = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  if (query.mine === 'true' && user) {
    if (user.role === ROLES.STADIUM_OWNER) {
      const managedIds = await managerService.getManagedStadiumIds(user.id);
      filter.$or = [{ owner: user.id }, { _id: { $in: managedIds } }];
    } else if (user.role === ROLES.STADIUM_MANAGER) {
      const managedIds = await managerService.getManagedStadiumIds(user.id);
      filter._id = { $in: managedIds };
    } else {
      filter.owner = user.id;
    }
  } else if (isStaff) {
    if (query.status) filter.status = query.status;
  } else {
    filter.status = 'approved';
  }

  return filter;
}

function applyLocationFilters(filter, query) {
  const { city, region, area } = query;
  // `q` is the preferred alias; `search` kept for older clients.
  const searchRaw = (query.q || query.search || '').trim();

  if (city) filter.city = softMatch(city);
  if (region) filter.region = softMatch(region);

  if (area) {
    const areaOr = [{ area: softMatch(area) }, { region: softMatch(area) }];
    if (filter.$or) {
      filter.$and = [...(filter.$and || []), { $or: filter.$or }, { $or: areaOr }];
      delete filter.$or;
    } else {
      filter.$or = areaOr;
    }
  }

  if (searchRaw) {
    const q = softMatch(searchRaw);
    const searchOr = [{ name: q }, { city: q }, { area: q }, { region: q }];
    if (filter.$or || filter.$and) {
      filter.$and = [...(filter.$and || []), ...(filter.$or ? [{ $or: filter.$or }] : []), { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  const facilities = parseCsv(query.facilities);
  if (facilities.length) {
    // Case-insensitive facility match against stadium.facilities strings
    filter.$and = [
      ...(filter.$and || []),
      ...facilities.map((f) => ({
        facilities: softMatch(f),
      })),
    ];
  }

  return { filter, facilities };
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

function typeOrder(type) {
  const i = FIELD_TYPES.indexOf(type);
  return i < 0 ? 99 : i;
}

function normalizeSizePrices(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s) => ({
      type: s.type,
      price: roundMoney(s.price),
      count: Number(s.count || 0),
    }))
    .filter((s) => s.type)
    .sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
}

function mapsFromFieldSummary(rows) {
  const priceByStadium = new Map();
  const typesByStadium = new Map();
  const sizePricesByStadium = new Map();
  const fieldCountByStadium = new Map();
  for (const r of rows) {
    const id = r._id.toString();
    priceByStadium.set(id, roundMoney(r.startingPrice));
    const sizes = normalizeSizePrices(r.sizePrices);
    typesByStadium.set(id, sizes.map((s) => s.type));
    sizePricesByStadium.set(id, sizes);
    fieldCountByStadium.set(
      id,
      Number(r.fieldCount || sizes.reduce((n, s) => n + s.count, 0) || 0)
    );
  }
  return { priceByStadium, typesByStadium, sizePricesByStadium, fieldCountByStadium };
}

/** Group active fields: min one-team price + count per size (5v5, 7v7, …). */
const FIELD_SIZE_SUMMARY_STAGES = [
  {
    $group: {
      _id: { stadium: '$stadium', type: '$type' },
      minPrice: { $min: '$effectivePrice' },
      count: { $sum: 1 },
    },
  },
  {
    $group: {
      _id: '$_id.stadium',
      startingPrice: { $min: '$minPrice' },
      fieldCount: { $sum: '$count' },
      sizePrices: {
        $push: {
          type: '$_id.type',
          price: '$minPrice',
          count: '$count',
        },
      },
    },
  },
];

async function stadiumIdsMatchingFieldFilters({ types, minPrice, maxPrice, minExclusive }) {
  const match = { status: 'active' };
  if (types.length) {
    match.type = { $in: types.filter((t) => FIELD_TYPES.includes(t)) };
  }

  const pipeline = [
    { $match: match },
    { $project: { stadium: 1, effectivePrice: teamShareExpr(), type: 1 } },
  ];

  const priceMatch = {};
  if (minPrice != null) {
    if (minExclusive) priceMatch.$gt = minPrice;
    else priceMatch.$gte = minPrice;
  }
  if (maxPrice != null) priceMatch.$lte = maxPrice;
  if (Object.keys(priceMatch).length) {
    pipeline.push({ $match: { effectivePrice: priceMatch } });
  }

  pipeline.push({
    $group: {
      _id: '$stadium',
      startingPrice: { $min: '$effectivePrice' },
    },
  });

  const rows = await Field.aggregate(pipeline);
  return {
    ids: rows.map((r) => r._id),
    priceByStadium: new Map(
      rows.map((r) => [r._id.toString(), roundMoney(r.startingPrice)])
    ),
  };
}

async function attachStartingPrices(stadiumIds) {
  if (!stadiumIds.length) {
    return {
      priceByStadium: new Map(),
      typesByStadium: new Map(),
      sizePricesByStadium: new Map(),
      fieldCountByStadium: new Map(),
    };
  }
  const rows = await Field.aggregate([
    { $match: { stadium: { $in: stadiumIds }, status: 'active' } },
    {
      $project: {
        stadium: 1,
        type: 1,
        effectivePrice: teamShareExpr(),
      },
    },
    ...FIELD_SIZE_SUMMARY_STAGES,
  ]);
  return mapsFromFieldSummary(rows);
}

function sortStadiums(stadiums, sort, hasGeo) {
  const key = SORTS.has(sort) ? sort : hasGeo ? 'nearest' : 'newest';

  const copy = [...stadiums];
  if (key === 'nearest' && hasGeo) {
    copy.sort((a, b) => {
      const da = a.distanceKm == null ? Number.POSITIVE_INFINITY : a.distanceKm;
      const db = b.distanceKm == null ? Number.POSITIVE_INFINITY : b.distanceKm;
      return da - db;
    });
  } else if (key === 'price_asc') {
    copy.sort((a, b) => {
      const pa = a.startingPrice == null ? Number.POSITIVE_INFINITY : a.startingPrice;
      const pb = b.startingPrice == null ? Number.POSITIVE_INFINITY : b.startingPrice;
      return pa - pb;
    });
  } else if (key === 'price_desc') {
    copy.sort((a, b) => {
      const pa = a.startingPrice == null ? -1 : a.startingPrice;
      const pb = b.startingPrice == null ? -1 : b.startingPrice;
      return pb - pa;
    });
  } else if (key === 'rating') {
    copy.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
  } else {
    copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return { stadiums: copy, sort: key };
}

function parseHHMMParts(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return fallback;
  return { h, m: Number.isNaN(m) ? 0 : m };
}

/**
 * Stadiums with ≥1 bookable field that has an available hourly slot starting soon.
 * Excludes stadium/field offline ops. Aligns slot hours with slot.service (UTC HH:mm).
 */
async function filterStadiumsAvailableNow(stadiums, now = new Date()) {
  const onlineStadiums = stadiums.filter((s) => getStadiumOpsStatus(s, now).bookable);
  if (!onlineStadiums.length) return [];

  const fields = await Field.find({
    stadium: { $in: onlineStadiums.map((s) => s._id) },
    status: 'active',
  }).lean();

  const bookableFields = fields.filter((f) => getFieldOpsStatus(f, now).bookable);
  if (!bookableFields.length) return [];

  const clockNow = venueNow(now);
  const windowEnd = new Date(clockNow.getTime() + AVAILABLE_NOW_LOOKAHEAD_MS);
  const candidateSlots = [];

  for (const field of bookableFields) {
    const open = parseHHMMParts(field.openingTime || '06:00', { h: 6, m: 0 });
    const close = parseHHMMParts(field.closingTime || '23:00', { h: 23, m: 0 });
    const stadiumId = field.stadium.toString();

    for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
      const dayRef = new Date(clockNow.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = dayRef.toISOString().slice(0, 10);
      const day = new Date(`${dateStr}T00:00:00.000Z`);
      const dayStart = new Date(day);
      dayStart.setUTCHours(open.h, open.m, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setUTCHours(close.h, close.m, 0, 0);

      const cursor = new Date(dayStart);
      while (cursor < dayEnd) {
        const start = new Date(cursor);
        const end = new Date(cursor);
        end.setUTCHours(end.getUTCHours() + 1);
        if (end > dayEnd) break;

        if (start.getTime() > clockNow.getTime() && start.getTime() <= windowEnd.getTime()) {
          candidateSlots.push({
            fieldId: field._id,
            stadiumId,
            start,
            end,
          });
        }
        cursor.setUTCHours(cursor.getUTCHours() + 1);
      }
    }
  }

  if (!candidateSlots.length) return [];

  const fieldIds = [...new Set(candidateSlots.map((s) => s.fieldId.toString()))];
  const stadiumIds = [...new Set(candidateSlots.map((s) => s.stadiumId))];

  const [bookings, blocks] = await Promise.all([
    Booking.find({
      field: { $in: fieldIds },
      status: { $in: LIVE_STATUSES },
      startTime: { $lt: windowEnd },
      endTime: { $gt: now },
    }).select(
      'field startTime endTime status holdExpiresAt teamBPaymentDueAt teamAPaidAt coveredFullMatch createdAt teamA.paymentStatus teamA.paymentDeadline teamB.paymentStatus teamB.paymentDeadline'
    ),
    AvailabilityBlock.find({
      startsAt: { $lt: windowEnd },
      endsAt: { $gt: now },
      $or: [
        { field: { $in: fieldIds } },
        { scope: 'stadium', stadium: { $in: stadiumIds } },
      ],
    }),
  ]);

  const availableStadiumIds = new Set();
  for (const slot of candidateSlots) {
    if (availableStadiumIds.has(slot.stadiumId)) continue;

    const blocked = blocks.some((b) => {
      if (!(b.startsAt < slot.end && b.endsAt > slot.start)) return false;
      if (b.scope === 'stadium') return String(b.stadium) === slot.stadiumId;
      return String(b.field) === String(slot.fieldId);
    });
    if (blocked) continue;

    const booking = bookings.find(
      (b) =>
        String(b.field) === String(slot.fieldId) &&
        b.startTime < slot.end &&
        b.endTime > slot.start
    );
    if (booking) {
      const classified = classifyBookingSlot(booking);
      if (classified.state !== 'available') continue;
    }

    availableStadiumIds.add(slot.stadiumId);
  }

  return stadiums.filter((s) => availableStadiumIds.has(s._id.toString()));
}

/**
 * Public / optional-auth stadium browse + advanced filters.
 * Nearby radius is independent of maxMatchDistanceKm (that setting is for Team B matching only).
 */
async function listStadiums(query = {}, user = null) {
  const bands = await resolvePriceBands();

  let minPrice = parseNumber(query.minPrice);
  let maxPrice = parseNumber(query.maxPrice);
  let minExclusive = false;
  const priceBand = PRICE_BANDS.has(query.priceBand) ? query.priceBand : null;
  if (priceBand) {
    const range = bandRange(priceBand, bands);
    minExclusive = Boolean(range.minExclusive);
    if (minPrice == null) minPrice = range.min;
    else if (range.min != null) minPrice = Math.max(minPrice, range.min);
    if (maxPrice == null) maxPrice = range.max;
    else if (range.max != null) maxPrice = Math.min(maxPrice, range.max);
  }

  const types = parseCsv(query.types || query.type).filter((t) => FIELD_TYPES.includes(t));
  const openNow = query.openNow === 'true' || query.openNow === '1';
  const availableNow =
    query.availableNow === 'true' ||
    query.availableNow === '1' ||
    query.haddaBanaan === 'true' ||
    query.haddaBanaan === '1';
  const nearLat = parseNumber(query.lat);
  const nearLng = parseNumber(query.lng);
  const hasGeo = nearLat != null && nearLng != null;
  const radiusKm = parseNumber(query.radiusKm) ?? 20;
  const sort = query.sort || (hasGeo ? 'nearest' : 'newest');
  const searchQ = (query.q || query.search || '').trim() || null;

  const filter = await buildOwnershipFilter(query, user);
  const { facilities } = applyLocationFilters(filter, query);

  const needsFieldFilter = types.length > 0 || minPrice != null || maxPrice != null;
  let listingPriceByStadium;

  if (needsFieldFilter) {
    const matched = await stadiumIdsMatchingFieldFilters({
      types,
      minPrice,
      maxPrice,
      minExclusive,
    });
    if (!matched.ids.length) {
      return {
        stadiums: [],
        meta: {
          priceBands: bands,
          sort: SORTS.has(sort) ? sort : 'newest',
          radiusKm: hasGeo ? radiusKm : null,
          availableNowLookaheadHours: AVAILABLE_NOW_LOOKAHEAD_MS / (60 * 60 * 1000),
          applied: {
            q: searchQ,
            priceBand,
            minPrice,
            maxPrice,
            types,
            facilities,
            openNow,
            availableNow,
            hasGeo,
          },
        },
      };
    }
    const matchedIds = matched.ids;
    if (filter._id?.$in) {
      const allow = new Set(matchedIds.map((id) => id.toString()));
      filter._id = { $in: filter._id.$in.filter((id) => allow.has(id.toString())) };
    } else if (filter._id) {
      const ok = matchedIds.some((id) => id.toString() === filter._id.toString());
      filter._id = ok ? filter._id : { $in: [] };
    } else {
      filter._id = { $in: matchedIds };
    }
    listingPriceByStadium = matched.priceByStadium;
  }

  let stadiums = await Stadium.find(filter).sort({ createdAt: -1 }).lean();

  if (openNow) {
    stadiums = stadiums.filter((s) => isOpenAt(s));
  }

  if (hasGeo) {
    stadiums = stadiums
      .map((s) => {
        const sLat = s.latLng?.lat;
        const sLng = s.latLng?.lng;
        if (sLat == null || sLng == null) return { ...s, distanceKm: null };
        const distanceKm = Math.round(haversineKm(nearLat, nearLng, sLat, sLng) * 10) / 10;
        return { ...s, distanceKm };
      })
      .filter((s) => s.distanceKm != null && s.distanceKm <= radiusKm);
  }

  if (availableNow) {
    stadiums = await filterStadiumsAvailableNow(stadiums);
  }

  const attached = await attachStartingPrices(stadiums.map((s) => s._id));
  const listingPrice = listingPriceByStadium || attached.priceByStadium;

  let withMeta = stadiums.map((s) => {
    const id = s._id.toString();
    return {
      ...attachLocation(s),
      startingPrice: listingPrice.get(id) ?? attached.priceByStadium.get(id) ?? null,
      fieldTypes: attached.typesByStadium.get(id) || [],
      fieldCount: attached.fieldCountByStadium.get(id) || 0,
      sizePrices: attached.sizePricesByStadium.get(id) || [],
      isOwned: user ? s.owner?.toString() === user.id : false,
      distanceKm: s.distanceKm ?? null,
    };
  });

  // If min/max applied without type filter via aggregation, startingPrice is already constrained.
  // Drop stadiums with no active fields when price filter required a match (already handled).

  const sorted = sortStadiums(withMeta, sort, hasGeo);

  return {
    stadiums: sorted.stadiums,
    meta: {
      priceBands: bands,
      sort: sorted.sort,
      radiusKm: hasGeo ? radiusKm : null,
      availableNowLookaheadHours: AVAILABLE_NOW_LOOKAHEAD_MS / (60 * 60 * 1000),
      applied: {
        q: searchQ,
        priceBand,
        minPrice,
        maxPrice,
        types,
        facilities,
        openNow,
        availableNow,
        hasGeo,
      },
    },
  };
}

module.exports = {
  listStadiums,
  resolvePriceBands,
  isOpenAt,
  filterStadiumsAvailableNow,
  DEFAULT_PRICE_BANDS,
  AVAILABLE_NOW_LOOKAHEAD_MS,
  COMMON_FACILITIES,
  FIELD_TYPES,
};
