import { venueTodayIso, parseSearchDate } from '../lib/slotUtils';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  FiMapPin,
  FiCalendar,
  FiSearch,
  FiArrowRight,
  FiShield,
  FiZap,
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiUsers,
  FiAward,
  FiStar,
  FiPhone,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import CldImage from '../components/common/CldImage';
import StadiumCard from '../components/stadium/StadiumCard';
import CityChips from '../components/stadium/CityChips';
import EmptyState from '../components/common/EmptyState';
import WeatherAlertStrip from '../components/weather/WeatherAlertStrip';
import SolvedProblems from '../components/home/SolvedProblems';
import { SkeletonCard } from '../components/common/Skeleton';
import { fetchStadiums } from '../features/stadiums/stadiumSlice';
import { useTranslation } from '../i18n/LanguageContext';
import { useSiteContent } from '../i18n/SiteContentContext';
import { FIELD_TYPES } from '../lib/fieldFormats';
import { localeFilled } from '../lib/siteContent';

function isExternalHref(href) {
  return /^https?:\/\//i.test(href || '');
}

function renderCmsIcon(name, className = 'w-5 h-5') {
  switch (name) {
    case 'zap':
      return <FiZap className={className} />;
    case 'dollar-sign':
      return <FiDollarSign className={className} />;
    case 'check-circle':
      return <FiCheckCircle className={className} />;
    case 'clock':
      return <FiClock className={className} />;
    case 'calendar':
      return <FiCalendar className={className} />;
    case 'users':
      return <FiUsers className={className} />;
    case 'award':
      return <FiAward className={className} />;
    case 'star':
      return <FiStar className={className} />;
    case 'phone':
      return <FiPhone className={className} />;
    case 'map-pin':
      return <FiMapPin className={className} />;
    case 'shield':
    default:
      return <FiShield className={className} />;
  }
}

