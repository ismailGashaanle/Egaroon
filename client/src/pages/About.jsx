import { Link } from 'react-router-dom';
import PageTransition from '../components/common/PageTransition';
import Button from '../components/common/Button';
import CldImage from '../components/common/CldImage';
import { useTranslation } from '../i18n/LanguageContext';
import { useSiteContent } from '../i18n/SiteContentContext';

const FALLBACK_TEAM = [
  { name: 'Amina Yusuf', role: 'CEO · Product', focus: 'Captain experience', bio: '', photoUrl: '' },
  { name: 'Khalid Hassan', role: 'CTO · Platform', focus: 'Payments & slots', bio: '', photoUrl: '' },
  { name: 'Hodan Ali', role: 'Ops · Somalia', focus: 'Stadiums & support', bio: '', photoUrl: '' },
  { name: 'Yasin Omar', role: 'Growth', focus: 'Cities & leagues', bio: '', photoUrl: '' },
];

function SceneCard({ title, desc }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
      <h3 className="font-display font-bold text-charcoal dark:text-dark-text">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted dark:text-dark-muted">{desc}</p>
    </div>
  );
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function About() {
  const { t } = useTranslation();
  const { content, lc } = useSiteContent();
  const about = content?.about || {};

  const title = lc(about.title, 'E-Garoon');
  const description = lc(about.description, t('about.hero'));
  const teamTitle = lc(about.teamTitle, t('about.teamTitle'));
  const teamDesc = lc(about.teamDesc, t('about.teamDesc'));

  const cmsTeam = Array.isArray(about.team) ? about.team : [];
  const team =
    cmsTeam.length > 0
      ? cmsTeam.map((m) => ({
          name: m.name,
          role: lc(m.role, ''),
          focus: lc(m.focus, ''),
          bio: lc(m.bio, ''),
          photoUrl: m.photoUrl || '',
        }))
      : FALLBACK_TEAM;

  const values = [
    { title: t('about.v1'), desc: t('about.v1d') },
    { title: t('about.v2'), desc: t('about.v2d') },
    { title: t('about.v3'), desc: t('about.v3d') },
    { title: t('about.v4'), desc: t('about.v4d') },
  ];

  return (
    <PageTransition>
      <section className="bg-[#14532d]">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">{description}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button as={Link} to="/contact" size="lg" className="bg-white text-forest hover:bg-warmwhite">
              {t('about.contactCta')}
            </Button>
            <Button
              as={Link}
              to="/search-fields"
              size="lg"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/10"
            >
              {t('home.bookField')}
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">
          {t('about.problemsTitle')}
        </h2>
        <p className="mt-2 max-w-2xl text-muted dark:text-dark-muted">{t('about.problemsDesc')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <SceneCard title={t('about.prob1')} desc={t('about.prob1d')} />
          <SceneCard title={t('about.sol1')} desc={t('about.sol1d')} />
          <SceneCard title={t('about.prob2')} desc={t('about.prob2d')} />
          <SceneCard title={t('about.sol2')} desc={t('about.sol2d')} />
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-dark-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">{teamTitle}</h2>
          <p className="mt-2 max-w-xl text-muted dark:text-dark-muted">{teamDesc}</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m, i) => (
              <div key={`${m.name}-${i}`}>
                {m.photoUrl ? (
                  <CldImage
                    src={m.photoUrl}
                    alt={m.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest/15 font-display text-xl font-bold text-forest">
                    {initials(m.name)}
                  </div>
                )}
                <h3 className="mt-3 font-display font-bold text-charcoal dark:text-dark-text">{m.name}</h3>
                {m.role && <p className="text-xs font-semibold text-forest">{m.role}</p>}
                {m.focus && <p className="mt-1 text-xs text-muted dark:text-dark-muted">{m.focus}</p>}
                {m.bio && <p className="mt-2 text-xs leading-relaxed text-muted dark:text-dark-muted">{m.bio}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title}>
              <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted dark:text-dark-muted">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
