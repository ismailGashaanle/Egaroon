import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  FiBookOpen,
  FiUsers,
  FiHome,
  FiCreditCard,
  FiCheckCircle,
  FiTarget,
  FiClock,
  FiLock,
  FiNavigation,
  FiArrowRight,
} from 'react-icons/fi';
import { useTranslation } from '../../i18n/LanguageContext';
import Button from '../common/Button';

const TABS = [
  { id: 'story', Icon: FiBookOpen, labelKey: 'problems.tabStory' },
  { id: 'teams', Icon: FiUsers, labelKey: 'problems.tabTeams' },
  { id: 'owners', Icon: FiHome, labelKey: 'problems.tabOwners' },
  { id: 'pay', Icon: FiCreditCard, labelKey: 'problems.tabPay' },
  { id: 'fixes', Icon: FiCheckCircle, labelKey: 'problems.tabFixes' },
  { id: 'goals', Icon: FiTarget, labelKey: 'problems.tabGoals' },
];

const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4', 'team5', 'team6'];
const OWNER_KEYS = ['owner1', 'owner2', 'owner3', 'owner4', 'owner5', 'owner6'];
const GAP_KEYS = ['gap1', 'gap2', 'gap3', 'gap4', 'gap5'];
const GOAL_KEYS = ['goal1', 'goal2', 'goal3', 'goal4', 'goal5', 'goal6'];

const FIXES = [
  { id: 'slots', Icon: FiClock, titleKey: 'home.solved1', bodyKey: 'problems.fixSlots', tone: 'text-brand-green bg-brand-green/12' },
  { id: 'errors', Icon: FiLock, titleKey: 'home.solved2', bodyKey: 'problems.fixErrors', tone: 'text-status-cancelled-text bg-status-cancelled-bg' },
  { id: 'nearby', Icon: FiNavigation, titleKey: 'home.solved3', bodyKey: 'problems.fixNearby', tone: 'text-status-info-text bg-status-info-bg' },
];

const ease = [0.22, 1, 0.36, 1];

function BulletList({ items }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((text) => (
        <li key={text} className="flex gap-2.5 text-sm leading-relaxed text-muted dark:text-dark-muted">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProblemDetailsContent({ tab = 'story', onTab, highlight, showPageLink = true }) {
  const { t, isRtl, lang } = useTranslation();

  const panel = {
    story: (
      <div className="space-y-4">
    <h3 className="font-display mt-0.5 text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.storyTitle')}</h3>
        <p className="text-sm leading-relaxed text-muted dark:text-dark-muted">{t('problems.story1')}</p>
        <p className="text-sm leading-relaxed text-muted dark:text-dark-muted">{t('problems.story2')}</p>
        <p className="text-sm leading-relaxed text-muted dark:text-dark-muted">{t('problems.story3')}</p>
        <p className="text-sm leading-relaxed text-charcoal dark:text-dark-text">{t('problems.story4')}</p>
        <blockquote className="rounded-xl border border-brand-green/20 bg-brand-green/8 px-4 py-3 text-sm font-medium leading-relaxed text-charcoal dark:border-brand-green/30 dark:bg-brand-green/10 dark:text-dark-text">
          {t('problems.quote')}
        </blockquote>
      </div>
    ),
    teams: (
      <div>
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.teamsTitle')}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">{t('problems.statementLead')}</p>
        <BulletList items={TEAM_KEYS.map((k) => t(`problems.${k}`))} />
      </div>
    ),
    owners: (
      <div>
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.ownersTitle')}</h3>
        <BulletList items={OWNER_KEYS.map((k) => t(`problems.${k}`))} />
      </div>
    ),
    pay: (
      <div className="space-y-4">
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.payTitle')}</h3>
        <p className="text-sm leading-relaxed text-muted dark:text-dark-muted">{t('problems.payBody')}</p>
        <h4 className="font-display text-base font-bold text-charcoal dark:text-dark-text">{t('problems.gapsTitle')}</h4>
        <BulletList items={GAP_KEYS.map((k) => t(`problems.${k}`))} />
        <p className="text-sm leading-relaxed text-charcoal dark:text-dark-text">{t('problems.overallBody')}</p>
      </div>
    ),
    fixes: (
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.fixesTitle')}</h3>
        {FIXES.map((fix) => (
          <article
            key={fix.id}
            id={`problem-fix-${fix.id}`}
            className={clsx(
              'rounded-xl border p-3.5 transition-shadow',
              highlight === fix.id
                ? 'border-brand-green/40 bg-brand-green/8 shadow-soft dark:border-brand-green/40'
                : 'border-border bg-warmwhite/70 dark:border-dark-border dark:bg-dark-surface-2/50'
            )}
          >
            <div className="flex items-start gap-3">
              <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', fix.tone)}>
                <fix.Icon size={16} aria-hidden />
              </span>
              <div>
                <h4 className="font-display font-bold text-charcoal dark:text-dark-text">{t(fix.titleKey)}</h4>
                <p className="mt-1 text-sm leading-relaxed text-muted dark:text-dark-muted">{t(fix.bodyKey)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    ),
    goals: (
      <div>
        <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('problems.goalsTitle')}</h3>
        <ol className="mt-3 space-y-2">
          {GOAL_KEYS.map((k, i) => (
            <li key={k} className="flex gap-3 text-sm leading-relaxed text-muted dark:text-dark-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-bold text-white dark:bg-brand-green dark:text-brand-navy">
                {i + 1}
              </span>
              <span className="pt-0.5">{t(`problems.${k}`)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-charcoal dark:text-dark-text">{t('problems.overallRoles')}</p>
      </div>
    ),
  };

  return (
    <div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab?.(item.id)}
              className={clsx(
                'font-ui inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                active
                  ? 'bg-brand-green text-white'
                  : 'bg-warmwhite text-muted hover:bg-brand-green/10 hover:text-charcoal dark:bg-dark-surface-2 dark:text-dark-muted dark:hover:text-dark-text'
              )}
            >
              <item.Icon size={13} aria-hidden />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${lang}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease }}
        >
          {panel[tab]}
        </motion.div>
      </AnimatePresence>

      {showPageLink ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4 dark:border-dark-border">
          <Button as={Link} to="/problems-we-solved" size="sm">
            {t('problems.openPage')}
            <FiArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
          </Button>
          <Button as={Link} to="/search-fields" size="sm" variant="outline">
            {t('problems.bookCta')}
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4 dark:border-dark-border">
          <Button as={Link} to="/search-fields" size="sm">
            {t('problems.bookCta')}
            <FiArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
          </Button>
          <Button as={Link} to="/how-it-works" size="sm" variant="outline">
            {t('nav.howItWorks')}
          </Button>
        </div>
      )}
    </div>
  );
}
