import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi';

/** Fallback when API unreachable — default false (OTP off). */
function envOtpFallback() {
  return String(import.meta.env.VITE_OTP_ENABLED || '').toLowerCase() === 'true';
}

/**
 * Server is source of truth: GET /auth/features →
 * { otpEnabled, lineupEnabled, giftEnabled, weatherEnabled, ownerCommissionVisible,
 *   publicOwnerSignup, oauthEnabled, oauthProviders }.
 * Flags default OFF except oauthEnabled when Google env is set on the API.
 */
export function useAuthFeatures() {
  const [otpEnabled, setOtpEnabled] = useState(envOtpFallback);
  const [lineupEnabled, setLineupEnabled] = useState(false);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [ownerCommissionVisible, setOwnerCommissionVisible] = useState(false);
  const [publicOwnerSignup, setPublicOwnerSignup] = useState(false);
  const [sllPerUsd, setSllPerUsd] = useState(8500);
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [oauthProviders, setOauthProviders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getFeatures()
      .then(({ data }) => {
        if (cancelled) return;
        const f = data?.data || {};
        setOtpEnabled(Boolean(f.otpEnabled));
        setLineupEnabled(Boolean(f.lineupEnabled));
        setGiftEnabled(Boolean(f.giftEnabled));
        setWeatherEnabled(Boolean(f.weatherEnabled));
        setOwnerCommissionVisible(Boolean(f.ownerCommissionVisible));
        setPublicOwnerSignup(Boolean(f.publicOwnerSignup));
        if (f.sllPerUsd) setSllPerUsd(Number(f.sllPerUsd));
        setOauthEnabled(Boolean(f.oauthEnabled));
        setOauthProviders(Array.isArray(f.oauthProviders) ? f.oauthProviders : []);
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
        setOauthProviders([]);
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
    oauthProviders,
    loaded,
  };
}
