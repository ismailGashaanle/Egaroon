import api from './client';

/** Owner / manager ops — `/api/owner/*` (backend source of truth). */
export const ownerApi = {
  /**
   * Gate QR check-in (owner + stadium_manager).
   * Body: { stadiumId, bookingCode?, qrPayload?, force?, validateOnly? }
   */
  checkIn: (body) => api.post('/owner/check-in', body).then((r) => r.data.data),

  todayBookings: (params = {}) =>
    api.get('/owner/bookings', { params }).then((r) => r.data.data),

  /** Search/filter owner bookings — date, time, name, phone, q, stadiumId */
  listBookings: (params = {}) =>
    api.get('/owner/bookings', { params }).then((r) => r.data.data),

  getBooking: (bookingId) =>
    api.get(`/owner/bookings/${bookingId}`).then((r) => r.data.data),

  /** Walk-in at venue: create booking + pay (full / half_a / cash_full). */
  walkIn: (payload) => api.post('/owner/walk-in', payload).then((r) => r.data.data),

  pendingAccepts: (params = {}) =>
    api.get('/owner/bookings/pending-accept', { params }).then((r) => r.data.data),

  acceptBooking: (bookingId) =>
    api.post(`/owner/bookings/${bookingId}/accept`).then((r) => r.data.data),

  revenue: () => api.get('/owner/revenue').then((r) => r.data.data),

  reports: (params = {}) => api.get('/owner/reports', { params }).then((r) => r.data.data),

  /** Slot utilization: booked / available / lost / unbooked days */
  slotReports: (params = {}) =>
    api.get('/owner/reports/slots', { params }).then((r) => r.data.data),

  /** Binary export — caller handles arraybuffer. */
  exportReports: (params = {}) =>
    api.get('/owner/reports/export', {
      params,
      responseType: 'arraybuffer',
    }),

  listRecurring: (params = {}) =>
    api.get('/owner/recurring', { params }).then((r) => r.data.data),

  createRecurring: (payload) =>
    api.post('/owner/recurring', payload).then((r) => r.data.data),

  updateRecurring: (recurringId, payload) =>
    api.patch(`/owner/recurring/${recurringId}`, payload).then((r) => r.data.data),

  deleteRecurring: (recurringId) =>
    api.delete(`/owner/recurring/${recurringId}`).then((r) => r.data.data),

  listDiscounts: (params = {}) =>
    api.get('/owner/discounts', { params }).then((r) => r.data.data),

  createDiscount: (payload) =>
    api.post('/owner/discounts', payload).then((r) => r.data.data),

  updateDiscount: (discountId, payload) =>
    api.patch(`/owner/discounts/${discountId}`, payload).then((r) => r.data.data),

  deleteDiscount: (discountId) =>
    api.delete(`/owner/discounts/${discountId}`).then((r) => r.data.data),

  /** Stadium Agreements — dynamic revenue agreement with Super Admin */
  listAgreements: () => api.get('/owner/agreements').then((r) => r.data.data),

  acceptAgreement: (agreementId) =>
    api.post(`/owner/agreements/${agreementId}/accept`).then((r) => r.data.data),

  rejectAgreement: (agreementId, body = {}) =>
    api.post(`/owner/agreements/${agreementId}/reject`, body).then((r) => r.data.data),

  /** Stadium Booking & Reschedule Policy */
  getStadiumPolicy: (stadiumId) =>
    api.get(`/owner/stadiums/${stadiumId}/policy`).then((r) => r.data.data),

  updateStadiumPolicy: (stadiumId, payload) =>
    api.patch(`/owner/stadiums/${stadiumId}/policy`, payload).then((r) => r.data.data),

  saveDraftPolicy: (stadiumId, payload) =>
    api.post(`/owner/stadiums/${stadiumId}/policy/draft`, payload).then((r) => r.data.data),

  publishPolicy: (stadiumId, payload) =>
    api.post(`/owner/stadiums/${stadiumId}/policy/publish`, payload).then((r) => r.data.data),

  listChangeRequests: () =>
    api.get('/owner/change-requests').then((r) => r.data.data),

  proposeReschedule: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/reschedule-request`, payload).then((r) => r.data.data),

  respondChangeRequest: (requestId, payload) =>
    api.post(`/bookings/change-requests/${requestId}/respond`, payload).then((r) => r.data.data),

  listSubscriptions: () =>
    api.get('/owner/subscriptions').then((r) => r.data.data),

  paySubscription: (periodId, payload) =>
    api.post(`/owner/subscriptions/${periodId}/pay`, payload).then((r) => r.data.data),

  submitSubscriptionProof: (periodId, payload) =>
    api.post(`/owner/subscriptions/${periodId}/submit-proof`, payload).then((r) => r.data.data),

  /** Joogto VIP Pass verification & Mark Paid */
  verifyJoogtoCard: (payload) =>
    api.post('/owner/recurring/verify-card', payload).then((r) => r.data.data),

  markJoogtoPaid: (recurringId, payload) =>
    api.post(`/owner/recurring/${recurringId}/mark-paid`, payload).then((r) => r.data.data),

  /** E-Garoon Wallet & Payout Operations */
  getWallet: () => api.get('/owner/wallet').then((r) => r.data),
  getWalletTransactions: (params = {}) => api.get('/owner/wallet/transactions', { params }).then((r) => r.data),
  submitKyc: (payload) => api.post('/owner/wallet/kyc', payload).then((r) => r.data),
  initiateWithdrawal: (payload) => api.post('/owner/wallet/withdraw/initiate', payload).then((r) => r.data),
  verifyWithdrawalOtp: (payload) => api.post('/owner/wallet/withdraw/verify-otp', payload).then((r) => r.data),
  listWithdrawals: () => api.get('/owner/wallet/withdrawals').then((r) => r.data),
};
