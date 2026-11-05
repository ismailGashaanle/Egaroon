import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import Button from '../components/common/Button';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { useTranslation } from '../i18n/LanguageContext';

export default function Offline({ onRetry, checking = false }) {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-screen flex-col bg-warmwhite dark:bg-dark-bg"
      role="alert"
      aria-live="assertive"
    >
      <header className="flex justify-end px-4 py-4 sm:px-6">
        <LanguageSwitcher compact />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <FiWifiOff size={32} aria-hidden className="text-charcoal dark:text-dark-text" />
          <h1 className="mt-5 font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
            {t('offline.title')}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted dark:text-dark-muted">
            {t('offline.body')}
          </p>
          <Button
            type="button"
            className="mt-8 gap-2"
            loading={checking}
            onClick={onRetry}
            icon={<FiRefreshCw size={16} />}
          >
            {t('offline.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
}
