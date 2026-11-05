import client from './axiosClient';

export const subscriptionApi = {
  // Super Admin
  listSuperAdmin: (params) => client.get('/admin/subscriptions', { params }),
  markSuperAdmin: (periodId, data) => client.patch(`/admin/subscriptions/${periodId}`, data),
  approveSuperAdmin: (periodId, data) => client.post(`/admin/subscriptions/${periodId}/approve`, data),

  // Stadium Owner
  listOwner: () => client.get('/owner/subscriptions'),
  payOwner: (periodId, data) => client.post(`/owner/subscriptions/${periodId}/pay`, data),
  submitProof: (periodId, data) => client.post(`/owner/subscriptions/${periodId}/submit-proof`, data),
  updateSettings: (stadiumId, data) => client.patch(`/owner/stadiums/${stadiumId}/subscription-settings`, data),
};
