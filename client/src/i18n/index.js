import en from './locales/en';
import so from './locales/so';
import ar from './locales/ar';

export const LANGS = [
  { code: 'so', native: 'Af Soomaali', dir: 'ltr' },
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
];

export const LOCALES = { en, so, ar };

export const STORAGE_KEY = 'kulansiiye_lang';

/** Default for E-Garoon users: Somali first. */
export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || '';
  const base = String(nav).toLowerCase().slice(0, 2);
  if (base === 'ar') return 'ar';
  if (base === 'en') return 'en';
  return 'so';
}

export function applyDocumentLang(code) {
  const meta = LANGS.find((l) => l.code === code) || LANGS[0];
  if (typeof document === 'undefined') return;
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
}

/** Resolve nested key like "nav.book" */
export function translate(dict, key, vars) {
  const parts = String(key).split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return key;
    cur = cur[p];
  }
  if (typeof cur !== 'string') return key;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : ''));
}
