const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID: uuid } = require('crypto');
const path = require('path');
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

let s3ClientInstance = null;

function getConfig() {
  const accountId = (
    process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
    process.env.R2_ACCOUNT_ID ||
    ''
  ).trim();
  const accessKeyId = (
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.R2_ACCESS_KEY_ID ||
    ''
  ).trim();
  const secretAccessKey = (
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    ''
  ).trim();
  const bucketName = (
    process.env.CLOUDFLARE_R2_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME ||
    'kulansiiye'
  ).trim();
  const rawPublicUrl = (
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ''
  ).trim().replace(/\/+$/, '');
  const endpoint = (
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  ).trim();

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: rawPublicUrl,
    endpoint,
  };
}

function isEnabled() {
  const { accountId, accessKeyId, secretAccessKey } = getConfig();
  return Boolean(accountId && accessKeyId && secretAccessKey);
}

function getS3Client() {
  const { accountId, accessKeyId, secretAccessKey, endpoint } = getConfig();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw ApiError.badRequest(
      'Cloudflare R2 is not configured. Fadlan geli R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, iyo R2_SECRET_ACCESS_KEY (ka hel https://dash.cloudflare.com).'
    );
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: endpoint || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

function resolveFolder(folder) {
  const key = ALLOWED_FOLDERS.includes(folder) ? folder : 'misc';
  return FOLDERS[key];
}

function mimeToExtension(mimetype) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
  };
  return map[mimetype] || '';
}

function buildPublicUrl(key) {
  const { publicUrl, bucketName, accountId } = getConfig();
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Uploads raw Buffer to Cloudflare R2 bucket.
 */
async function uploadBuffer(buffer, options = {}) {
  const { folder = 'misc', resourceType = 'auto', mimetype = 'application/octet-stream', originalname = '' } = options;
  const targetFolder = resolveFolder(folder);
  const ext = mimeToExtension(mimetype) || path.extname(originalname) || (resourceType === 'video' ? '.mp4' : '.jpg');
  const safeBase = path.basename(originalname, path.extname(originalname)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const filename = safeBase ? `${safeBase}-${Date.now()}-${uuid().slice(0, 6)}${ext}` : `${Date.now()}-${uuid().slice(0, 8)}${ext}`;
  const key = `${targetFolder}/${filename}`;

  if (!isEnabled()) {
    // Development fallback simulation
    const simulatedUrl = `https://cloudflare-r2.kulansiiye.com/${key}`;
    return {
      url: simulatedUrl,
      publicId: key,
      key,
      provider: 'cloudflare-r2-simulated',
      resourceType: resourceType === 'auto' ? (mimetype.startsWith('video/') ? 'video' : 'image') : resourceType,
      format: ext.replace(/^\./, ''),
      bytes: buffer.length,
      folder,
      simulated: true,
      note: 'Set CLOUDFLARE_R2_ACCOUNT_ID and credentials in .env from https://dash.cloudflare.com for live R2 storage',
    };
  }

  const s3 = getS3Client();
  const { bucketName } = getConfig();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      folder,
      resourceType,
      uploadedAt: new Date().toISOString(),
      service: 'kulansiiye',
    },
  });

  await s3.send(command);

  const publicUrl = buildPublicUrl(key);
  return {
    url: publicUrl,
    publicId: key,
    key,
    provider: 'cloudflare-r2',
    resourceType: resourceType === 'auto' ? (mimetype.startsWith('video/') ? 'video' : 'image') : resourceType,
    format: ext.replace(/^\./, ''),
    bytes: buffer.length,
    folder,
  };
}

/**
 * Uploads Base64 Data URI to Cloudflare R2 bucket.
 */
async function uploadDataUri(dataUri, options = {}) {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    throw ApiError.badRequest('Expected a data URI (data:image/...;base64,...)');
  }

  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw ApiError.badRequest('Invalid data URI format');
  }

  const mimetype = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  return uploadBuffer(buffer, {
    ...options,
    mimetype,
  });
}

/**
 * Downloads from external URL and stores into Cloudflare R2 bucket.
 */
async function uploadFromUrl(fileUrl, options = {}) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw ApiError.badRequest('fileUrl is required');
  }

  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw ApiError.badRequest(`Failed to fetch remote file from URL: ${res.statusText}`);
  }

  const mimetype = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return uploadBuffer(buffer, {
    ...options,
    mimetype,
  });
}

/**
 * Deletes object from Cloudflare R2 bucket.
 */
async function deleteFile(keyOrUrl) {
  if (!keyOrUrl || !isEnabled()) return false;
  const s3 = getS3Client();
  const { bucketName, publicUrl } = getConfig();

  let key = keyOrUrl;
  if (publicUrl && key.startsWith(publicUrl)) {
    key = key.replace(`${publicUrl}/`, '');
  } else if (key.includes('.r2.cloudflarestorage.com/')) {
    key = key.split('.r2.cloudflarestorage.com/')[1];
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3.send(command);
  return true;
}

module.exports = {
  FOLDERS,
  ALLOWED_FOLDERS,
  ALLOWED_RESOURCE_TYPES,
  isEnabled,
  uploadBuffer,
  uploadDataUri,
  uploadFromUrl,
  deleteFile,
  buildPublicUrl,
  getConfig,
};
