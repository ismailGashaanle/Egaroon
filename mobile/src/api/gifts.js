import api from './client';

export const giftsApi = {
  listActive: () => api.get('/gifts/active'),
  enter: (campaignId, payload = {}) => api.post(`/gifts/campaigns/${campaignId}/enter`, payload),
  myVouchers: () => api.get('/gifts/vouchers/mine'),
};
