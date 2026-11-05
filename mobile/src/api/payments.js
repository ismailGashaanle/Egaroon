import api from './client';

export const paymentsApi = {
  listMine: () => api.get('/payments').then((r) => r.data.data),
  initiate: (payload) => api.post('/payments', payload).then((r) => r.data.data),
  get: (paymentId) => api.get(`/payments/${paymentId}`).then((r) => r.data.data),
  mockConfirm: (paymentId) =>
    api.post(`/payments/${paymentId}/mock-confirm`).then((r) => r.data.data),
  mockFail: (paymentId, reason) =>
    api
      .post(`/payments/${paymentId}/mock-fail`, reason ? { reason } : {})
      .then((r) => r.data.data),
};
