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
  return FIELD_TYPE_CAPACITY[type] || Number(String(type).split('v')[0]) || 7;
}

export function formatFieldType(type) {
  if (!type) return null;
  const raw = String(type).trim();
  const m = raw.match(/^(\d+)\s*[v×x]\s*(\d+)$/i);
  if (m) return `${m[1]}v${m[2]}`;
  return raw;
}

export function hoursLabel(openingTime, closingTime) {
  if (!openingTime && !closingTime) return null;
  return [openingTime || '06:00', closingTime || '23:00'].join('–');
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

export function uniqueFieldTypesFromFields(fields) {
  const seen = [];
  for (const f of fields || []) {
    const type = formatFieldType(f.type);
    if (type && !seen.includes(type)) seen.push(type);
  }
  return seen.sort((a, b) => FIELD_TYPES.indexOf(a) - FIELD_TYPES.indexOf(b));
}

/** `{ type, count }` for each format present on this stadium. */
export function fieldSizeCounts(fields) {
  const map = new Map();
  for (const f of fields || []) {
    const type = formatFieldType(f.type);
    if (!type) continue;
    map.set(type, (map.get(type) || 0) + 1);
  }
  return FIELD_TYPES.filter((type) => map.has(type)).map((type) => ({
    type,
    count: map.get(type),
  }));
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

/** Captain field list: banaan, size chips, min/max one-team price. */
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
