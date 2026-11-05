const multer = require('multer');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const storageService = require('../services/storage.service');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/pdf';
    if (!ok) {
      cb(ApiError.badRequest('Only images, videos, and PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const uploadSingle = memoryUpload.single('file');

function parseFolder(req) {
  return req.body?.folder || req.query?.folder || 'misc';
}

function parseResourceType(req, mimetype) {
  const explicit = req.body?.resourceType || req.query?.resourceType;
  if (explicit) return explicit;
  if (mimetype?.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'raw';
  return 'image';
}

function assertSize(file, resourceType) {
  const limit = resourceType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    throw ApiError.badRequest(
      `File too large. Max ${resourceType === 'video' ? '80MB' : '10MB'} for ${resourceType}.`
    );
  }
}

const status = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, storageService.getStatus());
});

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('file is required (multipart field name: file)');

  const folder = parseFolder(req);
  if (!storageService.ALLOWED_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(`Invalid folder. Allowed: ${storageService.ALLOWED_FOLDERS.join(', ')}`);
  }

  const resourceType = parseResourceType(req, req.file.mimetype);
  assertSize(req.file, resourceType);

  const uploaded = await storageService.uploadBuffer(req.file.buffer, {
    folder,
    resourceType,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
    tags: [req.user?.id ? `user:${req.user.id}` : null].filter(Boolean),
  });

  sendSuccess(res, 201, { upload: uploaded });
});

const uploadBase64 = asyncHandler(async (req, res) => {
  const { dataUri, folder = 'misc', resourceType = 'image', publicId } = req.body || {};
  if (!storageService.ALLOWED_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(`Invalid folder. Allowed: ${storageService.ALLOWED_FOLDERS.join(', ')}`);
  }
  const uploaded = await storageService.uploadDataUri(dataUri, {
    folder,
    resourceType,
    publicId,
    tags: [req.user?.id ? `user:${req.user.id}` : null].filter(Boolean),
  });
  sendSuccess(res, 201, { upload: uploaded });
});

const uploadUrl = asyncHandler(async (req, res) => {
  const { fileUrl, folder = 'misc', resourceType = 'auto', publicId } = req.body || {};
  if (!storageService.ALLOWED_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(`Invalid folder. Allowed: ${storageService.ALLOWED_FOLDERS.join(', ')}`);
  }
  const uploaded = await storageService.uploadFromUrl(fileUrl, {
    folder,
    resourceType,
    publicId,
    tags: [req.user?.id ? `user:${req.user.id}` : null].filter(Boolean),
  });
  sendSuccess(res, 201, { upload: uploaded });
});

module.exports = {
  uploadSingle,
  status,
  uploadFile,
  uploadBase64,
  uploadUrl,
};
