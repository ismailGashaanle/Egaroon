/** Formation slot layouts as % coords (x left→right, y top→bottom). Attack at top.
 * Slot count must match field capacity (players per side), including GK.
 */

function layout(label, slots) {
  return { label, slots };
}

/** 5-a-side (inc. GK) */
const CAP5 = {
  '2-1-1': layout('2-1-1', [
    { id: 'ST', role: 'FW', x: 50, y: 14 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'LB', role: 'DF', x: 28, y: 68 },
    { id: 'RB', role: 'DF', x: 72, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '1-2-1': layout('1-2-1', [
    { id: 'ST', role: 'FW', x: 50, y: 14 },
    { id: 'LM', role: 'MF', x: 28, y: 42 },
    { id: 'RM', role: 'MF', x: 72, y: 42 },
    { id: 'CB', role: 'DF', x: 50, y: 70 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

/** 6-a-side */
const CAP6 = {
  '2-2-1': layout('2-2-1', [
    { id: 'ST', role: 'FW', x: 50, y: 12 },
    { id: 'LM', role: 'MF', x: 28, y: 38 },
    { id: 'RM', role: 'MF', x: 72, y: 38 },
    { id: 'LB', role: 'DF', x: 28, y: 68 },
    { id: 'RB', role: 'DF', x: 72, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '3-1-1': layout('3-1-1', [
    { id: 'ST', role: 'FW', x: 50, y: 12 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'LB', role: 'DF', x: 20, y: 68 },
    { id: 'CB', role: 'DF', x: 50, y: 72 },
    { id: 'RB', role: 'DF', x: 80, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

/** 7-a-side (typical 7v7) */
const CAP7 = {
  '2-3-1': layout('2-3-1', [
    { id: 'ST', role: 'FW', x: 50, y: 10 },
    { id: 'LM', role: 'MF', x: 18, y: 36 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'RM', role: 'MF', x: 82, y: 36 },
    { id: 'LB', role: 'DF', x: 28, y: 68 },
    { id: 'RB', role: 'DF', x: 72, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '3-2-1': layout('3-2-1', [
    { id: 'ST', role: 'FW', x: 50, y: 10 },
    { id: 'LM', role: 'MF', x: 32, y: 38 },
    { id: 'RM', role: 'MF', x: 68, y: 38 },
    { id: 'LB', role: 'DF', x: 18, y: 68 },
    { id: 'CB', role: 'DF', x: 50, y: 72 },
    { id: 'RB', role: 'DF', x: 82, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '2-2-2': layout('2-2-2', [
    { id: 'ST1', role: 'FW', x: 35, y: 12 },
    { id: 'ST2', role: 'FW', x: 65, y: 12 },
    { id: 'CM1', role: 'MF', x: 35, y: 42 },
    { id: 'CM2', role: 'MF', x: 65, y: 42 },
    { id: 'LB', role: 'DF', x: 28, y: 70 },
    { id: 'RB', role: 'DF', x: 72, y: 70 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '3-1-2': layout('3-1-2', [
    { id: 'ST1', role: 'FW', x: 35, y: 12 },
    { id: 'ST2', role: 'FW', x: 65, y: 12 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'LB', role: 'DF', x: 18, y: 68 },
    { id: 'CB', role: 'DF', x: 50, y: 72 },
    { id: 'RB', role: 'DF', x: 82, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

/** 8-a-side */
const CAP8 = {
  '3-3-1': layout('3-3-1', [
    { id: 'ST', role: 'FW', x: 50, y: 10 },
    { id: 'LM', role: 'MF', x: 18, y: 36 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'RM', role: 'MF', x: 82, y: 36 },
    { id: 'LB', role: 'DF', x: 18, y: 68 },
    { id: 'CB', role: 'DF', x: 50, y: 72 },
    { id: 'RB', role: 'DF', x: 82, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '2-3-2': layout('2-3-2', [
    { id: 'ST1', role: 'FW', x: 35, y: 10 },
    { id: 'ST2', role: 'FW', x: 65, y: 10 },
    { id: 'LM', role: 'MF', x: 18, y: 38 },
    { id: 'CM', role: 'MF', x: 50, y: 42 },
    { id: 'RM', role: 'MF', x: 82, y: 38 },
    { id: 'LB', role: 'DF', x: 30, y: 70 },
    { id: 'RB', role: 'DF', x: 70, y: 70 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

/** 9-a-side */
const CAP9 = {
  '3-3-2': layout('3-3-2', [
    { id: 'ST1', role: 'FW', x: 35, y: 10 },
    { id: 'ST2', role: 'FW', x: 65, y: 10 },
    { id: 'LM', role: 'MF', x: 18, y: 36 },
    { id: 'CM', role: 'MF', x: 50, y: 40 },
    { id: 'RM', role: 'MF', x: 82, y: 36 },
    { id: 'LB', role: 'DF', x: 18, y: 68 },
    { id: 'CB', role: 'DF', x: 50, y: 72 },
    { id: 'RB', role: 'DF', x: 82, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

/** 11-a-side */
const CAP11 = {
  '4-2-3-1': layout('4-2-3-1', [
    { id: 'ST', role: 'FW', x: 50, y: 10 },
    { id: 'LW', role: 'FW', x: 18, y: 28 },
    { id: 'CAM', role: 'MF', x: 50, y: 32 },
    { id: 'RW', role: 'FW', x: 82, y: 28 },
    { id: 'CDM1', role: 'MF', x: 35, y: 48 },
    { id: 'CDM2', role: 'MF', x: 65, y: 48 },
    { id: 'LB', role: 'DF', x: 12, y: 68 },
    { id: 'CB1', role: 'DF', x: 36, y: 72 },
    { id: 'CB2', role: 'DF', x: 64, y: 72 },
    { id: 'RB', role: 'DF', x: 88, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '4-4-2': layout('4-4-2', [
    { id: 'ST1', role: 'FW', x: 35, y: 12 },
    { id: 'ST2', role: 'FW', x: 65, y: 12 },
    { id: 'LM', role: 'MF', x: 12, y: 38 },
    { id: 'CM1', role: 'MF', x: 38, y: 42 },
    { id: 'CM2', role: 'MF', x: 62, y: 42 },
    { id: 'RM', role: 'MF', x: 88, y: 38 },
    { id: 'LB', role: 'DF', x: 12, y: 68 },
    { id: 'CB1', role: 'DF', x: 36, y: 72 },
    { id: 'CB2', role: 'DF', x: 64, y: 72 },
    { id: 'RB', role: 'DF', x: 88, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '4-3-3': layout('4-3-3', [
    { id: 'ST', role: 'FW', x: 50, y: 10 },
    { id: 'LW', role: 'FW', x: 18, y: 22 },
    { id: 'RW', role: 'FW', x: 82, y: 22 },
    { id: 'CM1', role: 'MF', x: 28, y: 42 },
    { id: 'CM2', role: 'MF', x: 50, y: 48 },
    { id: 'CM3', role: 'MF', x: 72, y: 42 },
    { id: 'LB', role: 'DF', x: 12, y: 68 },
    { id: 'CB1', role: 'DF', x: 36, y: 72 },
    { id: 'CB2', role: 'DF', x: 64, y: 72 },
    { id: 'RB', role: 'DF', x: 88, y: 68 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
  '3-5-2': layout('3-5-2', [
    { id: 'ST1', role: 'FW', x: 38, y: 12 },
    { id: 'ST2', role: 'FW', x: 62, y: 12 },
    { id: 'LWB', role: 'MF', x: 10, y: 40 },
    { id: 'CM1', role: 'MF', x: 32, y: 42 },
    { id: 'CM2', role: 'MF', x: 50, y: 48 },
    { id: 'CM3', role: 'MF', x: 68, y: 42 },
    { id: 'RWB', role: 'MF', x: 90, y: 40 },
    { id: 'CB1', role: 'DF', x: 28, y: 70 },
    { id: 'CB2', role: 'DF', x: 50, y: 74 },
    { id: 'CB3', role: 'DF', x: 72, y: 70 },
    { id: 'GK', role: 'GK', x: 50, y: 90 },
  ]),
};

const BY_CAPACITY = {
  5: CAP5,
  6: CAP6,
  7: CAP7,
  8: CAP8,
  9: CAP9,
  11: CAP11,
};

/** Legacy flat map (11-a-side defaults) — kept for older imports */
export const FORMATIONS = { ...CAP11, ...CAP7 };

export function normalizeCapacity(capacity) {
  const n = Number(capacity) || 7;
  if (BY_CAPACITY[n]) return n;
  // nearest supported
  const keys = Object.keys(BY_CAPACITY)
    .map(Number)
    .sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (Math.abs(k - n) < Math.abs(best - n)) best = k;
  }
  return best;
}

export function formationsForCapacity(capacity) {
  const c = normalizeCapacity(capacity);
  return BY_CAPACITY[c] || CAP7;
}

export function defaultFormationKey(capacity) {
  const map = formationsForCapacity(capacity);
  return Object.keys(map)[0];
}

export function slotsForFormation(key, capacity = 7) {
  const map = formationsForCapacity(capacity);
  if (map[key]) return map[key].slots;
  // fallback search all
  for (const m of Object.values(BY_CAPACITY)) {
    if (m[key]) return m[key].slots;
  }
  return Object.values(map)[0].slots;
}

export function starterCountForFormation(key, capacity = 7) {
  return slotsForFormation(key, capacity).length;
}
