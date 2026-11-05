import { memo } from 'react';
import { ArrowRight, Building2, Users } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import SpotlightCard from './SpotlightCard';

function RoleSplit({ onCaptain, onOwner }) {
  const { t, isRtl } = useTranslation();
  const arrow = isRtl ? 'rotate-180' : '';

  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        <SpotlightCard className="rounded-[1.75rem] border border-border bg-white p-7 shadow-soft sm:p-8 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest">01</p>
          <Users className="mt-3 text-forest" size={26} />
          <h3 className="mt-3 font-display text-xl font-bold text-charcoal dark:text-dark-text">
            {t('servicesPage.captainsTitle')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">{t('servicesPage.captainsBody')}</p>
          <button
            type="button"
            onClick={onCaptain}
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-forest-dark"
          >
            {t('servicesPage.ctaCaptain')}
            <ArrowRight size={16} className={arrow} />
          </button>
        </SpotlightCard>

        <SpotlightCard className="rounded-[1.75rem] border border-border bg-white p-7 shadow-soft sm:p-8 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest">02</p>
          <Building2 className="mt-3 text-forest" size={26} />
          <h3 className="mt-3 font-display text-xl font-bold text-charcoal dark:text-dark-text">
            {t('servicesPage.ownersTitle')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">{t('servicesPage.ownersBody')}</p>
          <button
            type="button"
            onClick={onOwner}
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-forest-dark"
          >
            {t('servicesPage.ctaOwner')}
            <ArrowRight size={16} className={arrow} />
          </button>
        </SpotlightCard>
      </div>
    </section>
  );
}

export default memo(RoleSplit);
