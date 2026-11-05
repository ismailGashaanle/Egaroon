import axiosClient from './axiosClient';

/**
 * Upload media via Express → Cloudflare R2 (Object Storage).
 * Folders: avatars | stadiums | fields | lineups | receipts | invoices | videos | misc
 */
export const uploadApi = {
  status: () => axiosClient.get('/uploads/status'),

  /** Multipart file upload (preferred). */
  uploadFile: (file, { folder = 'misc', resourceType } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (resourceType) form.append('resourceType', resourceType);
    return axiosClient.post('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },

  /** For canvas / QR / receipt data URIs. */
  uploadDataUri: (dataUri, { folder = 'receipts', resourceType = 'image', publicId } = {}) =>
    axiosClient.post(
      '/uploads/base64',
      { dataUri, folder, resourceType, publicId },
      { timeout: 120000 }
    ),

  /** Import an existing remote URL into Cloudinary. */
  uploadFromUrl: (fileUrl, { folder = 'misc', resourceType = 'auto', publicId } = {}) =>
    axiosClient.post('/uploads/url', { fileUrl, folder, resourceType, publicId }),
};
