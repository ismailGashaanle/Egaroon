import axiosClient from './axiosClient';

export const weatherApi = {
  /** Query: date (YYYY-MM-DD), city, region, q, lat, lng, stadiumId */
  lookup: (params = {}) => axiosClient.get('/weather', { params }),
  alerts: (params = {}) => axiosClient.get('/weather/alerts', { params }),
  cities: () => axiosClient.get('/weather/cities'),
  addCity: (body) => axiosClient.post('/weather/cities', body),
  removeCity: (id) => axiosClient.delete(`/weather/cities/${id}`),
  refresh: () => axiosClient.post('/weather/refresh'),
};
