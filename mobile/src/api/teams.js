import api from './client';

export const teamsApi = {
  listMine: () => api.get('/teams').then((r) => r.data.data),
  create: (payload) => api.post('/teams', payload).then((r) => r.data.data),
};
