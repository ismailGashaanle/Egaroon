import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { siteContentApi } from '../api/siteContentApi';
import { emptySiteContent, pickLocale } from '../lib/siteContent';
import { useLanguage } from '../i18n/LanguageContext';

const SiteContentContext = createContext(null);

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(emptySiteContent);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const { lang } = useLanguage();

  const refresh = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const { data } = await siteContentApi.getPublic();
      const incoming = data.data?.content || {};
      const empty = emptySiteContent();
      setContent({
        ...empty,
        ...incoming,
        hero: { ...empty.hero, ...(incoming.hero || {}) },
        navbar: { ...empty.navbar, ...(incoming.navbar || {}) },
        home: { ...empty.home, ...(incoming.home || {}) },
        about: { ...empty.about, ...(incoming.about || {}) },
        contact: { ...empty.contact, ...(incoming.contact || {}) },
        footer: { ...empty.footer, ...(incoming.footer || {}) },
        policies: { ...empty.policies, ...(incoming.policies || {}) },
      });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUpdated = () => refresh();
    window.addEventListener('kulansiiye:site-content', onUpdated);
    return () => window.removeEventListener('kulansiiye:site-content', onUpdated);
  }, [refresh]);

  const lc = useCallback((field, fallback = '') => pickLocale(field, lang, fallback), [lang]);

  const value = useMemo(
    () => ({
      content,
      status,
      refresh,
      lc,
      lang,
    }),
    [content, status, refresh, lc, lang]
  );

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  const ctx = useContext(SiteContentContext);
  if (!ctx) {
    throw new Error('useSiteContent must be used within SiteContentProvider');
  }
  return ctx;
}
