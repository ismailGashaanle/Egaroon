import api from './client';

export const bookingsApi = {
  mine: () => api.get('/bookings').then((r) => r.data.data),
  get: (bookingId) => api.get(`/bookings/${bookingId}`).then((r) => r.data.data),
  create: (payload) => api.post('/bookings', payload).then((r) => r.data.data),
  inviteTeamB: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/invite-team-b`, payload).then((r) => r.data.data),
  lookupMatchCode: (code, teamAPhone, carrierId) =>
    api
      .get(`/bookings/match-code/${encodeURIComponent(code)}`, {
        params: {
          ...(teamAPhone ? { teamAPhone: String(teamAPhone) } : {}),
          ...(carrierId ? { carrierId, teamACarrier: carrierId } : {}),
        },
      })
      .then((r) => r.data.data),
  joinByCode: (payload) =>
    api.post('/bookings/join-by-code', payload).then((r) => r.data.data),
  lockInvitePhone: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/lock-invite-phone`, payload).then((r) => r.data.data),
  cancel: (bookingId, reason) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }).then((r) => r.data.data),
  cancelWithPolicy: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/cancel-with-policy`, payload).then((r) => r.data.data),
  getChangeRequests: (bookingId) =>
    api.get(`/bookings/${bookingId}/change-requests`).then((r) => r.data.data),
  requestReschedule: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/reschedule-request`, payload).then((r) => r.data.data),
  respondChangeRequest: (requestId, payload) =>
    api.post(`/bookings/change-requests/${requestId}/respond`, payload).then((r) => r.data.data),
  getLineups: (bookingId) =>
    api.get(`/bookings/${bookingId}/lineups`).then((r) => r.data.data),
  upsertLineup: (bookingId, payload) =>
    api.put(`/bookings/${bookingId}/lineup`, payload).then((r) => r.data.data),
  getJoogtoCards: () =>
    api.get('/bookings/joogto-cards').then((r) => r.data.data),
};
