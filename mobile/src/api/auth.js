import api, { setAccessToken } from './client';

export const authApi = {
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const payload = data.data;
    await setAccessToken(payload.accessToken);
    return payload;
  },

  register: async (body) => {
    const { data } = await api.post('/auth/register', body);
    const payload = data.data;
    await setAccessToken(payload.accessToken);
    return payload;
  },

  /** Returns otp payload (may include `devCode` when mock / non-production). */
  sendOtp: async (channel, target) => {
    const { data } = await api.post('/auth/otp/send', {
      channel,
      target,
      purpose: 'register',
    });
    return data.data?.otp || data.data || {};
  },

  /** Public flags — server GET /auth/features is source of truth. */
  getFeatures: async () => {
    const { data } = await api.get('/auth/features');
    return data.data || {
      otpEnabled: false,
      lineupEnabled: false,
      giftEnabled: false,
      weatherEnabled: false,
      ownerCommissionVisible: false,
      publicOwnerSignup: false,
      oauthEnabled: false,
      oauthProviders: [],
    };
  },

  me: async () => {
    const { data } = await api.get('/auth/me');
    return data.data.user;
  },

  updateMe: async (body) => {
    const { data } = await api.patch('/auth/me', body);
    return data.data.user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    await setAccessToken(null);
  },
};
