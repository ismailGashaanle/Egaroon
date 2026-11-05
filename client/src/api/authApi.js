import axiosClient from './axiosClient';

export const authApi = {
  register: (payload) => axiosClient.post('/auth/register', payload),
  login: (payload) => axiosClient.post('/auth/login', payload),
  verifyLoginCode: (payload) => axiosClient.post('/auth/login/2fa', payload),
  logout: () => axiosClient.post('/auth/logout'),
  refresh: () => axiosClient.post('/auth/refresh'),
  me: () => axiosClient.get('/auth/me'),
  updateMe: (payload) => axiosClient.patch('/auth/me', payload),
  sendOtp: (payload) => axiosClient.post('/auth/otp/send', payload),
  verifyOtp: (payload) => axiosClient.post('/auth/otp/verify', payload),
  getFeatures: () => axiosClient.get('/auth/features'),
  oauthExchange: (code) => axiosClient.post('/auth/oauth/exchange', { code }),
  forgotPassword: (payload) => axiosClient.post('/auth/password/forgot', payload),
  resetPassword: (payload) => axiosClient.post('/auth/password/reset', payload),
  changePassword: (payload) => axiosClient.post('/auth/password/change', payload),
  contacts: (params) => axiosClient.get('/auth/contacts', { params }),
};
