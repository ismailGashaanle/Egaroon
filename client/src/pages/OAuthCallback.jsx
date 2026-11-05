import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { oauthExchange } from '../features/auth/authSlice';
import { dashboardPathForRole } from '../lib/roles';
import { useTranslation } from '../i18n/LanguageContext';
import { FullPageSpinner } from '../components/common/Spinner';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const error = params.get('error');
    const code = params.get('code');
    if (error || !code) {
      toast.error(error === 'denied' ? t('auth.oauthDenied') : t('auth.oauthFail'));
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      const result = await dispatch(oauthExchange(code));
      if (oauthExchange.fulfilled.match(result)) {
        toast.success(`${t('auth.welcomeBack')}, ${String(result.payload.name || '').split(' ')[0]}!`);
        navigate(dashboardPathForRole(result.payload.role), { replace: true });
      } else {
        toast.error(result.payload || t('auth.oauthFail'));
        navigate('/login', { replace: true });
      }
    })();
  }, [dispatch, navigate, params, t]);

  return <FullPageSpinner />;
}
