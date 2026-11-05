import { lazy, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import PageTransition from '../components/common/PageTransition';
import { useTranslation } from '../i18n/LanguageContext';
import LazySection from './services/LazySection';

const ConnectFlow = lazy(() => import('./services/ConnectFlow'));
const RoleSplit = lazy(() => import('./services/RoleSplit'));
const PathFlow = lazy(() => import('./services/PathFlow'));
const SystemsGrid = lazy(() => import('./services/SystemsGrid'));

const ease = [0.22, 1, 0.36, 1];

function prefetchSections() {
  import('./services/ConnectFlow');
  import('./services/RoleSplit');
  import('./services/PathFlow');
  import('./services/SystemsGrid');
}

export default function Services() {
  const { t, isRtl } = useTranslation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const arrow = isRtl ? 'rotate-180' : '';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchSections, { timeout: 1600 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetchSections, 500);
    return () => window.clearTimeout(timer);
  }, []);

  const goCaptain = useCallback(() => {
    toast.success(t('servicesPage.toastCaptain'));
    navigate('/search-fields');
  }, [navigate, t]);

  const goOwner = useCallback(() => {
    toast.success(t('servicesPage.toastOwner'));
    navigate('/register');
  }, [navigate, t]);

  return (
    <PageTransition>
      <div className="overflow-x-hidden bg-warmwhite dark:bg-dark-bg">
        <section className="relative isolate px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="svc-orb absolute -start-24 top-0 h-72 w-72 rounded-full bg-brand-green/25 blur-3xl" />
            <div className="svc-orb svc-orb-delay absolute -end-16 top-24 h-80 w-80 rounded-full bg-brand-navy/20 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-3xl text-center">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold uppercase tracking-[0.22em] text-forest"
            >
              {t('servicesPage.kicker')}
            </motion.p>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5, ease }}
              className="mt-3 font-display text-4xl font-extrabold tracking-tight text-charcoal sm:text-5xl dark:text-dark-text"
            >
              {t('servicesPage.title')}
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease }}
              className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg dark:text-dark-muted"
            >
              {t('servicesPage.subtitle')}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.16 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-bold"
            >
              <span className="rounded-full border border-border bg-white px-3 py-1.5 text-charcoal dark:border-dark-border dark:bg-dark-surface dark:text-dark-text">
                {t('servicesPage.nodeCaptain')}
              </span>
              <ArrowRight size={14} className={`text-forest ${arrow}`} />
              <span className="rounded-full bg-brand-green px-3 py-1.5 text-white">{t('servicesPage.nodeHub')}</span>
              <ArrowRight size={14} className={`text-forest ${arrow}`} />
              <span className="rounded-full border border-border bg-white px-3 py-1.5 text-charcoal dark:border-dark-border dark:bg-dark-surface dark:text-dark-text">
                {t('servicesPage.nodeOwner')}
              </span>
            </motion.div>

            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-4 py-2 text-sm font-semibold text-forest"
            >
              <ShieldCheck size={16} />
              {t('servicesPage.rule')}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.4, ease }}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              <button
                type="button"
                onClick={goCaptain}
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.9)] hover:bg-forest-dark"
              >
                {t('servicesPage.ctaCaptain')}
                <ArrowRight size={16} className={arrow} />
              </button>
              <button
                type="button"
                onClick={goOwner}
                className="inline-flex items-center rounded-full border border-border bg-white px-6 py-3.5 text-sm font-bold text-charcoal hover:border-forest dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
              >
                {t('servicesPage.ctaOwner')}
              </button>
            </motion.div>
          </div>
        </section>

        <LazySection minHeight={420}>
          <ConnectFlow />
        </LazySection>
        <LazySection minHeight={320}>
          <RoleSplit onCaptain={goCaptain} onOwner={goOwner} />
        </LazySection>
        <LazySection minHeight={520}>
          <PathFlow />
        </LazySection>
        <LazySection minHeight={560}>
          <SystemsGrid onCaptain={goCaptain} />
        </LazySection>
      </div>
    </PageTransition>
  );
}
