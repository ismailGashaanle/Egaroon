import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiMail, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { loginUser, verifyLoginCode } from '../features/auth/authSlice';
import { dashboardPathForRole } from '../lib/roles';
import { useAuth } from '../hooks/useAuth';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { useTranslation } from '../i18n/LanguageContext';
import SocialAuthButtons from '../components/auth/SocialAuthButtons';
import Turnstile, { CAPTCHA_FAIL_MESSAGE } from '../components/common/Turnstile';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSelector((state) => state.auth);
  const { isAuthenticated, role, user } = useAuth();
  const { oauthEnabled } = useAuthFeatures();
  const { t } = useTranslation();
  const loading = status === 'loading';
  const submittingRef = useRef(false);
  const captchaRef = useRef(null);
  const [challenge, setChallenge] = useState(null); // set when the server asks for a code
  const [code, setCode] = useState('');

  if (isAuthenticated && !submittingRef.current) {
    if (user?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  const validate = () => {
    const next = {};
    if (!form.email) next.email = t('auth.emailRequired');
    if (!form.password) next.password = t('auth.passwordRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    let captchaToken = null;
    try {
      captchaToken = await captchaRef.current?.getToken();
    } catch {
      toast.error(CAPTCHA_FAIL_MESSAGE);
      return;
    }
    submittingRef.current = true;
    const result = await dispatch(loginUser(captchaToken ? { ...form, captchaToken } : form));
    if (loginUser.fulfilled.match(result) && result.payload?.twoFactor) {
      submittingRef.current = false;
      setCode('');
      setChallenge(result.payload.challenge);
    } else if (loginUser.fulfilled.match(result)) {
      finishLogin(result.payload);
    } else {
      submittingRef.current = false;
      toast.error(result.payload || 'Login failed');
    }
  };

  const finishLogin = (user) => {
    toast.success(`${t('auth.welcomeBack')}, ${user.name.split(' ')[0]}!`);
    if (user.mustChangePassword) {
      navigate('/change-password', { replace: true });
      return;
    }
    const from = location.state?.from?.pathname || dashboardPathForRole(user.role);
    navigate(from, { replace: true });
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) return toast.error('Enter the 6-digit code');
    submittingRef.current = true;
    const result = await dispatch(verifyLoginCode({ challenge, code: code.trim() }));
    if (verifyLoginCode.fulfilled.match(result)) {
      finishLogin(result.payload);
    } else {
      submittingRef.current = false;
      toast.error(result.payload || 'That code is not correct');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-md">
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      {challenge ? (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <h1 className="text-h1 text-charcoal dark:text-dark-text">Two-step verification</h1>
          <p className="mt-2 text-body text-muted dark:text-dark-muted">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
          <Input
            label="Authenticator code"
            icon={<FiLock />}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>Verify and sign in</Button>
          <button
            type="button"
            className="w-full text-center text-sm font-semibold text-forest dark:text-dark-primary"
            onClick={() => { setChallenge(null); setCode(''); }}
          >
            Back to login
          </button>
        </form>
      ) : (
      <>
      <h1 className="text-h1 text-charcoal dark:text-dark-text">{t('auth.welcomeBack')}</h1>
      <p className="mt-2 text-body text-muted dark:text-dark-muted">{t('auth.loginSubtitle')}</p>

      <SocialAuthButtons oauthEnabled={oauthEnabled} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('auth.email')} type="email" icon={<FiMail />} required value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label={t('auth.password')} type="password" icon={<FiLock />} required value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-forest dark:text-dark-primary">
            {t('auth.forgotLink')}
          </Link>
        </div>
        <Turnstile ref={captchaRef} action="login" />
        <Button type="submit" className="w-full" size="lg" loading={loading}>{t('auth.login')}</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted dark:text-dark-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-forest dark:text-dark-primary">{t('nav.signUp')}</Link>
      </p>
      </>
      )}
    </motion.div>
  );
}
