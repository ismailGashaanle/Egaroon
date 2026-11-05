import { useCallback, useEffect, useState } from 'react';

function readNavigatorOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Confirm the browser can actually reach this origin.
 * Same-origin HEAD avoids CORS. A 404 still means the network worked.
 * Do not ping `/api` — a down API is not the same as no internet.
 */
export async function probeConnection({ timeoutMs = 4000 } = {}) {
  if (!readNavigatorOnline()) return false;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return true;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `${window.location.origin}/?_offline=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return res.ok || (res.status > 0 && res.status < 500);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live online / offline status for the web app.
 * Listens to `window` online/offline and exposes a retry probe.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(readNavigatorOnline);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOnline(readNavigatorOnline());

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const ok = await probeConnection();
      setIsOnline(ok);
      return ok;
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    checking,
    retry,
  };
}

export default useOnlineStatus;
