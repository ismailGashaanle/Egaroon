import axiosClient from './axiosClient';

export const bookingApi = {
  listMine: () => axiosClient.get('/bookings'),
  get: (bookingId) => axiosClient.get(`/bookings/${bookingId}`),
  create: (payload) => axiosClient.post('/bookings', payload),
  inviteTeamB: (bookingId, payload) => axiosClient.post(`/bookings/${bookingId}/invite-team-b`, payload),
  lookupMatchCode: (code, teamAPhone, carrierId) =>
    axiosClient.get(`/bookings/match-code/${encodeURIComponent(code)}`, {
      params: {
        ...(teamAPhone ? { teamAPhone: String(teamAPhone) } : {}),
        ...(carrierId ? { carrierId, teamACarrier: carrierId } : {}),
      },
    }),
  joinByCode: (payload) => axiosClient.post('/bookings/join-by-code', payload),
  lockInvitePhone: (bookingId, payload) =>
    axiosClient.post(`/bookings/${bookingId}/lock-invite-phone`, payload),
  cancel: (bookingId, reason) => axiosClient.post(`/bookings/${bookingId}/cancel`, { reason }),
  cancelWithPolicy: (bookingId, payload) =>
    axiosClient.post(`/bookings/${bookingId}/cancel-with-policy`, payload),
  checkIn: (bookingId) => axiosClient.post(`/bookings/${bookingId}/check-in`),
  getLineups: (bookingId) => axiosClient.get(`/bookings/${bookingId}/lineups`),
  upsertLineup: (bookingId, payload) => axiosClient.put(`/bookings/${bookingId}/lineup`, payload),
  getChangeRequests: (bookingId) => axiosClient.get(`/bookings/${bookingId}/change-requests`),
  requestReschedule: (bookingId, payload) =>
    axiosClient.post(`/bookings/${bookingId}/reschedule-request`, payload),
  respondChangeRequest: (requestId, payload) =>
    axiosClient.post(`/bookings/change-requests/${requestId}/respond`, payload),
  getCaptainJoogtoCards: () => axiosClient.get('/bookings/joogto-cards'),
};

export const notificationApi = {
  list: () => axiosClient.get('/notifications'),
  markRead: (id) => axiosClient.post(`/notifications/${id}/read`),
};

export const paymentApi = {
  listMine: () => axiosClient.get('/payments'),
  get: (paymentId) => axiosClient.get(`/payments/${paymentId}`),
  initiate: (payload) => axiosClient.post('/payments', payload),
  mockConfirm: (paymentId) => axiosClient.post(`/payments/${paymentId}/mock-confirm`),
  mockFail: (paymentId, reason) =>
    axiosClient.post(`/payments/${paymentId}/mock-fail`, reason ? { reason } : {}),
  settleBooking: (bookingId) => axiosClient.post(`/payments/bookings/${bookingId}/settle`),
  expireStaleHolds: () => axiosClient.post('/payments/maintenance/expire-stale-holds'),
};

export const tournamentApi = {
  list: (params) => axiosClient.get('/tournaments', { params }),
  get: (id) => axiosClient.get(`/tournaments/${id}`),
  create: (payload) => axiosClient.post('/tournaments', payload),
  publish: (id) => axiosClient.post(`/tournaments/${id}/publish`),
  register: (id, payload) => axiosClient.post(`/tournaments/${id}/register`, payload),
  payFee: (id, payload) => axiosClient.post(`/tournaments/${id}/pay-fee`, payload),
  assignGroups: (id, payload) => axiosClient.post(`/tournaments/${id}/assign-groups`, payload),
  recordResult: (fixtureId, payload) => axiosClient.patch(`/tournaments/fixtures/${fixtureId}/result`, payload),
};

export const ownerApi = {
  listBookings: (params) => axiosClient.get('/owner/bookings', { params }),
  getBooking: (bookingId) => axiosClient.get(`/owner/bookings/${bookingId}`),
  listPendingAccepts: (params) => axiosClient.get('/owner/bookings/pending-accept', { params }),
  acceptBooking: (bookingId) => axiosClient.post(`/owner/bookings/${bookingId}/accept`),
  walkIn: (payload) => axiosClient.post('/owner/walk-in', payload),
  revenue: () => axiosClient.get('/owner/revenue'),
  gateCheckIn: (payload) => axiosClient.post('/owner/check-in', payload),
  listRecurring: (params) => axiosClient.get('/owner/recurring', { params }),
  createRecurring: (payload) => axiosClient.post('/owner/recurring', payload),
  updateRecurring: (recurringId, payload) =>
    axiosClient.patch(`/owner/recurring/${recurringId}`, payload),
  deleteRecurring: (recurringId) => axiosClient.delete(`/owner/recurring/${recurringId}`),
  verifyJoogtoCard: (payload) => axiosClient.post('/owner/recurring/verify-card', payload),
  markJoogtoPaid: (recurringId, payload) =>
    axiosClient.post(`/owner/recurring/${recurringId}/mark-paid`, payload),
  listDiscounts: (params) => axiosClient.get('/owner/discounts', { params }),
  createDiscount: (payload) => axiosClient.post('/owner/discounts', payload),
  updateDiscount: (discountId, payload) => axiosClient.patch(`/owner/discounts/${discountId}`, payload),
  deleteDiscount: (discountId) => axiosClient.delete(`/owner/discounts/${discountId}`),
  reports: (params) => axiosClient.get('/owner/reports', { params }),
  slotReports: (params) => axiosClient.get('/owner/reports/slots', { params }),
  exportReports: (params) =>
    axiosClient.get('/owner/reports/export', { params, responseType: 'blob' }),
  getStadiumPolicy: (stadiumId) => axiosClient.get(`/owner/stadiums/${stadiumId}/policy`),
  updateStadiumPolicy: (stadiumId, payload) =>
    axiosClient.patch(`/owner/stadiums/${stadiumId}/policy`, payload),
};

