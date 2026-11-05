import api from './client';

export const tournamentsApi = {
  list: (params = {}) => api.get('/tournaments', { params }).then((r) => r.data.data),

  get: (tournamentId) =>
    api.get(`/tournaments/${tournamentId}`).then((r) => r.data.data),

  create: (payload) => api.post('/tournaments', payload).then((r) => r.data.data),

  publish: (tournamentId) =>
    api.post(`/tournaments/${tournamentId}/publish`).then((r) => r.data.data),

  assignGroups: (tournamentId, payload = { groupSize: 4 }) =>
    api
      .post(`/tournaments/${tournamentId}/assign-groups`, payload)
      .then((r) => r.data.data),
};
