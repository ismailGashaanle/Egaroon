import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { getCaptchaConfig, useCaptchaConfig } from '../../hooks/useCaptchaConfig';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_WAIT_MS = 25000;

let scriptPromise = null;
function loadScript() {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve(window.turnstile);
      el.onerror = () => {
        scriptPromise = null;
        reject(new Error('Security check could not load'));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile bot check. Renders nothing at all unless the API has Turnstile switched on,
 * and stays invisible unless Cloudflare decides a visitor needs to prove they're human.
 *
 *   const ts = useRef();
 *   <Turnstile ref={ts} action="login" />
 *   const captchaToken = await ts.current.getToken();   // null when Turnstile is off
 *
 * A token is single-use, so getToken() hands one out and immediately starts a fresh check.
 */
const Turnstile = forwardRef(function Turnstile({ action, className = '' }, ref) {
  const config = useCaptchaConfig();
  const box = useRef(null);
  const widgetId = useRef(null);
  const token = useRef(null);
  const waiters = useRef([]);

  useEffect(() => {
    if (!config.enabled) return undefined;
    let cancelled = false;

    loadScript()
      .then((turnstile) => {
        if (cancelled || !box.current) return;
        widgetId.current = turnstile.render(box.current, {
          sitekey: config.siteKey,
          action,
          appearance: 'interaction-only',
          theme: 'auto',
          callback: (t) => {
            token.current = t;
            waiters.current.splice(0).forEach((w) => w.resolve(t));
          },
          'expired-callback': () => {
            token.current = null;
            try {
              turnstile.reset(widgetId.current);
            } catch {
              /* widget already gone */
            }
          },
          'error-callback': () => {
            waiters.current.splice(0).forEach((w) => w.reject(new Error('Security check failed')));
          },
        });
      })
      .catch((err) => waiters.current.splice(0).forEach((w) => w.reject(err)));

    return () => {
      cancelled = true;
      if (widgetId.current != null) {
        try {
          window.turnstile?.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
  }, [config.enabled, config.siteKey, action]);

  useImperativeHandle(ref, () => ({
    async getToken() {
      const cfg = await getCaptchaConfig();
      if (!cfg.enabled) return null;

      const take = (t) => {
        token.current = null;
        try {
          window.turnstile?.reset(widgetId.current);
        } catch {
          /* ignore */
        }
        return t;
      };
      if (token.current) return take(token.current);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Security check timed out')), TOKEN_WAIT_MS);
        waiters.current.push({
          resolve: (t) => {
            clearTimeout(timer);
            resolve(take(t));
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      });
    },
  }));

  if (!config.enabled) return null;
  return <div ref={box} className={className} />;
});

export default Turnstile;

export const CAPTCHA_FAIL_MESSAGE =
  'The security check could not run. Turn off ad blockers or VPN for this site, reload, and try again.';
