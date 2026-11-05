const cloudflareR2Service = require('./cloudflareR2.service');
const cloudinaryService = require('./cloudinary.service');

const FOLDERS = cloudflareR2Service.FOLDERS;
const ALLOWED_FOLDERS = cloudflareR2Service.ALLOWED_FOLDERS;
const ALLOWED_RESOURCE_TYPES = cloudflareR2Service.ALLOWED_RESOURCE_TYPES;

function getActiveProviderName() {
  const explicit = (process.env.STORAGE_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'cloudinary') return 'cloudinary';
  if (explicit === 'cloudflare' || explicit === 'r2') return 'cloudflare';

  // Auto detection: Cloudflare R2 takes priority if configured
  if (cloudflareR2Service.isEnabled()) return 'cloudflare';
  if (cloudinaryService.isEnabled()) return 'cloudinary';

  // Default to Cloudflare R2
  return 'cloudflare';
}

function getActiveProvider() {
  const provider = getActiveProviderName();
  if (provider === 'cloudinary') return cloudinaryService;
  return cloudflareR2Service;
}

function isEnabled() {
  return getActiveProvider().isEnabled();
}

function getStatus() {
  const activeProvider = getActiveProviderName();
  return {
    activeProvider,
    cloudflare: {
      enabled: cloudflareR2Service.isEnabled(),
      bucket: cloudflareR2Service.getConfig().bucketName,
      publicUrl: cloudflareR2Service.getConfig().publicUrl || null,
      dashboardUrl: 'https://dash.cloudflare.com',
    },
    cloudinary: {
      enabled: cloudinaryService.isEnabled(),
    },
    folders: ALLOWED_FOLDERS,
    resourceTypes: ALLOWED_RESOURCE_TYPES,
  };
}

async function uploadBuffer(buffer, options = {}) {
  const provider = getActiveProvider();
  return provider.uploadBuffer(buffer, options);
}

async function uploadDataUri(dataUri, options = {}) {
  const provider = getActiveProvider();
  return provider.uploadDataUri(dataUri, options);
}

async function uploadFromUrl(fileUrl, options = {}) {
  const provider = getActiveProvider();
  return provider.uploadFromUrl(fileUrl, options);
}

async function deleteFile(keyOrUrl) {
  const provider = getActiveProvider();
  if (typeof provider.deleteFile === 'function') {
    return provider.deleteFile(keyOrUrl);
  }
  return false;
}

module.exports = {
  FOLDERS,
  ALLOWED_FOLDERS,
  ALLOWED_RESOURCE_TYPES,
  getActiveProviderName,
  isEnabled,
  getStatus,
  uploadBuffer,
  uploadDataUri,
  uploadFromUrl,
  deleteFile,
};
