import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarClock, CreditCard, Landmark, QrCode, Trophy, Users } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import SpotlightCard from './SpotlightCard';
import { SYSTEMS } from './servicesData';

const ICONS = {
  book: CalendarClock,
  pay: CreditCard,
  team: Users,
  owner: Landmark,
  cup: Trophy,
  match: QrCode,
};

const ease = [0.22, 1, 0.36, 1];

function SystemsGrid({ onCaptain }) {
  const { t, isRtl } = useTranslation();
  const reduce = useReducedMotion();
  const arrow = isRtl ? 'rotate-180' : '';

  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
          {t('servicesPage.systemsTitle')}
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEMS.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <motion.div
                key={item.key}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.05, ease }}
                className={item.featured ? 'sm:col-span-1 lg:col-span-1' : ''}
              >
                <Link to={item.to} className="block h-full">
                    <SpotlightCard className={`h-full rounded-[1.75rem] border bg-white p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1 hover:shadow-lifted dark:bg-dark-surface ${
                      item.featured
                        ? 'border-forest/25 dark:border-brand-green/30'
                        : 'border-border dark:border-dark-border'
                    }`}>
                    <Icon className="text-forest" size={22} />
                    <h3 className="mt-4 font-display text-lg font-bold text-charcoal dark:text-dark-text">
                      {t(`servicesPage.${item.key}`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">
                      {t(`servicesPage.${item.hint}`)}
                    </p>
                    <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-forest">
                      {t('servicesPage.open')}
                      <ArrowRight size={12} className={arrow} />
                    </p>
                  </SpotlightCard>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onCaptain}
            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.9)] hover:bg-forest-dark"
          >
            {t('servicesPage.ctaCaptain')}
            <ArrowRight size={16} className={arrow} />
          </button>
          <Link
            to="/contact"
            className="inline-flex items-center rounded-full border border-border px-6 py-3.5 text-sm font-bold text-charcoal hover:border-forest dark:border-dark-border dark:text-dark-text"
          >
            {t('nav.contact')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default memo(SystemsGrid);
