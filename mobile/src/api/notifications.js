import api from './client';

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data.data),
};
