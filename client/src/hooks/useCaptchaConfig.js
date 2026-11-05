import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi';

const OFF = { enabled: false, siteKey: null };
let cached = null;

/** One shared request: every form on the page uses the same Turnstile settings from GET /auth/features. */
export function getCaptchaConfig() {
  if (!cached) {
    cached = authApi
      .getFeatures()
      .then(({ data }) => {
        const c = data?.data?.captcha;
        return c?.enabled && c?.siteKey ? { enabled: true, siteKey: c.siteKey } : OFF;
      })
      .catch(() => {
        cached = null; // let the next form try again
        return OFF;
      });
  }
  return cached;
}

export function useCaptchaConfig() {
  const [config, setConfig] = useState(OFF);
  useEffect(() => {
    let alive = true;
    getCaptchaConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
