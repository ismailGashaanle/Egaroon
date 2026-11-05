/** Server-side formation slot counts/ids — keep in sync with client formationLayouts.js */

const SLOT_COUNTS = {
  5: { '2-1-1': 5, '1-2-1': 5 },
  6: { '2-2-1': 6, '3-1-1': 6 },
  7: { '2-3-1': 7, '3-2-1': 7, '2-2-2': 7, '3-1-2': 7 },
  8: { '3-3-1': 8, '2-3-2': 8 },
  9: { '3-3-2': 9 },
  11: { '4-2-3-1': 11, '4-4-2': 11, '4-3-3': 11, '3-5-2': 11 },
};

/** Slot ids per formation (must match client layouts) */
const SLOT_IDS = {
  5: {
    '2-1-1': ['ST', 'CM', 'LB', 'RB', 'GK'],
    '1-2-1': ['ST', 'LM', 'RM', 'CB', 'GK'],
  },
  6: {
    '2-2-1': ['ST', 'LM', 'RM', 'LB', 'RB', 'GK'],
    '3-1-1': ['ST', 'CM', 'LB', 'CB', 'RB', 'GK'],
  },
  7: {
    '2-3-1': ['ST', 'LM', 'CM', 'RM', 'LB', 'RB', 'GK'],
    '3-2-1': ['ST', 'LM', 'RM', 'LB', 'CB', 'RB', 'GK'],
    '2-2-2': ['ST1', 'ST2', 'CM1', 'CM2', 'LB', 'RB', 'GK'],
    '3-1-2': ['ST1', 'ST2', 'CM', 'LB', 'CB', 'RB', 'GK'],
  },
  8: {
    '3-3-1': ['ST', 'LM', 'CM', 'RM', 'LB', 'CB', 'RB', 'GK'],
    '2-3-2': ['ST1', 'ST2', 'LM', 'CM', 'RM', 'LB', 'RB', 'GK'],
  },
  9: {
    '3-3-2': ['ST1', 'ST2', 'LM', 'CM', 'RM', 'LB', 'CB', 'RB', 'GK'],
  },
  11: {
    '4-2-3-1': ['ST', 'LW', 'CAM', 'RW', 'CDM1', 'CDM2', 'LB', 'CB1', 'CB2', 'RB', 'GK'],
    '4-4-2': ['ST1', 'ST2', 'LM', 'CM1', 'CM2', 'RM', 'LB', 'CB1', 'CB2', 'RB', 'GK'],
    '4-3-3': ['ST', 'LW', 'RW', 'CM1', 'CM2', 'CM3', 'LB', 'CB1', 'CB2', 'RB', 'GK'],
    '3-5-2': ['ST1', 'ST2', 'LWB', 'CM1', 'CM2', 'CM3', 'RWB', 'CB1', 'CB2', 'CB3', 'GK'],
  },
};

function normalizeCapacity(capacity) {
  const n = Number(capacity) || 7;
  if (SLOT_COUNTS[n]) return n;
  const keys = Object.keys(SLOT_COUNTS).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (Math.abs(k - n) < Math.abs(best - n)) best = k;
  }
  return best;
}

function defaultFormation(capacity) {
  const c = normalizeCapacity(capacity);
  return Object.keys(SLOT_COUNTS[c])[0];
}

function expectedStarters(formation, capacity) {
  const c = normalizeCapacity(capacity);
  const map = SLOT_COUNTS[c];
  if (map[formation]) return map[formation];
  for (const m of Object.values(SLOT_COUNTS)) {
    if (m[formation]) return m[formation];
  }
  return c;
}

function isFormationAllowed(formation, capacity) {
  const c = normalizeCapacity(capacity);
  return Boolean(SLOT_COUNTS[c]?.[formation]);
}

/** Ordered slot ids for a capacity-scoped formation, or null if unknown. */
function slotIdsForFormation(formation, capacity) {
  const c = normalizeCapacity(capacity);
  const ids = SLOT_IDS[c]?.[formation];
  return ids ? [...ids] : null;
}

module.exports = {
  SLOT_COUNTS,
  SLOT_IDS,
  normalizeCapacity,
  defaultFormation,
  expectedStarters,
  isFormationAllowed,
  slotIdsForFormation,
};
