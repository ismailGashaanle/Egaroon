/**
 * Quick asserts for Team B join phone matching.
 * Run: node scripts/assert-somali-phone-join.js
 */
const {
  normalizeSomaliPhone,
  phoneLookupVariants,
  phonesEquivalent,
  phoneMatchesAny,
} = require('../src/utils/somaliPhone');

const STORED = '+252637856383';
const CANON = '252637856383';
let failed = 0;

function assert(cond, label) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}

const cases = [
  ['+252637856383', null],
  ['252637856383', null],
  ['0637856383', null],
  ['637856383', null],
  ['7856383', { carrierId: 'telesom' }],
  ['7856383', { prefix: '063' }],
];

for (const [input, opts] of cases) {
  const n = normalizeSomaliPhone(input, opts || {});
  assert(n === CANON, `normalize(${JSON.stringify(input)}, ${JSON.stringify(opts)}) => ${n}`);
  assert(
    phonesEquivalent(input, STORED, opts || {}),
    `phonesEquivalent(${JSON.stringify(input)} vs stored E.164)`
  );
  assert(
    phoneMatchesAny(input, new Set([STORED, CANON]), opts || {}),
    `phoneMatchesAny(${JSON.stringify(input)} vs expected set)`
  );
}

assert(normalizeSomaliPhone('7856383') === null, '7-digit alone without carrier => null');
assert(
  !phoneMatchesAny('7856383', new Set([STORED, CANON])),
  '7-digit alone must not match stored set'
);
assert(
  normalizeSomaliPhone('7856383', { carrierId: 'hormuud' }) !== CANON,
  'hormuud+7856383 is not telesom number'
);

const variants = phoneLookupVariants(STORED);
assert(variants.includes(CANON), 'variants include canonical');
assert(variants.includes('0637856383'), 'variants include 0-local');
assert(variants.includes('637856383'), 'variants include national-9');

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll somali phone join asserts passed.');

// Client-style compose (mirror) — paste/full/local body must all resolve
function composeSomaliPhone(carrierId, localNumber) {
  const SO = [
    { id: 'hormuud', prefix: '061' },
    { id: 'telesom', prefix: '063' },
    { id: 'somtel', prefix: '065' },
    { id: 'golis', prefix: '090' },
  ];
  const raw = String(localNumber || '').trim();
  if (!raw) return null;
  const direct = normalizeSomaliPhone(raw);
  if (direct) return direct;
  const d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  const asLocal = normalizeSomaliPhone(d);
  if (asLocal) return asLocal;
  const carrier = SO.find((c) => c.id === carrierId) || SO[0];
  const prefix = carrier.prefix;
  const prefixNat = prefix.replace(/^0/, '');
  if (d.startsWith('252') || d.startsWith(prefix) || d.startsWith(prefixNat)) {
    const candidate = d.startsWith('0') || d.startsWith('252') ? d : '0' + d;
    const n = normalizeSomaliPhone(candidate);
    if (n) return n;
  }
  const body = d.replace(/^0+/, '');
  return normalizeSomaliPhone(prefix + body);
}

const composeCases = [
  ['telesom', '7856383'],
  ['telesom', '0637856383'],
  ['telesom', '637856383'],
  ['hormuud', '+252637856383'],
  ['telesom', '252637856383'],
];
for (const [c, local] of composeCases) {
  const n = composeSomaliPhone(c, local);
  assert(n === CANON, `compose(${c}, ${local}) => ${n}`);
}
