import { FiGlobe, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useLanguage } from '../../i18n/LanguageContext';
import DropdownMenu, { DropdownItem } from './DropdownMenu';

const LOCALES_TOAST = {
  en: 'Language updated',
  so: 'Luuqadda waa la cusbooneysiiyay',
  ar: 'تم تحديث اللغة',
};

/**
 * Compact language picker — EN / SO / AR with RTL awareness.
 */
export default function LanguageSwitcher({ compact = false, className, ghost = false }) {
  const { lang, setLang, langs, t } = useLanguage();
  const current = langs.find((l) => l.code === lang) || langs[0];

  const onChange = (code) => {
    if (code === lang) return;
    setLang(code);
    toast.success(LOCALES_TOAST[code] || t('lang.saved'));
  };

  if (compact) {
    return (
      <DropdownMenu
        className={className}
        align="end"
        trigger={({ open }) => (
          <button
            type="button"
            aria-label={t('lang.label')}
            title={t('lang.choose')}
            className={clsx(
              'focus-ring inline-flex h-9 items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              ghost
                ? clsx(
                    'rounded-lg px-2',
                    open
                      ? 'bg-charcoal/[0.06] text-charcoal dark:bg-white/10 dark:text-dark-text'
                      : 'text-muted hover:bg-charcoal/[0.06] hover:text-charcoal dark:text-dark-muted dark:hover:bg-white/10 dark:hover:text-dark-text'
                  )
                : clsx(
                    'rounded-full border px-2.5',
                    open
                      ? 'border-brand-green/40 bg-brand-green/5 text-brand-green'
                      : 'border-border text-charcoal hover:border-forest/40 dark:border-dark-border dark:text-dark-text'
                  )
            )}
          >
            <FiGlobe size={15} className={ghost ? 'opacity-80' : 'text-muted dark:text-dark-muted'} />
            {current.code}
          </button>
        )}
      >
        {langs.map((l) => (
          <DropdownItem key={l.code} onClick={() => onChange(l.code)}>
            <span className="flex w-full items-center justify-between gap-4">
              <span>
                <span className="me-2 font-bold uppercase text-muted">{l.code}</span>
                {l.native}
              </span>
              {l.code === lang && <FiCheck size={14} className="text-brand-green" />}
            </span>
          </DropdownItem>
        ))}
      </DropdownMenu>
    );
  }

  return (
    <div className={clsx('relative inline-flex items-center', className)} title={t('lang.choose')}>
      <FiGlobe className="pointer-events-none absolute start-2.5 text-muted dark:text-dark-muted" size={14} />
      <select
        aria-label={t('lang.label')}
        value={lang}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring appearance-none rounded-xl border border-border bg-white py-1.5 ps-8 pe-3 text-xs font-semibold text-charcoal hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
      >
        {langs.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
