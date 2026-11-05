import axios from 'axios';
import toast from 'react-hot-toast';

// Default to the Vite proxy path so local dev does not need CORS.
// Override with a full URL (e.g. https://api.example.com/api) via VITE_API_URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the httpOnly refresh cookie
});

let accessToken = null;
let onUnauthorized = null;
/** After hard 401 (refresh failed), toast/logout once until a new token is set. */
let unauthorizedNotified = false;

export function setAccessToken(token) {
  accessToken = token || null;
  if (token) unauthorizedNotified = false;
}

export function getAccessToken() {
  return accessToken;
}

// Registered once by the auth slice/App so a hard 401 (refresh also failed)
// can trigger a logout + redirect without axios importing the store directly.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function isAuthCredentialUrl(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/otp') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/oauth')
  );
}

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

let refreshPromise = null;

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (
      !response ||
      response.status !== 401 ||
      !config ||
      config.__isRetry ||
      isAuthCredentialUrl(config.url || '')
    ) {
      return Promise.reject(error);
    }

    try {
      refreshPromise = refreshPromise || axiosClient.post('/auth/refresh');
      const { data } = await refreshPromise;
      refreshPromise = null;
      setAccessToken(data.data.accessToken);

      config.__isRetry = true;
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return axiosClient(config);
    } catch (refreshError) {
      refreshPromise = null;
      setAccessToken(null);
      if (!unauthorizedNotified) {
        unauthorizedNotified = true;
        try {
          onUnauthorized?.();
        } catch {
          /* ignore */
        }
        toast.error('Fadlan dib u gal — session-kaagu wuu dhacay');
      }
      return Promise.reject(refreshError);
    }
  }
);

export default axiosClient;
