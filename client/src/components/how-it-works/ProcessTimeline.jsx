import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FiArrowDown,
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiNavigation,
  FiSearch,
  FiShield,
  FiStar,
  FiAward,
  FiUsers,
  FiWatch,
  FiGrid,
} from 'react-icons/fi';
import { useTranslation } from '../../i18n/LanguageContext';

const GREEN = '#10B981';
const NAVY = '#1E2433';

const STEPS = [
  {
    id: 'find',
    Icon: FiSearch,
    detailIcons: [FiMapPin, FiNavigation, FiCreditCard],
  },
  {
    id: 'hold',
    Icon: FiClock,
    pending: true,
    detailIcons: [FiCalendar, FiWatch, FiClock],
  },
  {
    id: 'pay',
    Icon: FiShield,
    detailIcons: [FiUsers, FiShield, FiCreditCard],
  },
  {
    id: 'play',
    Icon: FiAward,
    detailIcons: [FiGrid, FiAward, FiStar],
  },
];

function stepDetails(t, n) {
  const items = [];
  for (let i = 1; i <= 6; i += 1) {
    const key = `how.step${n}Detail${i}`;
    const value = t(key);
    if (!value || value === key) break;
    items.push(value);
  }
  return items;
}

const ease = [0.22, 1, 0.36, 1];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export default function ProcessTimeline() {
  const { t, isRtl } = useTranslation();
  const reduceMotion = useReducedMotion();
  const uid = useId();
  const isDesktop = useIsDesktop();
  const [active, setActive] = useState(0);
  const btnRefs = useRef([]);

  const steps = STEPS.map((meta, index) => {
    const n = index + 1;
    return {
      ...meta,
      n,
      title: t(`how.step${n}Title`),
      desc: t(`how.step${n}Desc`),
      details: stepDetails(t, n),
    };
  });

  const progress = steps.length > 1 ? active / (steps.length - 1) : 0;
  const panelId = `${uid}-panel`;

  const goTo = (index, { focus } = {}) => {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setActive(next);
    if (focus) {
      requestAnimationFrame(() => btnRefs.current[next]?.focus?.());
    }
  };

  const onListKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(active + (isRtl ? -1 : 1), { focus: true });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(active + (isRtl ? 1 : -1), { focus: true });
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      goTo(active + 1, { focus: true });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      goTo(active - 1, { focus: true });
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0, { focus: true });
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(steps.length - 1, { focus: true });
    }
  };

  const arrowLoop = reduceMotion
    ? {}
    : {
        x: isRtl ? [0, -5, 0] : [0, 5, 0],
      };
  const arrowDownLoop = reduceMotion ? {} : { y: [0, 5, 0] };

  return (
    <div className="mt-12 sm:mt-14">
      {isDesktop ? (
      <div>
        <div className="relative px-4 pt-2 pb-4">
          <div
            className="pointer-events-none absolute start-[12.5%] end-[12.5%] top-10 h-[3px] rounded-full bg-slate-200 dark:bg-dark-border"
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute start-[12.5%] top-10 h-[3px] origin-start rounded-full"
            style={{
              backgroundColor: GREEN,
              width: '75%',
            }}
            initial={false}
            animate={{ scaleX: progress }}
            transition={{ duration: 0.45, ease }}
            aria-hidden
          />

          {steps.slice(0, -1).map((_, i) => {
            const reached = active > i;
            return (
              <div
                key={`arrow-${i}`}
                className="pointer-events-none absolute top-10 z-10 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2"
                style={{ insetInlineStart: `${((i + 1) / steps.length) * 100}%` }}
                aria-hidden
              >
                <motion.span
                  className="flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-soft dark:border-dark-border dark:bg-dark-surface"
                  style={{
                    borderColor: reached ? GREEN : '#E2E8F0',
                    color: reached ? GREEN : '#94A3B8',
                  }}
                  animate={arrowLoop}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
                  }
                >
                  <FiArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />
                </motion.span>
              </div>
            );
          })}

          <ol
            className="relative grid grid-cols-4 gap-4"
            onKeyDown={onListKeyDown}
          >
            {steps.map((step, index) => (
              <motion.li
                key={step.id}
                className="flex flex-col items-center text-center"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.1, duration: 0.4, ease }}
              >
                <StepCircle
                  step={step}
                  index={index}
                  active={active}
                  panelId={panelId}
                  buttonRef={(el) => {
                    btnRefs.current[index] = el;
                  }}
                  onSelect={() => goTo(index)}
                />
                <StepMeta
                  step={step}
                  headingId={`${uid}-step-${step.id}`}
                  isActive={active === index}
                  pendingLabel={t('how.holdBadge')}
                />
              </motion.li>
            ))}
          </ol>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={steps[active].id}
            id={panelId}
            role="region"
            aria-labelledby={`${uid}-step-${steps[active].id}`}
            initial={reduceMotion ? false : { opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.32, ease }}
            className="overflow-hidden"
          >
            <DetailPanel step={steps[active]} isRtl={isRtl} reduceMotion={reduceMotion} />
          </motion.div>
        </AnimatePresence>
      </div>
      ) : (
      <ol className="relative" onKeyDown={onListKeyDown}>
        <div
          className="pointer-events-none absolute top-5 bottom-8 w-[3px] rounded-full bg-slate-200 dark:bg-dark-border"
          style={{ [isRtl ? 'right' : 'left']: 27 }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute top-5 w-[3px] origin-top rounded-full"
          style={{
            [isRtl ? 'right' : 'left']: 27,
            backgroundColor: GREEN,
            height: 'calc(100% - 4.5rem)',
          }}
          initial={false}
          animate={{ scaleY: progress }}
          transition={{ duration: 0.45, ease }}
          aria-hidden
        />

        {steps.map((step, index) => {
          const isActive = active === index;
          const detailsId = `${uid}-m-${step.id}`;
          return (
            <motion.li
              key={step.id}
              className="relative flex gap-4 pb-8 last:pb-0 sm:gap-5"
              initial={reduceMotion ? false : { opacity: 0, x: isRtl ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + index * 0.1, duration: 0.4, ease }}
            >
              <div className="relative z-10 shrink-0">
                <StepCircle
                  step={step}
                  index={index}
                  active={active}
                  panelId={detailsId}
                  compact
                  buttonRef={(el) => {
                    btnRefs.current[index] = el;
                  }}
                  onSelect={() => goTo(index)}
                />
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <StepMeta
                  step={step}
                  headingId={`${uid}-step-${step.id}`}
                  isActive={isActive}
                  pendingLabel={t('how.holdBadge')}
                  align="start"
                />
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      id={detailsId}
                      role="region"
                      aria-labelledby={`${uid}-step-${step.id}`}
                      initial={reduceMotion ? false : { opacity: 0, height: 0, y: 8 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <DetailList step={step} isRtl={isRtl} reduceMotion={reduceMotion} compact />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {index < steps.length - 1 && (
                <motion.span
                  className="pointer-events-none absolute bottom-2 z-10"
                  style={{ [isRtl ? 'right' : 'left']: 19 }}
                  animate={arrowDownLoop}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.1 }
                  }
                  aria-hidden
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow-soft dark:bg-dark-surface"
                    style={{ color: active > index ? GREEN : undefined }}
                  >
                    <FiArrowDown size={13} />
                  </span>
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ol>
      )}
    </div>
  );
}

function StepCircle({ step, index, active, panelId, onSelect, buttonRef, compact = false }) {
  const isActive = active === index;
  const isDone = active > index;
  const filled = isActive || isDone;
  const size = compact ? 'h-14 w-14 text-lg' : 'h-20 w-20 text-xl';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      aria-label={`${String(step.n).padStart(2, '0')} ${step.title}`}
      aria-expanded={isActive}
      aria-controls={panelId}
      aria-current={isActive ? 'step' : undefined}
      className={`focus-ring group relative flex ${size} items-center justify-center rounded-full font-display font-bold tracking-tight transition-transform duration-200 hover:scale-[1.04] ${
        filled ? 'text-white shadow-lifted' : 'bg-white text-[#1E2433] shadow-soft hover:border-[#10B981]/40 dark:bg-dark-surface dark:text-dark-text'
      }`}
      style={{
        backgroundColor: filled ? GREEN : undefined,
        boxShadow: isActive
          ? `0 0 0 6px rgb(16 185 129 / 0.18), 0 10px 24px -8px rgb(16 185 129 / 0.45)`
          : undefined,
        border: filled ? 'none' : '2px solid #E2E8F0',
      }}
    >
      <span className="relative z-10">{String(step.n).padStart(2, '0')}</span>
      {isActive && !compact && (
        <span
          className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-soft dark:bg-dark-surface"
          style={{ color: GREEN }}
          aria-hidden
        >
          <step.Icon size={14} strokeWidth={2.25} />
        </span>
      )}
    </button>
  );
}

function StepMeta({ step, isActive, pendingLabel, align = 'center', headingId }) {
  const Icon = step.Icon;
  return (
    <div className={`mt-4 ${align === 'start' ? 'text-start' : 'text-center'}`}>
      <div
        className={`flex items-center gap-2 ${align === 'start' ? 'justify-start' : 'justify-center'}`}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            backgroundColor: isActive ? 'rgb(16 185 129 / 0.12)' : 'rgb(30 36 51 / 0.06)',
            color: isActive ? GREEN : NAVY,
          }}
        >
          <Icon size={16} strokeWidth={2.1} />
        </span>
        <h3
          id={headingId}
          className={`font-display text-base font-bold sm:text-lg ${
            isActive ? '' : 'text-[#1E2433] dark:text-dark-text'
          }`}
          style={isActive ? { color: GREEN } : undefined}
        >
          {step.title}
        </h3>
        {step.pending && (
          <span className="rounded-full bg-[#FFF4E8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C2410C]">
            {pendingLabel}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted dark:text-dark-muted lg:mx-auto">
        {step.desc}
      </p>
    </div>
  );
}

function DetailPanel({ step, isRtl, reduceMotion }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-dark-border dark:bg-dark-surface sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: GREEN }}
        >
          <step.Icon size={18} strokeWidth={2.2} />
        </span>
        <div>
          <p className="text-xs font-semibold text-forest">
            {String(step.n).padStart(2, '0')}
          </p>
          <p className="font-display text-lg font-bold" style={{ color: NAVY }}>
            {step.title}
          </p>
        </div>
      </div>
      <DetailList step={step} isRtl={isRtl} reduceMotion={reduceMotion} />
    </div>
  );
}

function DetailList({ step, isRtl, reduceMotion, compact = false }) {
  return (
    <ul className={`${compact ? 'mt-4' : ''} space-y-3`}>
      {step.details.map((line, i) => {
        const DIcon = step.detailIcons[i] || FiShield;
        return (
          <motion.li
            key={line}
            initial={reduceMotion ? false : { opacity: 0, x: isRtl ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 + i * 0.06, duration: 0.28, ease }}
            className="flex items-start gap-3 text-sm leading-relaxed text-slate-600 dark:text-dark-muted sm:text-[15px]"
          >
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgb(16 185 129 / 0.1)', color: GREEN }}
            >
              <DIcon size={15} strokeWidth={2.2} />
            </span>
            <span className="pt-1">{line}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}
