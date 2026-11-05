const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authLimiter, otpSendLimiter } = require('../middleware/rateLimiters');
const { requireAuth } = require('../middleware/auth');
const requireCaptcha = require('../middleware/captcha');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

/** Public feature flags — clients hide OTP / owner-signup / Google from this. */
router.get('/features', ctrl.getFeatures);

router.get('/oauth/google', authLimiter, ctrl.startGoogleOAuth);
router.get('/oauth/google/callback', ctrl.googleOAuthCallback);
router.post(
  '/oauth/exchange',
  authLimiter,
  [body('code').trim().isLength({ min: 16, max: 80 }).withMessage('OAuth code is required')],
  validate,
  ctrl.exchangeOAuthCode
);

router.post(
  '/otp/send',
  authLimiter,
  otpSendLimiter,
  requireCaptcha('otp'),
  [
    body('channel').isIn(['email', 'phone']),
    body('target').notEmpty(),
    body('purpose').isIn(['register', 'reset']),
  ],
  validate,
  ctrl.sendOtp
);

router.post(
  '/otp/verify',
  authLimiter,
  [
    body('channel').isIn(['email', 'phone']),
    body('target').notEmpty(),
    body('purpose').isIn(['register', 'reset']),
    body('code').isLength({ min: 4, max: 8 }),
  ],
  validate,
  ctrl.verifyOtp
);

router.post(
  '/register',
  authLimiter,
  requireCaptcha('register'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    // OTP codes enforced in controller when OTP_ENABLED=true
    body('emailOtp').optional({ values: 'falsy' }),
    body('phoneOtp').optional({ values: 'falsy' }),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  authLimiter,
  requireCaptcha('login'),
  [
    body('email')
      .optional({ values: 'falsy' })
      .trim(),
    body('phone')
      .optional({ values: 'falsy' })
      .trim(),
    body('password').notEmpty().withMessage('Password is required'),
    body().custom((_, { req }) => {
      const email = String(req.body.email || '').trim();
      const phone = String(req.body.phone || '').trim();
      if (!email && !phone) {
        throw new Error('Email or phone is required');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !phone) {
        // Allow phone typed into the email field (mobile often has one input).
        if (!/^\+?\d[\d\s-]{6,}$/.test(email)) {
          throw new Error('Valid email or phone is required');
        }
      }
      return true;
    }),
  ],
  validate,
  ctrl.login
);

// Demo second step (only answers when DEMO_2FA_CODE is set on the server).
router.post(
  '/login/2fa',
  authLimiter,
  [body('challenge').isString().notEmpty(), body('code').isString().notEmpty()],
  validate,
  ctrl.verifyLoginCode
);

router.post(
  '/password/forgot',
  authLimiter,
  otpSendLimiter,
  requireCaptcha('forgot'),
  [body('channel').isIn(['email', 'phone']), body('target').notEmpty()],
  validate,
  ctrl.forgotPassword
);

router.post(
  '/password/reset',
  authLimiter,
  [
    body('channel').isIn(['email', 'phone']),
    body('target').notEmpty(),
    // Code required only when OTP_ENABLED=true (enforced in controller)
    body('code').optional({ values: 'falsy' }),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  ctrl.resetPassword
);

router.post(
  '/password/change',
  requireAuth,
  authLimiter,
  [
    body('currentPassword').optional({ values: 'falsy' }),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  ctrl.changePassword
);

router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('avatarUrl').optional({ nullable: true }).isString().isLength({ max: 2048 }),
    body('city').optional().trim().isLength({ max: 80 }),
    body('region').optional().trim().isLength({ max: 80 }),
    body('area').optional().trim().isLength({ max: 80 }),
  ],
  validate,
  ctrl.updateMe
);
router.get('/contacts', ctrl.getContacts);

module.exports = router;
