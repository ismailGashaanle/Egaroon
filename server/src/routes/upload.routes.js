const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/upload.controller');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many uploads, please try again later' } },
});

router.use(requireAuth, uploadLimiter);

router.get('/status', ctrl.status);

router.post('/', ctrl.uploadSingle, ctrl.uploadFile);

router.post(
  '/base64',
  [
    body('dataUri').isString().isLength({ min: 32, max: 15_000_000 }),
    body('folder').optional().isString(),
    body('resourceType').optional().isIn(['image', 'video', 'raw', 'auto']),
  ],
  validate,
  ctrl.uploadBase64
);

router.post(
  '/url',
  [
    body('fileUrl').isURL({ require_protocol: true }),
    body('folder').optional().isString(),
    body('resourceType').optional().isIn(['image', 'video', 'raw', 'auto']),
  ],
  validate,
  ctrl.uploadUrl
);

module.exports = router;
