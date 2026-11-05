import axiosClient from './axiosClient';

/** Public CMS — no auth required. */
export const siteContentApi = {
  getPublic: () => axiosClient.get('/platform/content'),
};

export const adminApiSiteContent = {
  get: () => axiosClient.get('/admin/site-content'),
  update: (payload) => axiosClient.patch('/admin/site-content', payload),
};
