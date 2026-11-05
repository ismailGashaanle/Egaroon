/**
 * Pure asserts for lineup capacity / formation / photo rules (no Mongo).
 * Usage: node scripts/assert-lineup-rules.js
 */
const assert = require('assert');
const {
  normalizeCapacity,
  defaultFormation,
  isFormationAllowed,
  expectedStarters,
  slotIdsForFormation,
  SLOT_COUNTS,
} = require('../src/utils/formations');
const { normalizePlayers, sanitizePhotoUrl, MAX_BENCH } = require('../src/utils/lineupPlayers');

function expectThrow(fn, msgIncludes) {
  let err;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected throw');
  if (msgIncludes) {
    const msg = String(err.message || err.statusCode || '');
    assert.ok(
      msg.includes(msgIncludes) || String(err).includes(msgIncludes),
      `expected message to include "${msgIncludes}", got: ${msg}`
    );
  }
}

// --- capacity / formation maps ---
assert.strictEqual(normalizeCapacity(7), 7);
assert.strictEqual(normalizeCapacity('7'), 7);
assert.ok(isFormationAllowed('2-3-1', 7));
assert.ok(!isFormationAllowed('4-3-3', 7), '11-a-side formation blocked on 7v7');
assert.ok(isFormationAllowed('4-3-3', 11));
assert.strictEqual(expectedStarters('2-3-1', 7), 7);
assert.strictEqual(defaultFormation(7), '2-3-1');
assert.deepStrictEqual(slotIdsForFormation('2-3-1', 7)?.length, 7);

for (const [cap, map] of Object.entries(SLOT_COUNTS)) {
  const c = Number(cap);
  for (const [key, count] of Object.entries(map)) {
    assert.strictEqual(count, c, `${key} slot count must equal capacity ${c}`);
    assert.strictEqual(
      slotIdsForFormation(key, c)?.length,
      c,
      `${key} slot ids length must equal ${c}`
    );
  }
}

// --- photoUrl ---
assert.strictEqual(sanitizePhotoUrl(''), '');
assert.strictEqual(sanitizePhotoUrl('https://res.cloudinary.com/x/image/upload/a.jpg'), 'https://res.cloudinary.com/x/image/upload/a.jpg');
expectThrow(() => sanitizePhotoUrl('data:image/png;base64,aaaa'), 'base64');
expectThrow(() => sanitizePhotoUrl('/local/path.jpg'), 'http');
expectThrow(() => sanitizePhotoUrl('blob:http://localhost/x'), 'hosted');

// --- normalizePlayers: 7v7 happy path ---
const slots7 = slotIdsForFormation('2-3-1', 7);
const seven = slots7.map((id, i) => ({
  displayName: `Player ${String.fromCharCode(65 + i)}`,
  formationSlot: id,
  status: 'starter',
  position: id === 'GK' ? 'GK' : 'MF',
}));
const ok = normalizePlayers(seven, 7, '2-3-1');
assert.strictEqual(ok.filter((p) => p.status === 'starter').length, 7);

// extras → bench
const withBench = normalizePlayers(
  [
    ...seven,
    { displayName: 'Sub One', status: 'bench' },
    { displayName: 'Sub Two', status: 'bench' },
  ],
  7,
  '2-3-1'
);
assert.strictEqual(withBench.filter((p) => p.status === 'bench').length, 2);

// wrong starter count
expectThrow(
  () => normalizePlayers(seven.slice(0, 5), 7, '2-3-1'),
  'exactly 7 starters'
);

// empty name
expectThrow(
  () =>
    normalizePlayers(
      [{ displayName: '  ', formationSlot: 'ST', status: 'starter' }, ...seven.slice(1)],
      7,
      '2-3-1'
    ),
  'display name'
);

// wrong formation key for capacity (caller should check isFormationAllowed; slot mismatch)
expectThrow(
  () =>
    normalizePlayers(
      [
        {
          displayName: 'X',
          formationSlot: 'ST',
          status: 'starter',
        },
      ].concat(
        Array.from({ length: 10 }, (_, i) => ({
          displayName: `P${i}`,
          formationSlot: `S${i}`,
          status: 'starter',
        }))
      ),
      11,
      '4-3-3'
    ),
  'not valid'
);

// injury forces bench → then starter count fails if not replaced
expectThrow(
  () =>
    normalizePlayers(
      seven.map((p, i) => (i === 0 ? { ...p, injured: true } : p)),
      7,
      '2-3-1'
    ),
  'exactly 7 starters'
);

// 11-a-side 4-3-3 wrong on capacity 7 via isFormationAllowed (service gate)
assert.ok(!isFormationAllowed('4-3-3', 7));

assert.ok(MAX_BENCH >= 20);

console.log('assert-lineup-rules: all passed');
