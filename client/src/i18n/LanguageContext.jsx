import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  LANGS,
  LOCALES,
  STORAGE_KEY,
  detectInitialLang,
  applyDocumentLang,
  translate,
} from './index';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => detectInitialLang());

  useEffect(() => {
    applyDocumentLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!LOCALES[code]) return;
    setLangState(code);
  }, []);

  const t = useCallback(
    (key, vars) => translate(LOCALES[lang] || LOCALES.en, key, vars),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      langs: LANGS,
      dir: LANGS.find((l) => l.code === lang)?.dir || 'ltr',
      isRtl: lang === 'ar',
    }),
    [lang, setLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

/** Alias — same as useLanguage().t */
export function useTranslation() {
  const { t, lang, setLang, langs, dir, isRtl } = useLanguage();
  return { t, lang, setLang, langs, dir, isRtl };
}
