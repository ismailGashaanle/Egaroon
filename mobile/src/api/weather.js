import api from './client';

export const weatherApi = {
  lookup: (params = {}) => api.get('/weather', { params }).then((r) => r.data.data),
  alerts: (params = {}) => api.get('/weather/alerts', { params }).then((r) => r.data.data),
};
