import axiosClient from './axiosClient';

export const ownerApi = {
  listAgreements: () => axiosClient.get('/owner/agreements'),
  acceptAgreement: (id) => axiosClient.post(`/owner/agreements/${id}/accept`),
  rejectAgreement: (id, payload) => axiosClient.post(`/owner/agreements/${id}/reject`, payload),
  getStadiumPolicy: (stadiumId) => axiosClient.get(`/owner/stadiums/${stadiumId}/policy`),
  updateStadiumPolicy: (stadiumId, payload) => axiosClient.patch(`/owner/stadiums/${stadiumId}/policy`, payload),
  saveDraftPolicy: (stadiumId, payload) => axiosClient.post(`/owner/stadiums/${stadiumId}/policy/draft`, payload),
  publishPolicy: (stadiumId, payload) => axiosClient.post(`/owner/stadiums/${stadiumId}/policy/publish`, payload),
  listChangeRequests: () => axiosClient.get('/owner/change-requests'),
  proposeReschedule: (bookingId, payload) =>
    axiosClient.post(`/bookings/${bookingId}/reschedule-request`, payload),
  respondChangeRequest: (requestId, payload) =>
    axiosClient.post(`/bookings/change-requests/${requestId}/respond`, payload),

  // ── E-Garoon Wallet & Payouts ────────────────────────────────────────────
  getWallet: (params) => axiosClient.get('/owner/wallet', { params }),
  getWalletTransactions: (params) => axiosClient.get('/owner/wallet/transactions', { params }),
  submitKyc: (payload) => axiosClient.post('/owner/wallet/kyc', payload),
  initiateWithdrawal: (payload) => axiosClient.post('/owner/wallet/withdraw', payload),
  verifyWithdrawalOtp: (payload) => axiosClient.post('/owner/wallet/withdraw/verify-otp', payload),
  cancelWithdrawal: (id) => axiosClient.post(`/owner/wallet/withdrawals/${id}/cancel`),
  listWithdrawals: (params) => axiosClient.get('/owner/wallet/withdrawals', { params }),
};
