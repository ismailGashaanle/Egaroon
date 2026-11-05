import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import clsx from 'clsx';
import {
  FiClock,
  FiLock,
  FiNavigation,
  FiMapPin,
  FiMessageCircle,
  FiX,
  FiAlertCircle,
  FiCheck,
  FiArrowRight,
} from 'react-icons/fi';
import CldImage from '../common/CldImage';
import Modal from '../common/Modal';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ProblemDetailsContent from './ProblemDetailsContent';

const NOTEBOOK_IMAGE =
  'https://images.unsplash.com/photo-1731963094554-c5c981ccdefd?auto=format&fit=crop&w=1200&q=80';
const PITCH_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80';
const CITY_IMAGE =
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=80';

const HOLD_START = 252;
const ease = [0.22, 1, 0.36, 1];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease } },
};

function formatHold(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function useDemoHold(reduced) {
  const [sec, setSec] = useState(HOLD_START);

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => {
      setSec((prev) => (prev <= 1 ? HOLD_START : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [reduced]);

  return { label: formatHold(sec), progress: sec / HOLD_START };
}

function SlotCell({ time, label, variant, live, hold, holdProgress, reduced, delay = 0 }) {
  const styles = {
    booked: 'border-red-700/80 bg-red-600 text-white',
    hold: 'border-sky-700/80 bg-sky-600 text-white slot-hold',
    open: 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-100',
    past: 'border-slate-400 bg-slate-200 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.32, delay, ease }}
      whileHover={reduced ? undefined : { y: -2, scale: 1.03 }}
      className={clsx(
        'relative flex min-h-[3.35rem] flex-col items-center justify-center overflow-hidden rounded-lg border px-1.5 py-1.5 text-center',
        styles[variant],
        live && 'slot-live'
      )}
    >
      {variant === 'booked' ? (
        <span className="pointer-events-none absolute inset-0 solved-stripes opacity-70" aria-hidden />
      ) : null}
      <span
        className={clsx(
          'font-display text-[13px] font-bold leading-none tabular-nums',
          variant === 'past' && 'line-through decoration-2'
        )}
      >
        {time}
      </span>
      <span className="font-ui mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-semibold leading-tight">
        {variant === 'booked' || variant === 'past' ? (
          <FiLock size={9} className="shrink-0" aria-hidden />
        ) : variant === 'hold' ? (
          <FiClock size={9} className="shrink-0" aria-hidden />
        ) : (
          <FiCheck size={9} className="shrink-0" aria-hidden />
        )}
        {label}
      </span>
      {hold ? <span className="font-ui text-[9px] font-bold opacity-95">{hold}</span> : null}
      {variant === 'hold' && holdProgress != null ? (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/25" aria-hidden>
          <span
            className="block h-full bg-white/90 transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(8, holdProgress * 100)}%` }}
          />
        </span>
      ) : null}
    </motion.div>
  );
}

function NearbyRadar({ reduced }) {
  return (
    <div className="relative mx-auto h-[4.5rem] w-[4.5rem]">
      <div className="absolute inset-0 rounded-full border border-white/40" />
      <div className="absolute inset-[22%] rounded-full border border-white/55" />
      {!reduced ? (
        <>
          <span className="solved-radar pointer-events-none absolute inset-0 rounded-full bg-brand-green/30" />
          <span className="solved-radar solved-radar-delay pointer-events-none absolute inset-0 rounded-full bg-brand-green/20" />
        </>
      ) : null}
      <span className="absolute left-1/2 top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green">
        <span className="pin-ping absolute inset-0 rounded-full bg-brand-green" />
      </span>
      <span className="absolute left-[70%] top-[28%] z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-green">
        <FiMapPin size={9} aria-hidden />
      </span>
      <span className="absolute left-[92%] top-[8%] z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-status-cancelled-bg text-status-cancelled-text">
        <FiX size={9} aria-hidden />
      </span>
    </div>
  );
}

export default function SolvedProblems({ t, reduced = false }) {
  const { label: holdLabel, progress } = useDemoHold(reduced);
  const barRef = useRef(null);
  const barInView = useInView(barRef, { once: true, amount: 0.6 });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState('story');
  const [highlight, setHighlight] = useState(null);

  const openDetails = (tab = 'story', cardKey = null) => {
    setDetailsTab(tab);
    setHighlight(cardKey);
    setDetailsOpen(true);
  };

  useEffect(() => {
    if (!detailsOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [detailsOpen]);

  const cards = [
    {
      key: 'slots',
      title: t('home.solved1'),
      desc: t('home.solved1d'),
      photo: PITCH_IMAGE,
      photoAlt: t('home.solvedSlotsImageAlt'),
      accent: 'from-emerald-500 to-brand-green',
      iconWrap: 'bg-brand-green text-white',
      ring: 'hover:ring-brand-green/25',
      Icon: FiClock,
    },
    {
      key: 'errors',
      title: t('home.solved2'),
      desc: t('home.solved2d'),
      photo: NOTEBOOK_IMAGE,
      photoAlt: t('home.solvedImageAlt'),
      accent: 'from-rose-500 to-status-cancelled-text',
      iconWrap: 'bg-status-cancelled-text text-white',
      ring: 'hover:ring-rose-400/25',
      Icon: FiLock,
    },
    {
      key: 'nearby',
      title: t('home.solved3'),
      desc: t('home.solved3d'),
      photo: CITY_IMAGE,
      photoAlt: t('home.solvedNearbyImageAlt'),
      accent: 'from-sky-400 to-status-info-text',
      iconWrap: 'bg-status-info-text text-white',
      ring: 'hover:ring-sky-400/25',
      Icon: FiNavigation,
    },
  ];

  const legend = [
    { key: 'booked', label: t('search.booked'), swatch: 'bg-red-600' },
    { key: 'hold', label: t('search.dooran'), swatch: 'bg-sky-600' },
    { key: 'open', label: t('search.available'), swatch: 'bg-emerald-500' },
  ];

  return (
    <section className="relative scroll-mt-24 py-5 sm:py-6">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, ease }}
          className="grid cursor-pointer overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-shadow hover:shadow-lifted dark:border-dark-border dark:bg-dark-surface lg:grid-cols-[minmax(0,240px)_1fr]"
          onClick={() => openDetails('story')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetails('story');
            }
          }}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={detailsOpen}
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, x: -18 }}
            whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease }}
            className={clsx('relative h-36 overflow-hidden lg:h-full lg:min-h-[168px]', !reduced && 'solved-shine')}
          >
            <CldImage
              src={NOTEBOOK_IMAGE}
              alt={t('home.solvedImageAlt')}
              width={720}
              height={480}
              crop={false}
              className={clsx('h-full w-full object-cover', !reduced && 'solved-kenburns')}
            />
          </motion.div>

          <motion.div
            initial={reduced ? false : { opacity: 0, x: 18 }}
            whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.08, ease }}
            className="flex flex-col justify-center px-5 py-5 sm:px-7 sm:py-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-ui rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted dark:border-dark-border dark:text-dark-muted">
                {t('home.solvedThen')}
              </span>
              <FiArrowRight
                className={clsx('text-brand-green', !reduced && 'solved-arrow')}
                size={14}
                aria-hidden
              />
              <span className="font-ui inline-flex items-center gap-1.5 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white slot-dot" aria-hidden />
                {t('home.solvedNow')}
              </span>
            </div>
            <p className="font-ui mt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-green">
              {t('home.solvedOverline')}
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-charcoal sm:text-[1.7rem] dark:text-dark-text">
              {t('home.solvedTitle')}
            </h2>
            <p className="font-ui mt-1.5 max-w-xl text-sm leading-relaxed text-muted dark:text-dark-muted">
              {t('home.solvedDesc')}
            </p>
            <span className="font-ui mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-green">
              {t('home.solvedReadMore')}
              <FiArrowRight size={14} aria-hidden />
            </span>
          </motion.div>
        </motion.header>

        <motion.div
          variants={listVariants}
          initial={reduced ? false : 'hidden'}
          whileInView={reduced ? undefined : 'show'}
          viewport={{ once: true, amount: 0.16 }}
          className="mt-5 grid items-stretch gap-3 lg:grid-cols-3"
        >
          {cards.map((card) => (
            <motion.article
              key={card.key}
              variants={cardVariants}
              whileHover={reduced ? undefined : { y: -5 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={clsx(
                'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-soft ring-1 ring-transparent transition-[box-shadow,ring-color] duration-300 hover:shadow-card dark:border-dark-border dark:bg-dark-surface',
                card.ring
              )}
            >
              <div className="relative h-[88px] overflow-hidden">
                <CldImage
                  src={card.photo}
                  alt=""
                  width={640}
                  height={220}
                  crop={false}
                  className={clsx(
                    'h-full w-full object-cover transition-transform duration-500 ease-out',
                    !reduced && 'group-hover:scale-105'
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/75 via-brand-navy/20 to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5">
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      card.iconWrap
                    )}
                    aria-hidden
                  >
                    <card.Icon size={13} />
                  </span>
                  <h3 className="font-display min-w-0 truncate text-[15px] font-bold text-white">
                    {card.title}
                  </h3>
                  {card.key === 'slots' ? (
                    <span className="font-ui ms-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 slot-dot" aria-hidden />
                      {t('home.solvedLive')}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className={clsx('block h-0.5 bg-gradient-to-r', card.accent)} aria-hidden />

              <div className="flex flex-1 flex-col p-3">
                {card.key === 'slots' && (
                  <div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <SlotCell time="19:00" label={t('search.booked')} variant="booked" reduced={reduced} delay={0.08} />
                      <SlotCell
                        time="20:00"
                        label={t('search.dooran')}
                        variant="hold"
                        hold={t('search.selectedCountdown', { time: holdLabel })}
                        holdProgress={progress}
                        reduced={reduced}
                        delay={0.14}
                      />
                      <SlotCell
                        time="21:00"
                        label={t('search.available')}
                        variant="open"
                        live
                        reduced={reduced}
                        delay={0.2}
                      />
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                      {legend.map((item) => (
                        <li
                          key={item.key}
                          className="font-ui flex items-center gap-1 text-[10px] font-medium text-muted dark:text-dark-muted"
                        >
                          <span className={clsx('h-1.5 w-1.5 rounded-full', item.swatch)} aria-hidden />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {card.key === 'errors' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <SlotCell
                        time="18:00"
                        label={t('home.solvedPast')}
                        variant="past"
                        reduced={reduced}
                        delay={0.08}
                      />
                      <span
                        className={clsx(
                          'absolute -top-1.5 -end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-status-cancelled-text text-white',
                          !reduced && 'solved-shake'
                        )}
                        aria-hidden
                      >
                        <FiLock size={11} />
                      </span>
                    </div>
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: 0.2, ease }}
                      className="flex gap-2 rounded-lg border border-status-cancelled-text/15 bg-status-cancelled-bg px-2.5 py-2 dark:border-red-400/20 dark:bg-red-950/40"
                    >
                      <FiAlertCircle
                        className="mt-0.5 shrink-0 text-status-cancelled-text dark:text-red-300"
                        size={14}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="font-ui text-[11px] font-semibold leading-snug text-status-cancelled-text dark:text-red-200">
                          {t('home.solved2d')}
                        </p>
                        <Link
                          to="/contact"
                          className="font-ui mt-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-charcoal transition-colors hover:bg-brand-green hover:text-white dark:bg-dark-surface dark:text-dark-text dark:hover:bg-brand-green dark:hover:text-white"
                        >
                          <FiMessageCircle size={11} aria-hidden />
                          {t('nav.contact')}
                        </Link>
                      </div>
                    </motion.div>
                  </div>
                )}

                {card.key === 'nearby' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="font-ui inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-charcoal dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-dark-text">
                          <FiNavigation size={10} className="text-status-info-text" aria-hidden />
                          {t('home.solvedGps')}
                        </span>
                        <span className="font-ui inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-charcoal dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-dark-text">
                          <FiMapPin size={10} className="text-brand-green" aria-hidden />
                          {t('home.solvedCity')}
                        </span>
                      </div>
                      <NearbyRadar reduced={reduced} />
                    </div>
                    <div ref={barRef}>
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-border dark:bg-dark-border">
                        <motion.div
                          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-brand-green to-sky-400"
                          initial={{ width: reduced ? '62%' : 0 }}
                          animate={barInView || reduced ? { width: '62%' } : { width: 0 }}
                          transition={{ duration: 0.9, ease, delay: 0.1 }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="font-ui font-semibold text-muted dark:text-dark-muted">0</span>
                        <span className="font-display text-sm font-bold text-status-info-text dark:text-sky-300">
                          30 km · {t('home.solvedWithin')}
                        </span>
                        <span className="font-ui flex items-center gap-0.5 font-semibold text-status-cancelled-text">
                          <FiX size={10} aria-hidden />
                          {t('home.solvedTooFar')}
                        </span>
                      </div>
                    </div>
                    <p className="font-ui text-[11px] leading-snug text-muted dark:text-dark-muted">{card.desc}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openDetails('fixes', card.key)}
                  className="font-ui mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-bold text-brand-green hover:underline"
                >
                  {t('home.solvedReadMore')}
                  <FiArrowRight size={12} aria-hidden />
                </button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>

      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        hideHeader
        size="4xl"
        contentClassName="!px-0 !py-0"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-white px-5 py-4 dark:border-dark-border dark:bg-dark-surface sm:px-6">
          <div className="min-w-0">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-wide text-brand-green">
              {t('home.solvedOverline')}
            </p>
            <h3 className="font-display mt-0.5 text-xl font-bold text-charcoal dark:text-dark-text">
              {t('home.solvedTitle')}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-charcoal/5 dark:text-dark-muted dark:hover:bg-white/5"
              aria-label={t('common.cancel')}
            >
              <FiX />
            </button>
          </div>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <ProblemDetailsContent
            tab={detailsTab}
            onTab={setDetailsTab}
            highlight={highlight}
          />
        </div>
      </Modal>
    </section>
  );
}
