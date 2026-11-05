import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, Handshake, Users } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import SpotlightCard from './SpotlightCard';

const ease = [0.22, 1, 0.36, 1];

function Pipe({ vertical = false, reduce }) {
  return (
    <div
      className={vertical ? 'svc-pipe svc-pipe-v mx-auto md:hidden' : 'svc-pipe svc-pipe-h mx-auto hidden shrink-0 md:block'}
      aria-hidden
    >
      {reduce ? null : <span className="svc-pipe-dot" />}
    </div>
  );
}

function Node({ title, hint, Icon, hub = false }) {
  if (hub) {
    return (
      <SpotlightCard className="flex-1 rounded-3xl border border-brand-green/30 bg-brand-green p-6 text-center text-white shadow-lifted">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <Icon size={26} />
        </span>
        <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{hint}</p>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard className="flex-1 rounded-3xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green">
        <Icon size={26} />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/65">{hint}</p>
    </SpotlightCard>
  );
}

function ConnectFlow() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, ease }}
          className="text-center"
        >
          <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
            {t('servicesPage.connectTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted dark:text-dark-muted">{t('servicesPage.connectLead')}</p>
        </motion.header>

        <div className="relative mt-10 overflow-hidden rounded-[2rem] bg-brand-navy px-5 py-8 shadow-lifted sm:px-8 sm:py-10">
          <div className="svc-dots pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col items-stretch gap-1 md:flex-row md:items-center md:gap-2">
            <Node
              Icon={Users}
              title={t('servicesPage.nodeCaptain')}
              hint={t('servicesPage.nodeCaptainHint')}
            />
            <Pipe vertical reduce={reduce} />
            <Pipe reduce={reduce} />
            <Node
              hub
              Icon={Handshake}
              title={t('servicesPage.nodeHub')}
              hint={t('servicesPage.nodeHubHint')}
            />
            <Pipe vertical reduce={reduce} />
            <Pipe reduce={reduce} />
            <Node
              Icon={Building2}
              title={t('servicesPage.nodeOwner')}
              hint={t('servicesPage.nodeOwnerHint')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(ConnectFlow);
