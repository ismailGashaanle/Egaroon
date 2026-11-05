import axiosClient from './axiosClient';

export const teamApi = {
  listMine: () => axiosClient.get('/teams'),
  get: (teamId) => axiosClient.get(`/teams/${teamId}`),
  create: (payload) => axiosClient.post('/teams', payload),
  update: (teamId, payload) => axiosClient.patch(`/teams/${teamId}`, payload),
  remove: (teamId) => axiosClient.delete(`/teams/${teamId}`),
  addPlayer: (teamId, payload) => axiosClient.post(`/teams/${teamId}/players`, payload),
  removePlayer: (teamId, playerId) => axiosClient.delete(`/teams/${teamId}/players/${playerId}`),
};
