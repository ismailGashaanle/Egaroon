import { useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'framer-motion';

function parseAnimatedValue(value) {
  if (value == null || value === '') return { kind: 'raw', text: '—' };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'num', prefix: '', number: value, suffix: '', decimals: Number.isInteger(value) ? 0 : 2 };
  }
  const s = String(value).trim();
  if (s === '—' || s === '-') return { kind: 'raw', text: '—' };
  const m = s.match(/^(.*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return { kind: 'raw', text: s };
  const num = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(num)) return { kind: 'raw', text: s };
  const frac = m[2].includes('.') ? (m[2].split('.')[1] || '').length : 0;
  return { kind: 'num', prefix: m[1], number: num, suffix: m[3], decimals: Math.min(frac, 2) };
}

function formatParsed(parsed, n) {
  const body = Number(n).toLocaleString(undefined, {
    maximumFractionDigits: parsed.decimals,
    minimumFractionDigits: parsed.decimals,
  });
  return `${parsed.prefix}${body}${parsed.suffix}`;
}

export default function AnimatedNumber({ value, className = '' }) {
  const parsed = useMemo(() => parseAnimatedValue(value), [value]);
  const [display, setDisplay] = useState(() =>
    parsed.kind === 'num' ? formatParsed(parsed, parsed.number) : parsed.text
  );
  const fromRef = useRef(parsed.kind === 'num' ? parsed.number : 0);

  useEffect(() => {
    if (parsed.kind !== 'num') {
      setDisplay(parsed.text);
      return undefined;
    }
    const controls = animate(fromRef.current, parsed.number, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(formatParsed(parsed, v)),
    });
    fromRef.current = parsed.number;
    return () => controls.stop();
  }, [parsed]);

  return <span className={className}>{display}</span>;
}
