import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const TOKEN_KEY = 'kulansiiye_access_token';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let onUnauthorized = null;
/** After one 401 clear, ignore further 401 waves until a new token is set. */
let unauthorizedHandled = false;
let last401ToastAt = 0;
/** Boot / silent restore — clear dead JWT without toast spam. */
let suppressUnauthorizedToast = false;

export function setSuppressUnauthorizedToast(value) {
  suppressUnauthorizedToast = Boolean(value);
}

const SAFE_STATUS_MESSAGES = {
  400: 'Codsiga waa khalad — hubi xogta',
  401: 'Fadlan dib u gal — session-kaagu wuu dhacay',
  403: 'Uma lihid ogolaansho tan',
  404: 'Waxaan raadinnay lama helin',
  408: 'Waqtiga wuu dhammaaday — isku day markale',
  429: 'Isku day badan — sug wax yar ka dibna isku day',
  500: 'Server qalad — isku day markale',
  502: 'API lama gaadhin (server/tunnel ma shaqeynayo). Hubi Wi-Fi + EXPO_PUBLIC_API_URL.',
  503: 'Adeeggu wuu mashquul yahay — isku day markale',
  504: 'Server-ku wuu gaabiyaa — isku day markale',
};

function isAuthCredentialUrl(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/otp') ||
    url.includes('/auth/refresh')
  );
}

/** Strip JWTs / huge blobs — never show in toasts. */
function sanitizeUserMessage(msg, fallback = 'Codad ayaa dhacay') {
  if (!msg || typeof msg !== 'string') return fallback;
  if (/eyJ[A-Za-z0-9_-]+\./.test(msg)) return fallback;
  if (/bearer\s+/i.test(msg) && /[A-Za-z0-9_-]{20,}/.test(msg)) return fallback;
  if (/stack|at\s+\S+\s+\(|node_modules/i.test(msg)) return fallback;
  const trimmed = msg.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > 160) return `${trimmed.slice(0, 160)}…`;
  return trimmed;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function loadStoredToken() {
  accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return accessToken;
}

export async function setAccessToken(token) {
  accessToken = token || null;
  if (token) {
    unauthorizedHandled = false;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

/** Prefer safe status copy; allow known business messages (e.g. stadium offline). */
export function getApiErrorMessage(error, fallback = 'Codad ayaa dhacay') {
  const status = error?.response?.status;

  if (!error?.response) {
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
      return SAFE_STATUS_MESSAGES[408];
    }
    if (error?.message?.includes('Network') || error?.code === 'ERR_NETWORK') {
      return 'API lama gaadhin. Hubi in telefoonku uu ku jiro isla Wi-Fi-ga PC-ga.';
    }
  }

  if (status === 401) {
    return SAFE_STATUS_MESSAGES[401];
  }

  const errBody = error?.response?.data?.error;
  const details = errBody?.details;

  // Stadium / field offline ops: prefer Somali copy from details
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    if (details.messageSo) return sanitizeUserMessage(details.messageSo, fallback);
    if (
      (details.code === 'STADIUM_OFFLINE' || details.code === 'FIELD_OFFLINE') &&
      details.messageEn
    ) {
      return sanitizeUserMessage(details.messageEn, fallback);
    }
  }

  if (SAFE_STATUS_MESSAGES[status] && (status >= 500 || status === 403 || status === 404 || status === 408 || status === 429)) {
    // Prefer short API message when present and safe; else mapped copy
    const apiMsg = errBody?.message || error?.response?.data?.message;
    if (apiMsg && status < 500) {
      return sanitizeUserMessage(apiMsg, SAFE_STATUS_MESSAGES[status]);
    }
    return SAFE_STATUS_MESSAGES[status];
  }

  const base =
    errBody?.message ||
    error?.response?.data?.message ||
    (status && SAFE_STATUS_MESSAGES[status]) ||
    fallback;

  if (Array.isArray(details) && details.length) {
    const parts = details.slice(0, 3).map((d) => {
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object') {
        const field = d.field || d.path || d.param;
        const msg = d.message || d.msg;
        if (!msg) return field ? String(field) : null;
        return field ? `${field}: ${msg}` : String(msg);
      }
      return null;
    }).filter(Boolean);
    if (parts.length) {
      return sanitizeUserMessage(`${base}: ${parts.join('; ')}`, fallback);
    }
  }
  if (typeof details === 'string' && details) {
    return sanitizeUserMessage(`${base}: ${details}`, fallback);
  }
  return sanitizeUserMessage(base, fallback);
}

async function clearSessionOnce() {
  accessToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore store errors */
  }
}

async function handleUnauthorized(error) {
  const url = error?.config?.url || '';
  if (isAuthCredentialUrl(url)) return;

  const already = unauthorizedHandled;
  unauthorizedHandled = true;

  // Drop dead JWT immediately so queued requests do not keep sending it
  await clearSessionOnce();

  if (!already) {
    try {
      onUnauthorized?.();
    } catch {
      /* handler must not break reject path */
    }
    if (!suppressUnauthorizedToast) {
      const now = Date.now();
      if (now - last401ToastAt > 2500) {
        last401ToastAt = now;
        Toast.show({
          type: 'error',
          text1: 'Fadlan dib u gal',
          text2: 'Session-kaagu wuu dhacay',
        });
      }
    }
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status === 401 && !isAuthCredentialUrl(url)) {
      await handleUnauthorized(error);
    }

    const message = getApiErrorMessage(error);
    if (__DEV__) {
      // Avoid flooding Metro with full bodies on auth expiry waves
      if (status === 401 && unauthorizedHandled) {
        console.warn('[api] 401', error.config?.method?.toUpperCase(), url, message);
      } else {
        console.warn('[api]', error.config?.method?.toUpperCase(), url, {
          status,
          message,
        });
      }
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.data = error.response?.data;
    wrapped.details = error.response?.data?.error?.details;
    wrapped.original = error;
    wrapped.isUnauthorized = status === 401 && !isAuthCredentialUrl(url);
    return Promise.reject(wrapped);
  }
);

export default api;
