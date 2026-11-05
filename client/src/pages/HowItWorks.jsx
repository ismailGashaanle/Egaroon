import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Button from '../components/common/Button';
import ProcessTimeline from '../components/how-it-works/ProcessTimeline';
import { useTranslation } from '../i18n/LanguageContext';

export default function HowItWorks() {
  const { t, isRtl } = useTranslation();

  return (
    <PageTransition>
      <section className="bg-warmwhite dark:bg-dark-bg">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
          <header className="mx-auto max-w-2xl">
            <h1 className="font-display text-3xl font-bold tracking-tight text-charcoal sm:text-4xl lg:text-[2.75rem] dark:text-dark-text">
              {t('how.title')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg dark:text-dark-muted">
              {t('how.subtitle')}
            </p>
          </header>

          <ProcessTimeline />

          <div className="mx-auto mt-16 max-w-xl border-t border-border pt-10 dark:border-dark-border">
            <h2 className="font-display text-xl font-bold text-charcoal sm:text-2xl dark:text-dark-text">
              {t('how.ctaHeading')}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button as={Link} to="/search-fields" size="lg" className="gap-2">
                {t('how.cta')}
                <FiArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
              </Button>
              <Button as={Link} to="/register" size="lg" variant="outline">
                {t('how.ctaSecondary')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
