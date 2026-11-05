import api from './client';

export const stadiumsApi = {
  list: (params = {}) => api.get('/stadiums', { params }).then((r) => r.data.data),

  get: (stadiumId) => api.get(`/stadiums/${stadiumId}`).then((r) => r.data.data),

  mine: () => api.get('/stadiums', { params: { mine: 'true' } }).then((r) => r.data.data),

  create: (payload) => api.post('/stadiums', payload).then((r) => r.data.data),

  update: (stadiumId, payload) =>
    api.patch(`/stadiums/${stadiumId}`, payload).then((r) => r.data.data),

  delete: (stadiumId) => api.delete(`/stadiums/${stadiumId}`).then((r) => r.data.data),

  listFields: (stadiumId) =>
    api.get(`/stadiums/${stadiumId}/fields`).then((r) => r.data.data),

  createField: (stadiumId, payload) =>
    api.post(`/stadiums/${stadiumId}/fields`, payload).then((r) => r.data.data),

  updateField: (fieldId, payload) =>
    api.patch(`/fields/${fieldId}`, payload).then((r) => r.data.data),

  getField: (fieldId) => api.get(`/fields/${fieldId}`).then((r) => r.data.data),

  deleteField: (fieldId) => api.delete(`/fields/${fieldId}`).then((r) => r.data.data),

  listSlots: (fieldId, date) =>
    api.get(`/fields/${fieldId}/slots`, { params: { date } }).then((r) => r.data.data),

  listBlocks: (stadiumId, params = {}) =>
    api
      .get(`/stadiums/${stadiumId}/availability-blocks`, { params })
      .then((r) => r.data.data),

  createBlock: (fieldId, payload) =>
    api.post(`/fields/${fieldId}/availability`, payload).then((r) => r.data.data),

  /** Lock whole stadium — no bookings on any field for the range */
  lockStadium: (stadiumId, payload) =>
    api.post(`/stadiums/${stadiumId}/lock`, payload).then((r) => r.data.data),

  deleteBlock: (blockId) =>
    api.delete(`/availability-blocks/${blockId}`).then((r) => r.data.data),

  setOps: (stadiumId, payload) =>
    api.post(`/stadiums/${stadiumId}/ops`, payload).then((r) => r.data.data),

  setFieldOps: (fieldId, payload) =>
    api.post(`/fields/${fieldId}/ops`, payload).then((r) => r.data.data),

  listManagers: (stadiumId) =>
    api.get(`/stadiums/${stadiumId}/managers`).then((r) => r.data.data),

  inviteManager: (stadiumId, payload) =>
    api.post(`/stadiums/${stadiumId}/managers`, payload).then((r) => r.data.data),

  revokeManager: (stadiumId, managerId) =>
    api.delete(`/stadiums/${stadiumId}/managers/${managerId}`).then((r) => r.data.data),
};
