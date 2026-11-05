/** Keep in sync with server/src/constants/fieldFormats.js */

export const FIELD_TYPE_CAPACITY = {
  '5v5': 5,
  '6v6': 6,
  '7v7': 7,
  '8v8': 8,
  '9v9': 9,
  '11v11': 11,
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_CAPACITY);

export function capacityForType(type) {
  return FIELD_TYPE_CAPACITY[type] || Number(String(type).split('v')[0]) || null;
}

export function formatFieldType(type) {
  if (!type) return null;
  const raw = String(type).trim();
  const m = raw.match(/^(\d+)\s*[v×x]\s*(\d+)$/i);
  if (m) return `${m[1]}v${m[2]}`;
  return raw;
}

export function uniqueFieldTypes(list) {
  const types = Array.isArray(list) ? list : [];
  return [...new Set(types.map(formatFieldType).filter(Boolean))];
}

/** One-team listing price — same rule as stadium search / web listings. */
export function estimateTeamShare(field) {
  if (!field) return null;
  if (field.pricingMode === 'fixed' && field.fixedPrice != null) {
    return Math.round((Number(field.fixedPrice) / 2) * 100) / 100;
  }
  if (field.pricePerPlayer != null && field.capacity != null) {
    return Math.round(Number(field.pricePerPlayer) * Number(field.capacity) * 100) / 100;
  }
  return null;
}

export function formatUsd(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const n = Number(amount);
  return Number.isInteger(n) ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

export function hoursLabel(openingTime, closingTime) {
  if (!openingTime && !closingTime) return null;
  return [openingTime || '06:00', closingTime || '23:00'].join('–');
}

function typeSortIndex(type) {
  const i = FIELD_TYPES.indexOf(formatFieldType(type) || type);
  return i < 0 ? 99 : i;
}

export function sortSizePrices(sizes) {
  return [...(sizes || [])].sort(
    (a, b) => typeSortIndex(a.type) - typeSortIndex(b.type)
  );
}

/**
 * Per-size listing from a stadium's fields: `{ type, price, count }`.
 * Price is the cheapest one-team share for that size.
 */
export function summarizeFieldSizes(fields) {
  const map = new Map();
  for (const f of fields || []) {
    const type = formatFieldType(f.type);
    if (!type) continue;
    const share = estimateTeamShare(f);
    const prev = map.get(type) || { type, count: 0, price: null };
    prev.count += 1;
    if (share != null && (prev.price == null || share < prev.price)) prev.price = share;
    map.set(type, prev);
  }
  return sortSizePrices([...map.values()]);
}

export function stadiumSizePrices(stadium, fields) {
  if (fields?.length) return summarizeFieldSizes(fields);
  if (Array.isArray(stadium?.sizePrices) && stadium.sizePrices.length) {
    return sortSizePrices(
      stadium.sizePrices.map((s) => ({
        type: formatFieldType(s.type) || s.type,
        price: s.price != null ? Number(s.price) : null,
        count: Number(s.count || 0) || null,
      }))
    );
  }
  const types = uniqueFieldTypes(stadium?.fieldTypes);
  const price = stadium?.startingPrice ?? stadium?.priceFrom ?? stadium?.minPrice ?? null;
  return types.map((type) => ({ type, price, count: null }));
}

export function fieldCountLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return '1 field';
  return `${n} fields`;
}

export const EMPTY_FIELD_FILTERS = {
  openOnly: false,
  types: [],
  minPrice: '',
  maxPrice: '',
};

export function countActiveFieldFilters(filters = EMPTY_FIELD_FILTERS) {
  let n = 0;
  if (filters.openOnly) n += 1;
  if (filters.types?.length) n += 1;
  if (filters.minPrice !== '' && filters.minPrice != null) n += 1;
  if (filters.maxPrice !== '' && filters.maxPrice != null) n += 1;
  return n;
}

export function fieldSizeCounts(fields) {
  return summarizeFieldSizes(fields).map((s) => ({ type: s.type, count: s.count }));
}

export function fieldMatchesFilters(field, filters = EMPTY_FIELD_FILTERS, extras = {}) {
  const { openCount = 0, share = null } = extras;
  if (filters.openOnly) {
    if (field?.ops && field.ops.bookable === false) return false;
    if (Number(openCount) <= 0) return false;
  }
  if (filters.types?.length) {
    const type = formatFieldType(field?.type);
    if (!filters.types.includes(type)) return false;
  }
  const min = filters.minPrice === '' || filters.minPrice == null ? null : Number(filters.minPrice);
  const max = filters.maxPrice === '' || filters.maxPrice == null ? null : Number(filters.maxPrice);
  if (min != null && !Number.isNaN(min) && (share == null || share < min)) return false;
  if (max != null && !Number.isNaN(max) && (share == null || share > max)) return false;
  return true;
}

/** Field 1, Field 2… then leftover names A–Z. */
export function sortStadiumFields(fields) {
  return [...(fields || [])].sort((a, b) => {
    const num = (name) => {
      const m = String(name || '').match(/(\d+)/);
      return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
    };
    const na = num(a.name);
    const nb = num(b.name);
    if (na !== nb) return na - nb;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
