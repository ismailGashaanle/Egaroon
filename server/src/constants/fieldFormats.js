/** Field format → players per side (including GK). */
const FIELD_TYPE_CAPACITY = {
  '5v5': 5,
  '6v6': 6,
  '7v7': 7,
  '8v8': 8,
  '9v9': 9,
  '11v11': 11,
};

const FIELD_TYPES = Object.keys(FIELD_TYPE_CAPACITY);

function capacityForType(type) {
  return FIELD_TYPE_CAPACITY[type] || null;
}

function assertValidFieldType(type) {
  if (!FIELD_TYPE_CAPACITY[type]) {
    throw new Error(`Invalid field type. Use: ${FIELD_TYPES.join(', ')}`);
  }
}

/** Field 1, Field 2… then leftover names A–Z. */
function sortStadiumFields(fields) {
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

module.exports = {
  FIELD_TYPES,
  FIELD_TYPE_CAPACITY,
  capacityForType,
  assertValidFieldType,
  sortStadiumFields,
};
