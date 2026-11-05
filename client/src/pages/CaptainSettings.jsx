import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { FiCreditCard, FiBell, FiShield, FiGlobe } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import Card, { CardTitle } from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import MediaUpload from '../components/common/MediaUpload';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS } from '../lib/roles';
import { useTranslation } from '../i18n/LanguageContext';
import { authApi } from '../api/authApi';
import { setUser } from '../features/auth/authSlice';
import { toastApiError } from '../lib/support';

export default function CaptainSettings() {
  const { user, role } = useAuth();
  const { t, langs, lang } = useTranslation();
  const dispatch = useDispatch();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  const PLACEHOLDER_SECTIONS = [
    { icon: <FiCreditCard />, title: t('settings.paymentMethods'), desc: t('settings.paymentDesc') },
    { icon: <FiBell />, title: t('settings.notifications'), desc: t('settings.notificationsDesc') },
    { icon: <FiShield />, title: t('settings.security'), desc: t('settings.securityDesc') },
  ];

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateMe({ name, avatarUrl });
      dispatch(setUser(data.data.user));
      toast.success(t('settings.profileSaved'));
    } catch (err) {
      toastApiError(err, t('settings.profileFail'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/app' }, { label: t('nav.settings') }]}
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <Avatar src={avatarUrl || user?.avatarUrl} name={user?.name} size="xl" />
            <div className="mt-3">
              <MediaUpload
                folder="avatars"
                accept="image/*"
                label={t('settings.changePhoto')}
                value={avatarUrl}
                onChange={setAvatarUrl}
              />
            </div>
          </div>
          <div className="min-w-[220px] flex-1 space-y-3">
            <Input label={t('settings.displayName')} value={name} onChange={(e) => setName(e.target.value)} />
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-overline text-disabled">{t('settings.email')}</dt>
                <dd className="mt-1 text-sm text-charcoal dark:text-dark-text">{user?.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-overline text-disabled">{t('settings.phone')}</dt>
                <dd className="mt-1 text-sm text-charcoal dark:text-dark-text">{user?.phone || '—'}</dd>
              </div>
            </dl>
            <Badge variant="forest">{ROLE_LABELS[role]}</Badge>
            <Button loading={saving} onClick={saveProfile}>
              {t('settings.saveProfile')}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/10 dark:text-dark-primary">
            <FiGlobe />
          </div>
          <div className="flex-1">
            <CardTitle>{t('settings.language')}</CardTitle>
            <p className="mt-1 text-sm text-muted dark:text-dark-muted">{t('settings.languageDesc')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
              <p className="text-xs text-muted">
                {langs.find((l) => l.code === lang)?.native}
                {lang === 'ar' ? ' · RTL' : ''}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PLACEHOLDER_SECTIONS.map((s) => (
          <Card key={s.title} className="p-5" hover>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-dark-primary/10 dark:text-dark-primary">{s.icon}</div>
            <CardTitle className="mt-3">{s.title}</CardTitle>
            <p className="mt-1 text-sm text-muted dark:text-dark-muted">{s.desc}</p>
            <Badge variant="warning" className="mt-3">{t('settings.comingSoon')}</Badge>
          </Card>
        ))}
      </div>
    </PageTransition>
  );
}
