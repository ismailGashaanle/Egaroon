import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiSmartphone } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import SomaliPhoneInput, { composedPhone } from '../components/common/SomaliPhoneInput';
import { authApi } from '../api/authApi';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { useTranslation } from '../i18n/LanguageContext';
import { toastApiError, supportHint } from '../lib/support';
import Turnstile, { CAPTCHA_FAIL_MESSAGE } from '../components/common/Turnstile';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { otpEnabled } = useAuthFeatures();
  const [channel, setChannel] = useState('email');
  const [email, setEmail] = useState('');
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localPhone, setLocalPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef(null);

  const target = channel === 'email' ? email : composedPhone(carrierId, localPhone);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!target) return toast.error(channel === 'email' ? t('auth.emailRequired') : t('auth.phoneRequired'));
    setBusy(true);
    try {
      let captchaToken = null;
      try {
        captchaToken = await captchaRef.current?.getToken();
      } catch {
        toast.error(CAPTCHA_FAIL_MESSAGE);
        return;
      }
      const { data } = await authApi.forgotPassword({ channel, target, ...(captchaToken ? { captchaToken } : {}) });
      if (otpEnabled && data.data.otp?.devCode) {
        setDevCode(data.data.otp.devCode);
        setCode(data.data.otp.devCode);
      }
      if (otpEnabled) {
        toast.success(t('auth.otpSent'));
      } else {
        toast.success(t('auth.accountFoundContinue'));
      }
      setStep(2);
    } catch (err) {
      toastApiError(err, otpEnabled ? t('auth.otpFail') : t('auth.resetFail'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (otpEnabled && !code) return toast.error(t('auth.otpCode'));
    setBusy(true);
    try {
      const payload = { channel, target, newPassword };
      if (otpEnabled) payload.code = code;
      await authApi.resetPassword(payload);
      toast.success(t('auth.passwordResetOk'));
      setStep(3);
    } catch (err) {
      toastApiError(err, t('auth.resetFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="text-h1 text-charcoal dark:text-dark-text">{t('auth.forgotTitle')}</h1>
      <p className="mt-2 text-body text-muted dark:text-dark-muted">
        {otpEnabled ? t('auth.forgotDesc') : t('auth.forgotDescNoOtp')}
      </p>

      {step === 1 && (
        <form onSubmit={sendCode} className="mt-8 space-y-4">
          <Select
            label={otpEnabled ? t('auth.otpChannel') : t('auth.resetVia')}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="email">{t('auth.email')}</option>
            <option value="phone">{t('auth.mobile')}</option>
          </Select>
          {channel === 'email' ? (
            <Input
              label={t('auth.email')}
              type="email"
              icon={<FiMail />}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : (
            <SomaliPhoneInput
              label={t('auth.mobile')}
              carrierId={carrierId}
              onCarrierChange={setCarrierId}
              localNumber={localPhone}
              onLocalNumberChange={setLocalPhone}
              required
            />
          )}
          <Turnstile ref={captchaRef} action="forgot" />
          <Button type="submit" className="w-full" size="lg" loading={busy} icon={<FiSmartphone />}>
            {otpEnabled ? t('auth.sendOtp') : t('auth.continueReset')}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={reset} className="mt-8 space-y-4">
          {otpEnabled && (
            <>
              {devCode && <p className="text-xs text-amber-700">Dev OTP: {devCode}</p>}
              <Input label={t('auth.otpCode')} value={code} onChange={(e) => setCode(e.target.value)} required />
            </>
          )}
          <Input
            label={t('auth.newPassword')}
            type="password"
            icon={<FiLock />}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            {t('auth.resetPassword')}
          </Button>
        </form>
      )}

      {step === 3 && (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-sm text-muted">{t('auth.passwordResetOk')}</p>
          <Button as={Link} to="/login" className="w-full" size="lg">
            {t('nav.login')}
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">{supportHint()}</p>
      <p className="mt-3 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-forest dark:text-dark-primary">
          {t('nav.login')}
        </Link>
      </p>
    </motion.div>
  );
}
