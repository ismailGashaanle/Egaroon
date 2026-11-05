import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';

function envOtpFallback() {
  return String(process.env.EXPO_PUBLIC_OTP_ENABLED || '').toLowerCase() === 'true';
}

/** Server GET /auth/features is source of truth; env is fallback only. */
export function useAuthFeatures() {
  const [otpEnabled, setOtpEnabled] = useState(envOtpFallback);
  const [lineupEnabled, setLineupEnabled] = useState(false);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [ownerCommissionVisible, setOwnerCommissionVisible] = useState(false);
  const [publicOwnerSignup, setPublicOwnerSignup] = useState(false);
  const [sllPerUsd, setSllPerUsd] = useState(8500);
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getFeatures()
      .then((features) => {
        if (cancelled) return;
        setOtpEnabled(Boolean(features?.otpEnabled));
        setLineupEnabled(Boolean(features?.lineupEnabled));
        setGiftEnabled(Boolean(features?.giftEnabled));
        setWeatherEnabled(Boolean(features?.weatherEnabled));
        setOwnerCommissionVisible(Boolean(features?.ownerCommissionVisible));
        setPublicOwnerSignup(Boolean(features?.publicOwnerSignup));
        if (features?.sllPerUsd) setSllPerUsd(Number(features.sllPerUsd));
        setOauthEnabled(Boolean(features?.oauthEnabled));
      })
      .catch(() => {
        if (cancelled) return;
        setOtpEnabled(envOtpFallback());
        setLineupEnabled(false);
        setGiftEnabled(false);
        setWeatherEnabled(false);
        setOwnerCommissionVisible(false);
        setPublicOwnerSignup(false);
        setOauthEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    otpEnabled,
    lineupEnabled,
    giftEnabled,
    weatherEnabled,
    ownerCommissionVisible,
    publicOwnerSignup,
    sllPerUsd,
    oauthEnabled,
    loaded,
  };
}
