import { Link } from 'react-router-dom';
import {
  FiFacebook,
  FiInstagram,
  FiTwitter,
  FiYoutube,
  FiLinkedin,
  FiPhone,
  FiShare2,
} from 'react-icons/fi';
import Logo from '../common/Logo';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { useTranslation } from '../../i18n/LanguageContext';
import { useSiteContent } from '../../i18n/SiteContentContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';

function renderSocialIcon(platform) {
  switch (platform?.toLowerCase()) {
    case 'facebook':
      return <FiFacebook size={18} />;
    case 'instagram':
      return <FiInstagram size={18} />;
    case 'twitter':
    case 'x':
      return <FiTwitter size={18} />;
    case 'youtube':
      return <FiYoutube size={18} />;
    case 'linkedin':
      return <FiLinkedin size={18} />;
    case 'whatsapp':
      return <FiPhone size={18} />;
    default:
      return <FiShare2 size={18} />;
  }
}

export default function Footer() {
  const { t } = useTranslation();
  const { content, lc } = useSiteContent();
  const { lineupEnabled } = useAuthFeatures();

  const tagline = lc(content?.footer?.tagline, t('footer.tagline'));
  const copyright = lc(
    content?.footer?.copyrightText,
    `© ${new Date().getFullYear()} E-Garoon. ${t('footer.rights')}`
  );
  const socialLinks = Array.isArray(content?.footer?.socialLinks)
    ? content.footer.socialLinks.filter((l) => l.active !== false && l.url)
    : [];

  const FOOTER_LINKS = {
    [t('footer.product')]: [
      { to: '/services', label: t('nav.services') },
      { to: '/stadiums', label: t('footer.findFields') },
      ...(lineupEnabled ? [{ to: '/lineups', label: t('nav.lineups') }] : []),
      { to: '/tournaments', label: t('nav.tournaments') },
      { to: '/how-it-works', label: t('nav.howItWorks') },
      { to: '/pricing', label: t('nav.pricing') },
    ],
    [t('footer.company')]: [
      { to: '/about', label: t('footer.aboutUs') },
      { to: '/problems-we-solved', label: t('home.solvedTitle') },
      { to: '/contact', label: t('nav.contact') },
      { to: '/register', label: t('footer.listStadium') },
      { to: '/owner', label: t('footer.ownerPortal') },
    ],
    [t('footer.legal')]: [
      { to: '/about', label: t('footer.privacy') },
      { to: '/about', label: t('footer.terms') },
      { to: '/about', label: t('footer.cookies') },
    ],
  };

  return (
    <footer className="border-t border-border bg-white dark:border-dark-border dark:bg-dark-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted dark:text-dark-muted">
              {tagline}
            </p>

            {/* Dynamic Social Links from CMS */}
            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                {socialLinks.map((sl, idx) => (
                  <a
                    key={idx}
                    href={sl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={sl.platform}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-inset text-charcoal transition-all hover:border-forest hover:bg-forest hover:text-white dark:border-dark-border dark:text-dark-text dark:hover:bg-brand-green dark:hover:text-brand-navy"
                  >
                    {renderSocialIcon(sl.platform)}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-5">
              <LanguageSwitcher />
            </div>

            <div className="mt-6 flex gap-6 text-sm">
              <div>
                <p className="font-display text-xl font-bold text-forest dark:text-dark-primary">500+</p>
                <p className="text-xs text-muted dark:text-dark-muted">{t('footer.fieldsListed')}</p>
              </div>
              <div>
                <p className="font-display text-xl font-bold text-forest dark:text-dark-primary">10K+</p>
                <p className="text-xs text-muted dark:text-dark-muted">{t('footer.matchesBooked')}</p>
              </div>
              <div>
                <p className="font-display text-xl font-bold text-forest dark:text-dark-primary">2K+</p>
                <p className="text-xs text-muted dark:text-dark-muted">{t('footer.activeTeams')}</p>
              </div>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-overline text-charcoal dark:text-dark-text">{heading}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={`${heading}-${link.label}`}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted transition-colors hover:text-forest dark:text-dark-muted dark:hover:text-dark-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row dark:border-dark-border">
          <p className="text-xs text-disabled">{copyright}</p>
          <p className="text-xs text-disabled">{t('footer.madeFor')}</p>
        </div>
      </div>
    </footer>
  );
}
