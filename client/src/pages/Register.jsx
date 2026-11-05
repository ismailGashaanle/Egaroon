import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiCheck } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import SomaliPhoneInput, { composedPhone } from '../components/common/SomaliPhoneInput';
import { registerUser } from '../features/auth/authSlice';
import { authApi } from '../api/authApi';
import { ROLES, dashboardPathForRole } from '../lib/roles';
import { useAuth } from '../hooks/useAuth';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { useTranslation } from '../i18n/LanguageContext';
import { toastApiError, supportHint } from '../lib/support';
import SocialAuthButtons from '../components/auth/SocialAuthButtons';
import Turnstile, { CAPTCHA_FAIL_MESSAGE } from '../components/common/Turnstile';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.TEAM_CAPTAIN,
  });
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localPhone, setLocalPhone] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailDev, setEmailDev] = useState('');
  const [phoneDev, setPhoneDev] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingPhone, setSendingPhone] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status } = useSelector((state) => state.auth);
  const { isAuthenticated, role } = useAuth();
  const { otpEnabled, publicOwnerSignup, oauthEnabled } = useAuthFeatures();
  const { t } = useTranslation();
  const loading = status === 'loading';
  const submittingRef = useRef(false);
  // One widget per action: Turnstile tokens are single-use and tied to the action they were solved for.
  const registerCaptcha = useRef(null);
  const otpCaptcha = useRef(null);

  const ROLE_OPTIONS = [
    { value: ROLES.TEAM_CAPTAIN, label: t('auth.teamCaptain'), desc: t('auth.captainDesc') },
    ...(publicOwnerSignup
      ? [{ value: ROLES.STADIUM_OWNER, label: t('auth.stadiumOwner'), desc: t('auth.ownerDesc') }]
      : []),
  ];

  useEffect(() => {
    if (!publicOwnerSignup && form.role === ROLES.STADIUM_OWNER) {
      setForm((prev) => ({ ...prev, role: ROLES.TEAM_CAPTAIN }));
    }
  }, [publicOwnerSignup, form.role]);

  if (isAuthenticated && !submittingRef.current) {
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  const sendEmailOtp = async () => {
    if (!form.email) return toast.error(t('auth.emailRequired'));
    setSendingEmail(true);
    try {
      const captchaToken = await otpCaptcha.current?.getToken();
      const { data } = await authApi.sendOtp({
        channel: 'email',
        target: form.email,
        purpose: 'register',
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (data.data.otp?.devCode) {
        setEmailDev(data.data.otp.devCode);
        setEmailOtp(data.data.otp.devCode);
      }
      toast.success(t('auth.otpSentEmail'));
    } catch (err) {
      toastApiError(err, t('auth.otpFail'));
    } finally {
      setSendingEmail(false);
    }
  };

  const sendPhoneOtp = async () => {
    const phone = composedPhone(carrierId, localPhone);
    if (!phone) return toast.error(t('auth.phoneRequired'));
    setSendingPhone(true);
    try {
      const captchaToken = await otpCaptcha.current?.getToken();
      const { data } = await authApi.sendOtp({
        channel: 'phone',
        target: phone,
        purpose: 'register',
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (data.data.otp?.devCode) {
        setPhoneDev(data.data.otp.devCode);
        setPhoneOtp(data.data.otp.devCode);
      }
      toast.success(t('auth.otpSentPhone'));
    } catch (err) {
      toastApiError(err, t('auth.otpFail'));
    } finally {
      setSendingPhone(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phone = composedPhone(carrierId, localPhone);
    if (!phone) return toast.error(t('auth.phoneRequired'));
    if (otpEnabled && (!emailOtp || !phoneOtp)) {
      return toast.error(t('auth.otpBothRequired'));
    }

    let captchaToken = null;
    try {
      captchaToken = await registerCaptcha.current?.getToken();
    } catch {
      toast.error(CAPTCHA_FAIL_MESSAGE);
      return;
    }
    submittingRef.current = true;

    const payload = {
      ...form,
      phone,
      ...(captchaToken ? { captchaToken } : {}),
    };
    if (otpEnabled) {
      payload.emailOtp = emailOtp;
      payload.phoneOtp = phoneOtp;
    }

    const result = await dispatch(registerUser(payload));
    if (registerUser.fulfilled.match(result)) {
      toast.success(t('auth.createAccount'));
      navigate(dashboardPathForRole(result.payload.role), { replace: true });
    } else {
      submittingRef.current = false;
      toast.error(`${result.payload || 'Registration failed'} — ${supportHint()}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-md"
    >
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="text-h1 text-charcoal dark:text-dark-text">{t('auth.createAccount')}</h1>
      <p className="mt-2 text-body text-muted dark:text-dark-muted">{t('auth.registerSubtitle')}</p>

      {publicOwnerSignup ? (
        <div className="mt-8">
          <p className="mb-2 text-sm font-medium text-charcoal dark:text-dark-text">{t('auth.iAmA')}</p>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setForm({ ...form, role: opt.value })}
                className={clsx(
                  'focus-ring relative rounded-2xl border p-4 text-left transition-all',
                  form.role === opt.value
                    ? 'border-forest bg-forest/5 shadow-soft ring-2 ring-forest/20 dark:border-dark-primary dark:bg-dark-primary/10'
                    : 'border-border hover:border-forest/30 dark:border-dark-border'
                )}
              >
                {form.role === opt.value && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-forest text-white">
                    <FiCheck size={12} />
                  </span>
                )}
                <p className="text-sm font-semibold text-charcoal dark:text-dark-text">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        ) : (
        <p className="mt-8 rounded-2xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-charcoal dark:border-dark-primary/30 dark:bg-dark-primary/10 dark:text-dark-text">
          {t('auth.captainDefaultHint')}
        </p>
      )}

      {form.role === ROLES.STADIUM_OWNER && (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Stadium owner accounts must be verified by E-Garoon. After you sign up, upload your documents and add your
          stadium. It becomes visible, and payments unlock, once your account is verified.
        </p>
      )}

      <div className="-mt-2">
        <SocialAuthButtons oauthEnabled={oauthEnabled} role={form.role} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label={t('auth.fullName')}
          icon={<FiUser />}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <div className="space-y-2">
          <Input
            label={t('auth.email')}
            type="email"
            icon={<FiMail />}
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {otpEnabled && (
            <>
              <div className="flex gap-2">
                <Input
                  label={t('auth.emailOtp')}
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="6-digit"
                  containerClassName="flex-1"
                />
                <Button type="button" variant="outline" className="mt-6" loading={sendingEmail} onClick={sendEmailOtp}>
                  {t('auth.sendOtp')}
                </Button>
              </div>
              {emailDev && <p className="text-xs text-amber-700">Dev OTP: {emailDev}</p>}
            </>
          )}
        </div>

        <div className="space-y-2">
          <SomaliPhoneInput
            label={t('auth.mobile')}
            carrierId={carrierId}
            onCarrierChange={setCarrierId}
            localNumber={localPhone}
            onLocalNumberChange={setLocalPhone}
            required
            hint="Hormuud 061 · Telesom 063 · Somtel 065 · Golis 090"
          />
          {otpEnabled && (
            <>
              <div className="flex gap-2">
                <Input
                  label={t('auth.phoneOtp')}
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder="6-digit"
                  containerClassName="flex-1"
                />
                <Button type="button" variant="outline" className="mt-6" loading={sendingPhone} onClick={sendPhoneOtp}>
                  {t('auth.sendOtp')}
                </Button>
              </div>
              {phoneDev && <p className="text-xs text-amber-700">Dev OTP: {phoneDev}</p>}
            </>
          )}
        </div>

        <Input
          label={t('auth.password')}
          type="password"
          icon={<FiLock />}
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <p className="text-xs text-muted">{supportHint()}</p>

        <Turnstile ref={registerCaptcha} action="register" />
        <Turnstile ref={otpCaptcha} action="otp" />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t('auth.createAccountBtn')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted dark:text-dark-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-forest dark:text-dark-primary">
          {t('nav.login')}
        </Link>
      </p>
    </motion.div>
  );
}
