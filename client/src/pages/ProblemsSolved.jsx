import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Button from '../components/common/Button';
import CldImage from '../components/common/CldImage';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import ProblemDetailsContent from '../components/home/ProblemDetailsContent';
import { useTranslation } from '../i18n/LanguageContext';

const NOTEBOOK_IMAGE =
  'https://images.unsplash.com/photo-1731963094554-c5c981ccdefd?auto=format&fit=crop&w=1400&q=80';

export default function ProblemsSolved() {
  const { t, isRtl } = useTranslation();
  const [tab, setTab] = useState('story');

  useEffect(() => {
    document.title = `${t('home.solvedTitle')} · E-Garoon`;
    return () => {
      document.title = 'E-Garoon. Book. Play.';
    };
  }, [t]);

  return (
    <PageTransition>
      <section className="relative overflow-hidden">
        <div className="relative min-h-[240px]">
          <CldImage
            src={NOTEBOOK_IMAGE}
            alt={t('home.solvedImageAlt')}
            width={1600}
            height={700}
            crop={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/88 to-brand-navy/50" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-green">
              {t('home.solvedOverline')}
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold text-white sm:text-4xl">{t('home.solvedTitle')}</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/85">{t('home.solvedDesc')}</p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-ui text-sm text-muted dark:text-dark-muted">{t('problems.langHint')}</p>
            <LanguageSwitcher compact />
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-surface sm:p-8">
            <ProblemDetailsContent tab={tab} onTab={setTab} showPageLink={false} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button as={Link} to="/" variant="outline" size="sm">
              {t('common.back')}
            </Button>
            <Button as={Link} to="/search-fields" size="sm">
              {t('problems.bookCta')}
              <FiArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
            </Button>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
