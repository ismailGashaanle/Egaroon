import api from './client';

/** Cloudflare R2 / Object Storage uploads via `/api/uploads` (auth required). */
export const uploadsApi = {
  status: () => api.get('/uploads/status').then((r) => r.data.data),

  /**
   * Multipart upload. `file` shape for React Native:
   * `{ uri, name, type }`
   */
  uploadFile: (file, { folder = 'misc', resourceType } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (resourceType) form.append('resourceType', resourceType);
    return api
      .post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: [(data, headers) => {
          // Let RN set multipart boundary; drop default JSON content-type.
          if (headers && typeof headers === 'object') {
            delete headers['Content-Type'];
            delete headers['content-type'];
          }
          return data;
        }],
        timeout: 120000,
      })
      .then((r) => r.data.data);
  },

  uploadFromUrl: (fileUrl, { folder = 'misc', resourceType = 'auto' } = {}) =>
    api
      .post('/uploads/url', { fileUrl, folder, resourceType }, { timeout: 120000 })
      .then((r) => r.data.data),
};
