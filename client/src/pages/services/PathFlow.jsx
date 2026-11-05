import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from '../../i18n/LanguageContext';
import { PATH_STEPS } from './servicesData';

const ease = [0.22, 1, 0.36, 1];
const DWELL_MS = 4200;
const COUNT = PATH_STEPS.length;

const TINTS = [
  'from-emerald-500/50 via-transparent to-brand-navy/45',
  'from-amber-400/45 via-transparent to-brand-navy/50',
  'from-sky-400/40 via-transparent to-brand-navy/45',
  'from-violet-400/40 via-transparent to-brand-navy/45',
  'from-lime-400/45 via-transparent to-brand-navy/40',
  'from-brand-green/55 via-emerald-400/20 to-brand-navy/40',
];

function PathFlow() {
  const { t, isRtl } = useTranslation();
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const stripRef = useRef(null);
  const prevRef = useRef(0);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loopFlash, setLoopFlash] = useState(0);
  const step = PATH_STEPS[active];
  const playing = !reduce && inView && !hidden;

  const goTo = useCallback((next) => {
    setActive(((next % COUNT) + COUNT) % COUNT);
  }, []);

  const onKeyDown = useCallback(
    (e) => {
      const nextKey = e.key === 'ArrowDown' || e.key === (isRtl ? 'ArrowLeft' : 'ArrowRight');
      const prevKey = e.key === 'ArrowUp' || e.key === (isRtl ? 'ArrowRight' : 'ArrowLeft');
      if (nextKey) {
        e.preventDefault();
        goTo(active + 1);
      } else if (prevKey) {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(COUNT - 1);
      }
    },
    [active, goTo, isRtl]
  );

  useEffect(() => {
    PATH_STEPS.forEach((item) => {
      const img = new Image();
      img.src = item.src;
    });
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.12,
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % COUNT), DWELL_MS);
    return () => window.clearTimeout(id);
  }, [active, playing]);

  useEffect(() => {
    if (prevRef.current === COUNT - 1 && active === 0) {
      setLoopFlash((n) => n + 1);
    }
    prevRef.current = active;
  }, [active]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const current = strip.querySelector('[aria-current="step"]');
    if (!current || typeof current.scrollIntoView !== 'function') return;
    current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [active, reduce]);

  return (
    <section ref={rootRef} className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
            {t('servicesPage.pathTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base dark:text-dark-muted">
            {t('servicesPage.pathLead')}
          </p>
        </header>

        <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-brand-navy shadow-lifted sm:mt-10 sm:rounded-[2rem] dark:border-dark-border">
          <div className="relative h-[min(68vh,28rem)] overflow-hidden sm:h-[min(58vh,26rem)] lg:h-[min(48vh,24rem)]">
            {PATH_STEPS.map((item, i) => {
              const on = i === active;
              return (
                <motion.div
                  key={item.src}
                  className="absolute inset-0"
                  initial={false}
                  animate={{
                    opacity: on ? 1 : 0,
                    scale: on ? 1 : 1.06,
                  }}
                  transition={{ duration: reduce ? 0 : 0.75, ease }}
                  style={{ zIndex: on ? 2 : 1 }}
                >
                  <img
                    src={item.src}
                    alt=""
                    width={1280}
                    height={720}
                    decoding="async"
                    fetchPriority={on ? 'high' : 'low'}
                    className={`absolute inset-0 h-full w-full object-cover ${
                      on && playing ? (i % 2 === 0 ? 'svc-path-ken' : 'svc-path-ken-alt') : ''
                    }`}
                  />
                </motion.div>
              );
            })}

            <AnimatePresence>
              <motion.div
                key={`tint-${step.key}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.7 }}
                className={`pointer-events-none absolute inset-0 z-[3] bg-gradient-to-tr ${TINTS[active]} ${playing ? 'svc-path-glow' : ''}`}
                aria-hidden
              />
            </AnimatePresence>
            <div
              className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-brand-navy via-brand-navy/40 to-transparent"
              aria-hidden
            />

            {loopFlash > 0 && playing ? (
              <span
                key={loopFlash}
                className="svc-path-flash pointer-events-none absolute inset-0 z-[4] bg-brand-green/40"
                aria-hidden
              />
            ) : null}

            <span className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-white/15">
              <span
                key={active}
                className={`svc-path-fill block h-full bg-brand-green ${playing ? '' : 'is-paused'}`}
              />
            </span>

            <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-16 sm:px-8 sm:pb-7 lg:max-w-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.key}
                  initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, y: -18, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, ease }}
                  aria-live="polite"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-11 w-11 items-center justify-center">
                      <svg className="absolute inset-0" viewBox="0 0 40 40" aria-hidden>
                        <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
                        <circle
                          key={active}
                          className={`svc-path-ring ${playing ? '' : 'is-paused'}`}
                          cx="20"
                          cy="20"
                          r="17"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="font-display text-sm font-bold text-white">{active + 1}</span>
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-green">
                      {active + 1} / {COUNT}
                    </p>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
                    {t(`servicesPage.${step.key}`)}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
                    {t(`servicesPage.${step.hint}`)}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <ol
            ref={stripRef}
            className="flex snap-x snap-mandatory overflow-x-auto border-t border-white/10 bg-brand-navy/90 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6 [&::-webkit-scrollbar]:hidden"
            onKeyDown={onKeyDown}
          >
            {PATH_STEPS.map((item, i) => {
              const on = i === active;
              return (
                <li key={item.key} className="min-w-[46%] snap-start sm:min-w-0">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={on ? 'step' : undefined}
                    className={`relative flex h-full w-full flex-col text-start outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green ${
                      on ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={item.src}
                        alt=""
                        width={320}
                        height={180}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover transition-[transform,opacity] duration-700 ${
                          on && playing
                            ? i % 2 === 0
                              ? 'svc-path-ken'
                              : 'svc-path-ken-alt'
                            : on
                              ? 'scale-105'
                              : 'scale-100 opacity-55'
                        }`}
                      />
                      <span
                        className={`absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-shadow duration-300 ${
                          on
                            ? 'bg-brand-green text-white shadow-[0_0_14px_rgba(16,185,129,0.85)]'
                            : 'bg-black/55 text-white'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </span>
                    <span className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                      <span className="line-clamp-2 font-display text-[11px] font-bold leading-snug text-white/90 sm:text-xs">
                        {t(`servicesPage.${item.key}`)}
                      </span>
                    </span>
                    {on ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/15">
                        <span
                          key={active}
                          className={`svc-path-fill block h-full bg-brand-green ${playing ? '' : 'is-paused'}`}
                        />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default memo(PathFlow);
