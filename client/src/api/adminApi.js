import axiosClient from './axiosClient';

export const adminApi = {
  listUsers: (params) => axiosClient.get('/admin/users', { params }),
  createUser: (payload) => axiosClient.post('/admin/users', payload),
  setUserStatus: (userId, status) => axiosClient.patch(`/admin/users/${userId}/status`, { status }),
  setUserRole: (userId, role) => axiosClient.patch(`/admin/users/${userId}/role`, { role }),
  updateUser: (userId, payload) => axiosClient.patch(`/admin/users/${userId}`, payload),
  deleteUser: (userId) => axiosClient.delete(`/admin/users/${userId}`),
  restoreUser: (userId) => axiosClient.post(`/admin/users/${userId}/restore`),
  listPayments: (params) => axiosClient.get('/admin/payments', { params }),
  reviewPayment: (paymentId, payload) =>
    axiosClient.patch(`/admin/payments/${paymentId}/review`, payload),
  getSettings: () => axiosClient.get('/admin/settings'),
  updateSettings: (payload) => axiosClient.patch('/admin/settings', payload),
  getSiteContent: () => axiosClient.get('/admin/site-content'),
  updateSiteContent: (payload) => axiosClient.patch('/admin/site-content', payload),
  getProfitReport: (params) => axiosClient.get('/admin/reports/profit', { params }),
  getProfitInsights: (params) => axiosClient.get('/admin/reports/profit/insights', { params }),
  getBusinessPlan: (params) => axiosClient.get('/admin/reports/planner', { params }),
  runBusinessPlan: (payload) => axiosClient.post('/admin/reports/planner', payload),
  exportProfitReport: (params) =>
    axiosClient.get('/admin/reports/profit/export', { params, responseType: 'blob' }),
  backfillCommission: (payload) => axiosClient.post('/admin/reports/commission/backfill', payload),
  listGiftCampaigns: (params) => axiosClient.get('/gifts/campaigns', { params }),
  createGiftCampaign: (payload) => axiosClient.post('/gifts/campaigns', payload),
  endGiftCampaign: (campaignId) => axiosClient.post(`/gifts/campaigns/${campaignId}/end`),
  activateGiftCampaign: (campaignId) => axiosClient.post(`/gifts/campaigns/${campaignId}/activate`),
  listSubscriptions: (params) => axiosClient.get('/admin/subscriptions', { params }),
  markSubscription: (periodId, payload) =>
    axiosClient.patch(`/admin/subscriptions/${periodId}`, payload),

  listOwnerOnboardings: (params) => axiosClient.get('/admin/owner-onboardings', { params }),
  getOwnerOnboarding: (id) => axiosClient.get(`/admin/owner-onboardings/${id}`),
  createOwnerOnboarding: (payload) => axiosClient.post('/admin/owner-onboardings', payload),
  updateOwnerOnboarding: (id, payload) => axiosClient.patch(`/admin/owner-onboardings/${id}`, payload),
  submitOwnerOnboardingAgreement: (id) =>
    axiosClient.post(`/admin/owner-onboardings/${id}/submit-agreement`),
  signOwnerOnboarding: (id, payload) =>
    axiosClient.post(`/admin/owner-onboardings/${id}/signatures`, payload),
  activateOwnerOnboarding: (id, payload) =>
    axiosClient.post(`/admin/owner-onboardings/${id}/activate`, payload),
  cancelOwnerOnboarding: (id, payload) =>
    axiosClient.post(`/admin/owner-onboardings/${id}/cancel`, payload),
  suggestOwnerEmail: (params) =>
    axiosClient.get('/admin/owner-onboardings/suggest-email', { params }),
  /** Soft A4 agreement PDF — template (live Site Content) or filled draft. */
  downloadOwnerAgreementPdf: ({ onboardingId, lang = 'so' } = {}) =>
    onboardingId
      ? axiosClient.get(`/admin/owner-onboardings/${onboardingId}/agreement-pdf`, {
          params: { lang },
          responseType: 'blob',
        })
      : axiosClient.get('/admin/owner-onboardings/agreement-pdf', {
          params: { lang },
          responseType: 'blob',
        }),

  // ── Stadium Agreements ────────────────────────────────────────────────────
  listAgreements: (params) => axiosClient.get('/admin/agreements', { params }),
  createAgreement: (payload) => axiosClient.post('/admin/agreements', payload),
  createDefaultAgreement: (stadiumId, payload) =>
    axiosClient.post(`/admin/agreements/stadium/${stadiumId}/default`, payload),
  getAgreement: (id) => axiosClient.get(`/admin/agreements/${id}`),
  sendAgreement: (id, payload) => axiosClient.post(`/admin/agreements/${id}/send`, payload),
  suspendAgreement: (id, payload) => axiosClient.post(`/admin/agreements/${id}/suspend`, payload),
  createAgreementVersion: (id, payload) => axiosClient.post(`/admin/agreements/${id}/version`, payload),

  // ── Department of Finance: E-Garoon Master Accounts & Payouts ─────────────
  getFinanceOverview: () => axiosClient.get('/admin/finance/overview'),
  listFinanceWithdrawals: (params) => axiosClient.get('/admin/finance/withdrawals', { params }),
  approveWithdrawal: (id, payload) => axiosClient.post(`/admin/finance/withdrawals/${id}/approve`, payload),
  rejectWithdrawal: (id, payload) => axiosClient.post(`/admin/finance/withdrawals/${id}/reject`, payload),
  listFinanceKyc: (params) => axiosClient.get('/admin/finance/kyc', { params }),
  reviewKyc: (userId, payload) => axiosClient.post(`/admin/finance/kyc/${userId}/review`, payload),
  getMasterAccounts: () => axiosClient.get('/admin/finance/master-accounts'),
  updateMasterAccounts: (payload) => axiosClient.put('/admin/finance/master-accounts', payload),
};
