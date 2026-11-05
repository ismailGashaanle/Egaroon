import axiosClient from './axiosClient';

export const stadiumApi = {
  list: (params) => axiosClient.get('/stadiums', { params }),
  get: (stadiumId) => axiosClient.get(`/stadiums/${stadiumId}`),
  create: (payload) => axiosClient.post('/stadiums', payload),
  update: (stadiumId, payload) => axiosClient.patch(`/stadiums/${stadiumId}`, payload),
  remove: (stadiumId) => axiosClient.delete(`/stadiums/${stadiumId}`),
  setStatus: (stadiumId, status) => axiosClient.post(`/stadiums/${stadiumId}/verify`, { status }),

  listFields: (stadiumId) => axiosClient.get(`/stadiums/${stadiumId}/fields`),
  createField: (stadiumId, payload) => axiosClient.post(`/stadiums/${stadiumId}/fields`, payload),

  listManagers: (stadiumId) => axiosClient.get(`/stadiums/${stadiumId}/managers`),
  inviteManager: (stadiumId, payload) => axiosClient.post(`/stadiums/${stadiumId}/managers`, payload),
  revokeManager: (stadiumId, managerId) => axiosClient.delete(`/stadiums/${stadiumId}/managers/${managerId}`),

  listAvailabilityBlocks: (stadiumId, params) =>
    axiosClient.get(`/stadiums/${stadiumId}/availability-blocks`, { params }),

  /** Close whole stadium (all fields) for a time range — no public booking */
  lockStadium: (stadiumId, payload) =>
    axiosClient.post(`/stadiums/${stadiumId}/lock`, payload),

  setOps: (stadiumId, payload) => axiosClient.post(`/stadiums/${stadiumId}/ops`, payload),
};

export const fieldApi = {
  get: (fieldId) => axiosClient.get(`/fields/${fieldId}`),
  update: (fieldId, payload) => axiosClient.patch(`/fields/${fieldId}`, payload),
  remove: (fieldId) => axiosClient.delete(`/fields/${fieldId}`),
  setOps: (fieldId, payload) => axiosClient.post(`/fields/${fieldId}/ops`, payload),
  listSlots: (fieldId, date) => axiosClient.get(`/fields/${fieldId}/slots`, { params: { date } }),
  listAvailabilityBlocks: (fieldId, params) =>
    axiosClient.get(`/fields/${fieldId}/availability`, { params }),
  createAvailabilityBlock: (fieldId, payload) => axiosClient.post(`/fields/${fieldId}/availability`, payload),
  updateAvailabilityBlock: (blockId, payload) => axiosClient.patch(`/availability-blocks/${blockId}`, payload),
  deleteAvailabilityBlock: (blockId) => axiosClient.delete(`/availability-blocks/${blockId}`),
};
