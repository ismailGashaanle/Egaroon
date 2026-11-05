const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const FOLDERS = {
  avatars: 'kulansiiye/avatars',
  stadiums: 'kulansiiye/stadiums',
  fields: 'kulansiiye/fields',
  lineups: 'kulansiiye/lineups',
  receipts: 'kulansiiye/receipts',
  invoices: 'kulansiiye/invoices',
  videos: 'kulansiiye/videos',
  site: 'kulansiiye/site',
  team: 'kulansiiye/team',
  signatures: 'kulansiiye/signatures',
  misc: 'kulansiiye/misc',
};

const ALLOWED_FOLDERS = Object.keys(FOLDERS);
const ALLOWED_RESOURCE_TYPES = ['image', 'video', 'raw', 'auto'];

let configured = false;

function isEnabled() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  return Boolean(cloudName && apiKey && apiSecret);
}

function ensureConfigured() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw ApiError.badRequest(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.'
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
}

function resolveFolder(folder) {
  const key = ALLOWED_FOLDERS.includes(folder) ? folder : 'misc';
  return FOLDERS[key];
}

function normalizeResult(result) {
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    folder: result.folder,
  };
}

function uploadOptions({ folder, resourceType = 'auto', publicId, tags = [] }) {
  const opts = {
    folder: resolveFolder(folder),
    resource_type: ALLOWED_RESOURCE_TYPES.includes(resourceType) ? resourceType : 'auto',
    overwrite: false,
    unique_filename: true,
    tags: ['kulansiiye', folder, ...tags].filter(Boolean),
  };
  if (publicId) opts.public_id = publicId;
  return opts;
}

async function uploadBuffer(buffer, options = {}) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions(options), (err, result) => {
      if (err) {
        reject(ApiError.badRequest(err.message || 'Cloudinary upload failed'));
        return;
      }
      resolve(normalizeResult(result));
    });
    stream.end(buffer);
  });
}

async function uploadDataUri(dataUri, options = {}) {
  ensureConfigured();
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    throw ApiError.badRequest('Expected a data URI (data:image/...;base64,...)');
  }
  try {
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions(options));
    return normalizeResult(result);
  } catch (err) {
    throw ApiError.badRequest(err.message || 'Cloudinary upload failed');
  }
}

async function uploadFromUrl(fileUrl, options = {}) {
  ensureConfigured();
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw ApiError.badRequest('fileUrl is required');
  }
  try {
    const result = await cloudinary.uploader.upload(fileUrl, uploadOptions(options));
    return normalizeResult(result);
  } catch (err) {
    throw ApiError.badRequest(err.message || 'Cloudinary upload failed');
  }
}

function deliveryUrl(publicId, transforms = {}) {
  ensureConfigured();
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: transforms.fetch_format || 'auto',
    quality: transforms.quality || 'auto',
    ...transforms,
  });
}

module.exports = {
  ALLOWED_FOLDERS,
  ALLOWED_RESOURCE_TYPES,
  isEnabled,
  uploadBuffer,
  uploadDataUri,
  uploadFromUrl,
  deliveryUrl,
};
