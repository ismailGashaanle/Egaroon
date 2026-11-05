import { FaFacebook } from 'react-icons/fa';
import GoogleAuthButton, { GoogleLogo, AuthDivider } from './GoogleAuthButton';
import { useTranslation } from '../../i18n/LanguageContext';

/** A look-alike social button that cannot be pressed — shown so people know it is planned. */
function ComingSoonButton({ icon, label, soon }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={soon}
      className="inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-border bg-white/60 px-4 py-2.5 text-sm font-semibold text-charcoal opacity-60 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
    >
      {icon}
      <span>{label}</span>
      <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-white/15">
        {soon}
      </span>
    </button>
  );
}

/**
 * "Continue with…" options for login and signup.
 *  - Google is live as soon as the API has Google credentials (oauthEnabled); until then it is shown disabled.
 *  - Facebook is not built yet, so it is always shown disabled with a "Soon" tag.
 */
export default function SocialAuthButtons({ oauthEnabled, role }) {
  const { t } = useTranslation();
  const soon = t('auth.comingSoon');

  return (
    <div className="mt-8">
      <div className="grid gap-2.5">
        {oauthEnabled ? (
          <GoogleAuthButton label={t('auth.continueGoogle')} role={role} />
        ) : (
          <ComingSoonButton icon={<GoogleLogo />} label={t('auth.continueGoogle')} soon={soon} />
        )}
        <ComingSoonButton
          icon={<FaFacebook size={18} className="text-[#1877F2]" aria-hidden />}
          label={t('auth.continueFacebook')}
          soon={soon}
        />
      </div>
      <AuthDivider label={t('auth.orEmail')} />
    </div>
  );
}
