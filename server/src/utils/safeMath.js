const ApiError = require('./ApiError');

const MAX_LEN = 220;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * BODMAS evaluator: brackets, orders (^), division/multiplication, addition/subtraction.
 * `%` after a number is percent (4% → 0.04). `%` between two values is modulo.
 * Identifiers resolve from `vars` only — no eval, no globals.
 */
function evaluateExpression(source, vars = {}) {
  const expr = String(source || '').trim();
  if (!expr) return { ok: false, error: 'Empty formula' };
  if (expr.length > MAX_LEN) return { ok: false, error: 'Formula is too long' };

  const tokens = tokenize(expr);
  if (tokens.error) return { ok: false, error: tokens.error };

  let i = 0;
  function peek() {
    return tokens[i];
  }
  function eat(type) {
    const t = tokens[i];
    if (!t || t.type !== type) return null;
    i += 1;
    return t;
  }

  function parsePrimary() {
    if (eat('lparen')) {
      const v = parseAdd();
      if (!eat('rparen')) throw new Error('Missing )');
      return v;
    }
    if (peek()?.type === 'minus') {
      eat('minus');
      return -parsePrimary();
    }
    if (peek()?.type === 'plus') {
      eat('plus');
      return parsePrimary();
    }
    const num = eat('number');
    if (num) {
      let v = num.value;
      if (peek()?.type === 'percent') {
        const next = tokens[i + 1];
        const postfix =
          !next ||
          next.type === 'plus' ||
          next.type === 'minus' ||
          next.type === 'star' ||
          next.type === 'slash' ||
          next.type === 'rparen' ||
          next.type === 'pow';
        if (postfix) {
          eat('percent');
          v /= 100;
        }
      }
      return v;
    }
    const id = eat('ident');
    if (id) {
      if (!Object.prototype.hasOwnProperty.call(vars, id.value)) {
        throw new Error(`Unknown name: ${id.value}`);
      }
      const raw = vars[id.value];
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid value for ${id.value}`);
      return n;
    }
    throw new Error('Expected a number, name, or ( )');
  }

  function parsePower() {
    let left = parsePrimary();
    while (peek()?.type === 'pow') {
      eat('pow');
      const right = parsePrimary();
      left = left ** right;
    }
    return left;
  }

  function parseMul() {
    let left = parsePower();
    for (;;) {
      if (peek()?.type === 'star') {
        eat('star');
        left *= parsePower();
      } else if (peek()?.type === 'slash') {
        eat('slash');
        const r = parsePower();
        if (r === 0) throw new Error('Division by zero');
        left /= r;
      } else if (peek()?.type === 'percent') {
        eat('percent');
        const r = parsePower();
        if (r === 0) throw new Error('Modulo by zero');
        left %= r;
      } else break;
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    for (;;) {
      if (peek()?.type === 'plus') {
        eat('plus');
        left += parseMul();
      } else if (peek()?.type === 'minus') {
        eat('minus');
        left -= parseMul();
      } else break;
    }
    return left;
  }

  try {
    const value = parseAdd();
    if (i !== tokens.length) throw new Error('Unexpected extra characters');
    if (!Number.isFinite(value)) throw new Error('Result is not a finite number');
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err.message || 'Invalid formula' };
  }
}

function tokenize(expr) {
  const out = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      out.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      out.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === '+') {
      out.push({ type: 'plus' });
      i += 1;
      continue;
    }
    if (ch === '-') {
      out.push({ type: 'minus' });
      i += 1;
      continue;
    }
    if (ch === '*') {
      out.push({ type: 'star' });
      i += 1;
      continue;
    }
    if (ch === '/') {
      out.push({ type: 'slash' });
      i += 1;
      continue;
    }
    if (ch === '^') {
      out.push({ type: 'pow' });
      i += 1;
      continue;
    }
    if (ch === '%') {
      out.push({ type: 'percent' });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let s = '';
      let dots = 0;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') dots += 1;
        s += expr[i];
        i += 1;
      }
      if (dots > 1 || s === '.') return { error: 'Invalid number' };
      out.push({ type: 'number', value: Number(s) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let s = '';
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
        s += expr[i];
        i += 1;
      }
      if (!IDENT.test(s)) return { error: `Invalid name: ${s}` };
      out.push({ type: 'ident', value: s });
      continue;
    }
    return { error: `Unexpected character: ${ch}` };
  }
  return out;
}

function assertFinitePercent(n, label, { min = 0, max = 100 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < min || v > max) {
    throw ApiError.badRequest(`${label} must be between ${min} and ${max}`);
  }
  return v;
}

function assertFiniteNumber(n, label, { min = 0, max = 1e9 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < min || v > max) {
    throw ApiError.badRequest(`${label} must be a number between ${min} and ${max}`);
  }
  return v;
}

module.exports = {
  evaluateExpression,
  assertFinitePercent,
  assertFiniteNumber,
};