const SCRIM = {
  light: {
    withMedia: 'linear-gradient(105deg, rgba(8,28,16,0.72) 0%, rgba(8,28,16,0.4) 45%, rgba(8,28,16,0.22) 100%)',
    none: [
      'radial-gradient(ellipse 55% 45% at 70% 40%, rgba(255,255,255,0.08), transparent 55%)',
      'linear-gradient(105deg, rgba(8,28,16,0.85) 0%, rgba(8,28,16,0.45) 42%, rgba(8,28,16,0.2) 100%)',
      'repeating-linear-gradient(90deg, #14532d 0px, #14532d 48px, #166534 48px, #166534 96px)',
    ].join(', '),
  },
  medium: {
    withMedia: 'linear-gradient(105deg, rgba(8,28,16,0.92) 0%, rgba(8,28,16,0.6) 45%, rgba(8,28,16,0.35) 100%)',
    none: [
      'radial-gradient(ellipse 55% 45% at 70% 40%, rgba(255,255,255,0.08), transparent 55%)',
      'linear-gradient(105deg, rgba(8,28,16,0.92) 0%, rgba(8,28,16,0.55) 42%, rgba(8,28,16,0.25) 100%)',
      'repeating-linear-gradient(90deg, #14532d 0px, #14532d 48px, #166534 48px, #166534 96px)',
    ].join(', '),
  },
  strong: {
    withMedia: 'linear-gradient(105deg, rgba(8,28,16,0.97) 0%, rgba(8,28,16,0.78) 45%, rgba(8,28,16,0.55) 100%)',
    none: [
      'radial-gradient(ellipse 55% 45% at 70% 40%, rgba(255,255,255,0.06), transparent 55%)',
      'linear-gradient(105deg, rgba(8,28,16,0.96) 0%, rgba(8,28,16,0.7) 42%, rgba(8,28,16,0.4) 100%)',
      'repeating-linear-gradient(90deg, #14532d 0px, #14532d 48px, #166534 48px, #166534 96px)',
    ].join(', '),
  },
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export default function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { content, lc } = useSiteContent();
  const { items: stadiums, status } = useSelector((state) => state.stadiums);
  const [city, setCity] = useState('');
  const [format, setFormat] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [browseCity, setBrowseCity] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const hero = content?.hero || {};
  const homeCms = content?.home || {};

  useEffect(() => {
    dispatch(fetchStadiums({}));
  }, [dispatch]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('from', city);
    if (format) params.set('type', format);
    // Chosen date (never earlier than today on the stadium clock), else today.
    const [yyyy, mm, dd] = parseSearchDate(searchDate || undefined).split('-');
    params.set('date', `${dd}-${mm}-${yyyy}`);
    navigate(`/search-fields?${params.toString()}`);
  };

  const visibleStadiums = useMemo(
    () => (browseCity ? stadiums.filter((s) => s.location?.city === browseCity) : stadiums),
    [stadiums, browseCity]
  );

  const brandLabel = hero.brandLabel || 'E-Garoon';
  const heroBadge = lc(hero.badge, '');
  const heroTitle = lc(hero.title, `${t('home.title1')} ${t('home.title2')}`);
  const heroSubtitle = lc(hero.subtitle, t('home.subtitle'));

  const primaryLabel = lc(hero.primaryCta?.label, t('home.bookField'));
  const primaryHref = hero.primaryCta?.href || '/search-fields';
  const secondaryRaw = localeFilled(hero.secondaryCta?.label)
    ? lc(hero.secondaryCta.label, '')
    : t('nav.about');
  const secondaryLabel = secondaryRaw === '-' ? '' : secondaryRaw;
  const secondaryHref = hero.secondaryCta?.href || '/about';
  const showPrimary = Boolean(String(primaryLabel || '').trim());
  const showSecondary = Boolean(String(secondaryLabel || '').trim());

  const mediaMode = hero.mediaMode || 'none';
  const overlayStrength = SCRIM[hero.overlayStrength] ? hero.overlayStrength : 'medium';
  const ctaAlign = hero.ctaAlign === 'center' ? 'center' : 'start';
  const bgImage = hero.backgroundImageUrl || '';
  const heroImage = hero.heroImageUrl || '';
  const bgVideo = hero.backgroundVideoUrl || '';
  const poster = hero.posterImageUrl || '';

  const showVideo =
    mediaMode === 'background_video' && Boolean(bgVideo) && !prefersReducedMotion;
  const showBgImage =
    (mediaMode === 'background_image' && Boolean(bgImage)) ||
    (mediaMode === 'background_video' && !showVideo && Boolean(poster || bgImage));
  const showHeroImage = Boolean(heroImage);
  const hasFullBleedMedia = showVideo || showBgImage;
  const splitLayout = showHeroImage;
  const centerCopy = ctaAlign === 'center' && !splitLayout;

  const goHref = (href) => {
    if (!href) return;
    if (isExternalHref(href)) window.location.href = href;
    else navigate(href);
  };

  // --- Dynamic Trust Points from CMS / MongoDB / Cloudflare ---
  const trust = useMemo(() => {
    if (Array.isArray(homeCms.trustPoints) && homeCms.trustPoints.length > 0) {
      const items = homeCms.trustPoints
        .map((tp) => ({
          title: lc(tp.title, ''),
          desc: lc(tp.desc, ''),
          icon: tp.icon || 'shield',
          sortOrder: tp.sortOrder ?? 0,
        }))
        .filter((tp) => Boolean(tp.title));
      if (items.length > 0) return items.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [
      { title: t('home.trust1'), desc: t('home.trust1Desc'), icon: 'zap' },
      { title: t('home.trust2'), desc: t('home.trust2Desc'), icon: 'shield' },
      { title: t('home.trust3'), desc: t('home.trust3Desc'), icon: 'dollar-sign' },
    ];
  }, [homeCms.trustPoints, lc, t]);

  // --- Dynamic How-It-Works Steps from CMS / MongoDB / Cloudflare ---
  const steps = useMemo(() => {
    if (Array.isArray(homeCms.howSteps) && homeCms.howSteps.length > 0) {
      const items = homeCms.howSteps
        .map((s, idx) => ({
          step: s.step || String(idx + 1),
          title: lc(s.title, ''),
          desc: lc(s.desc, ''),
          icon: s.icon || 'calendar',
          photoUrl: s.photoUrl || '',
          sortOrder: s.sortOrder ?? idx,
        }))
        .filter((s) => Boolean(s.title));
      if (items.length > 0) return items.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [
      {
        step: '1',
        title: lc(homeCms.howStep1Title, t('home.step1')),
        desc: lc(homeCms.howStep1Desc, t('home.step1Desc')),
        icon: 'calendar',
      },
      {
        step: '2',
        title: lc(homeCms.howStep2Title, t('home.step2')),
        desc: lc(homeCms.howStep2Desc, t('home.step2Desc')),
        icon: 'dollar-sign',
      },
      {
        step: '3',
        title: lc(homeCms.howStep3Title, t('home.step3')),
        desc: lc(homeCms.howStep3Desc, t('home.step3Desc')),
        icon: 'award',
      },
    ];
  }, [homeCms, lc, t]);

  // --- Dynamic Features & Benefits from CMS ---
  const features = useMemo(() => {
    if (Array.isArray(homeCms.features) && homeCms.features.length > 0) {
      return homeCms.features
        .map((f, idx) => ({
          badge: lc(f.badge, ''),
          title: lc(f.title, ''),
          desc: lc(f.desc, ''),
          icon: f.icon || 'shield',
          photoUrl: f.photoUrl || '',
          sortOrder: f.sortOrder ?? idx,
        }))
        .filter((f) => Boolean(f.title))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [];
  }, [homeCms.features, lc]);

  // --- Dynamic FAQs from CMS ---
  const faqs = useMemo(() => {
    if (Array.isArray(homeCms.faqs) && homeCms.faqs.length > 0) {
      return homeCms.faqs
        .map((fq, idx) => ({
          question: lc(fq.question, ''),
          answer: lc(fq.answer, ''),
          category: fq.category || 'general',
          sortOrder: fq.sortOrder ?? idx,
        }))
        .filter((fq) => Boolean(fq.question && fq.answer))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [];
  }, [homeCms.faqs, lc]);

  // --- Dynamic Testimonials from CMS ---
  const testimonials = useMemo(() => {
    if (Array.isArray(homeCms.testimonials) && homeCms.testimonials.length > 0) {
      return homeCms.testimonials
        .map((tst, idx) => ({
          name: tst.name || '',
          role: lc(tst.role, ''),
          teamOrStadium: tst.teamOrStadium || '',
          quote: lc(tst.quote, ''),
          photoUrl: tst.photoUrl || '',
          rating: tst.rating ?? 5,
          sortOrder: tst.sortOrder ?? idx,
        }))
        .filter((tst) => Boolean(tst.name && tst.quote))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [];
  }, [homeCms.testimonials, lc]);

  // --- Dynamic Partners from CMS ---
  const partners = useMemo(() => {
    if (Array.isArray(homeCms.partners) && homeCms.partners.length > 0) {
      return homeCms.partners
        .filter((p) => Boolean(p.name))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return [];
  }, [homeCms.partners]);

  const scrim = SCRIM[overlayStrength];
  const overlayStyle = {
    backgroundImage: hasFullBleedMedia || showHeroImage ? scrim.withMedia : scrim.none,
  };

  const bgImageUrl =
    mediaMode === 'background_image'
      ? bgImage
      : showBgImage
        ? poster || bgImage
        : '';

  return (
    <PageTransition>
      {/* ===================== HERO SECTION ===================== */}
      <section className="relative min-h-[88vh] overflow-hidden">
        {showVideo && (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={bgVideo}
            poster={poster || undefined}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        )}
        {showBgImage && bgImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImageUrl})` }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0" style={overlayStyle} aria-hidden />

        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
          <div
            className={
              splitLayout
                ? 'grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16'
                : 'flex flex-col'
            }
          >
            <div
              className={`max-w-xl ${centerCopy ? 'mx-auto text-center' : ''} ${
                splitLayout ? 'lg:max-w-none' : ''
              }`}
            >
              {heroBadge ? (
                <p className="mb-3 text-sm text-white/80">{heroBadge}</p>
              ) : null}
              <p className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                {brandLabel}
              </p>
              <h1 className="mt-4 text-xl font-medium text-white sm:text-2xl">{heroTitle}</h1>
              <p
                className={`mt-4 max-w-md text-base leading-relaxed text-white/80 ${
                  centerCopy ? 'mx-auto' : ''
                }`}
              >
                {heroSubtitle}
              </p>
              {(showPrimary || showSecondary) && (
                <div
                  className={`mt-8 flex flex-wrap gap-3 ${
                    centerCopy ? 'justify-center' : 'justify-start'
                  }`}
                >
                  {showPrimary && (
                    <Button
                      size="lg"
                      className="!bg-white !text-forest hover:!bg-warmwhite shadow-lg"
                      onClick={() => goHref(primaryHref)}
                    >
                      {primaryLabel}
                    </Button>
                  )}
                  {showSecondary && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="!border-white/50 !text-white hover:!bg-white/10"
                      onClick={() => goHref(secondaryHref)}
                    >
                      {secondaryLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {showHeroImage && (
              <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
                <CldImage
                  src={heroImage}
                  alt="Hero Image"
                  width={720}
                  height={900}
                  crop={false}
                  className="aspect-[4/5] w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
                />
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="mt-14 max-w-4xl">
            <div className="rounded-xl border border-border bg-white p-4 shadow-card dark:border-dark-border dark:bg-dark-surface sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
                <Input
                  label={t('home.location')}
                  icon={<FiMapPin />}
                  placeholder="Hargeysa"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label={t('home.date')}
                  icon={<FiCalendar />}
                  type="date"
                  min={venueTodayIso()}
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
                <Select label={t('home.format')} value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="">{t('home.any')}</option>
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </Select>
                <Button type="submit" icon={<FiSearch />} className="w-full sm:w-auto">
                  {t('home.search')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* ===================== DYNAMIC TRUST POINTS ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ul
          className={clsx(
            'grid overflow-hidden rounded-2xl border border-border bg-white dark:border-dark-border dark:bg-dark-surface',
            trust.length === 2 && 'sm:grid-cols-2',
            trust.length === 3 && 'sm:grid-cols-3',
            trust.length >= 4 && 'sm:grid-cols-2 lg:grid-cols-4'
          )}
        >
          {trust.map((item, i) => (
            <li
              key={item.title + i}
              className={clsx(
                'flex gap-4 px-5 py-5 sm:px-6',
                i > 0 && 'border-t border-border sm:border-t-0 sm:border-s dark:border-dark-border'
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-forest/20 dark:text-brand-green">
                {renderCmsIcon(item.icon, 'w-5 h-5')}
              </div>
              <div>
                <p className="font-display text-base font-bold text-charcoal dark:text-dark-text">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted dark:text-dark-muted">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Solved Problems Interactive Demo */}
      <SolvedProblems t={t} reduced={prefersReducedMotion} />

      {/* ===================== DYNAMIC HOW IT WORKS ===================== */}
      <section className="mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-white px-5 py-8 dark:border-dark-border dark:bg-dark-surface sm:px-8 sm:py-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
              {lc(homeCms.howTitle, t('home.howTitle'))}
            </h2>
          </div>
          <ol
            className={clsx(
              'relative mt-10 grid gap-8',
              steps.length <= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
            )}
          >
            {steps.map((s, idx) => (
              <li key={s.step + idx} className="relative flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white dark:bg-brand-green dark:text-brand-navy shadow">
                    {s.step}
                  </span>
                  <div className="text-forest dark:text-brand-green">
                    {renderCmsIcon(s.icon, 'w-5 h-5')}
                  </div>
                </div>

                {s.photoUrl ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border">
                    <CldImage
                      src={s.photoUrl}
                      alt={s.title}
                      className="h-32 w-full object-cover"
                    />
                  </div>
                ) : null}

                <h3 className="mt-4 font-display text-lg font-bold text-charcoal dark:text-dark-text">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted dark:text-dark-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===================== DYNAMIC FEATURES & BENEFITS ===================== */}
      {features.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
              {lc(homeCms.featuresTitle, 'Maxaa E-Garoon Uga Duwan Yahay Nidaamyada Kale?')}
            </h2>
            <p className="mt-2 text-sm text-muted dark:text-dark-muted">
              {lc(homeCms.featuresSubtitle, 'Nidaam dhammaystiran oo xallinaya caqabadaha garoomada, kooxaha kubadda, iyo kabtanada.')}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-dark-border dark:bg-dark-surface"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-forest/20 dark:text-brand-green">
                      {renderCmsIcon(feat.icon, 'w-6 h-6')}
                    </div>
                    {feat.badge ? (
                      <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest dark:bg-forest/20 dark:text-brand-green">
                        {feat.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">
                    {feat.desc}
                  </p>
                </div>
                {feat.photoUrl ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    <CldImage
                      src={feat.photoUrl}
                      alt={feat.title}
                      className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===================== STADIUMS BROWSE SECTION ===================== */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <WeatherAlertStrip cityFilter={browseCity} className="mb-6" />
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-h2 text-charcoal dark:text-dark-text">{t('home.browse')}</h2>
            <Button variant="outline" size="md" onClick={() => navigate('/stadiums')}>
              {t('home.viewAll')}
              <FiArrowRight className="ms-1" size={16} />
            </Button>
          </div>
          <div className="mt-4">
            <CityChips stadiums={stadiums} active={browseCity} onChange={setBrowseCity} />
          </div>
        </div>

        {status === 'loading' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {status !== 'loading' && visibleStadiums.length === 0 && (
          <EmptyState
            icon={<FiMapPin size={22} />}
            title={t('search.noFields')}
            description={t('search.noFieldsDesc')}
            action={<Button onClick={() => navigate('/register')}>{t('home.listStadium')}</Button>}
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStadiums.slice(0, 6).map((stadium) => (
            <StadiumCard key={stadium._id} stadium={stadium} />
          ))}
        </div>
      </section>

      {/* ===================== DYNAMIC TESTIMONIALS / REVIEWS ===================== */}
      {testimonials.length > 0 && (
        <section className="bg-forest/5 py-14 dark:bg-dark-surface/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
                {lc(homeCms.testimonialsTitle, 'Aragtida Kabtanada & Milkiilayaasha')}
              </h2>
              <p className="mt-2 text-sm text-muted dark:text-dark-muted">
                Dhegeyso waxa ay macaamiisheennu ka yiraahdeen waayo-aragnimadooda E-Garoon.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((tst, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-surface"
                >
                  <div>
                    <div className="flex gap-1 text-amber-400 mb-3 text-sm">
                      {[...Array(tst.rating || 5)].map((_, starIdx) => (
                        <FiStar key={starIdx} className="fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm italic leading-relaxed text-charcoal dark:text-dark-text">
                      “{tst.quote}”
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-3 border-t border-border pt-4 dark:border-dark-border">
                    {tst.photoUrl ? (
                      <CldImage
                        src={tst.photoUrl}
                        alt={tst.name}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-forest/20"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">
                        {tst.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-display text-sm font-bold text-charcoal dark:text-dark-text">
                        {tst.name}
                      </p>
                      <p className="text-xs text-muted dark:text-dark-muted">
                        {tst.role} {tst.teamOrStadium ? `· ${tst.teamOrStadium}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== DYNAMIC FAQS ACCORDION ===================== */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
              {lc(homeCms.faqsTitle, "Su'aalaha Badanaa La Isweydiiyo")}
            </h2>
            <p className="mt-2 text-sm text-muted dark:text-dark-muted">
              Jawaabaha su'aalaha ugu muhiimsan ee ku saabsan nidaamka, ballanshada, iyo lacagaha.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-white transition-all overflow-hidden dark:border-dark-border dark:bg-dark-surface"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-start font-display font-semibold text-charcoal dark:text-dark-text hover:bg-surface-inset transition-colors"
                  >
                    <span className="flex-1 pe-4 text-base">{faq.question}</span>
                    <span className="text-muted shrink-0">
                      {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-relaxed text-muted dark:text-dark-muted border-t border-border/50 pt-3 dark:border-dark-border/50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===================== DYNAMIC PARTNERS LOGOS ===================== */}
      {partners.length > 0 && (
        <section className="border-t border-border bg-surface-inset py-10 dark:border-dark-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted mb-6">
              {lc(homeCms.partnersTitle, 'Garoomada & Isbahaysiga la Shaqeeya E-Garoon')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {partners.map((partner, idx) => (
                <div key={idx} className="flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100">
                  {partner.logoUrl ? (
                    <img
                      src={partner.logoUrl}
                      alt={partner.name}
                      className="max-h-12 max-w-[130px] object-contain"
                    />
                  ) : (
                    <span className="font-display font-bold text-sm text-charcoal/70 dark:text-white/70">
                      {partner.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== CTA BOTTOM BANNER ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white sm:flex-row sm:items-stretch dark:border-dark-border dark:bg-dark-surface shadow-md">
          <span className="h-1.5 w-full bg-brand-green sm:h-auto sm:w-1.5" aria-hidden />
          <div className="flex flex-1 flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl dark:text-dark-text">
                {lc(homeCms.ctaTitle, t('home.ctaTitle'))}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base dark:text-dark-muted">
                {lc(homeCms.ctaDesc, t('home.ctaDesc'))}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/register')}>
                {t('home.ctaStart')}
              </Button>
              <Button as={Link} to="/contact" size="lg" variant="outline">
                {t('nav.contact')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
