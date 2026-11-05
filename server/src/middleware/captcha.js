const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const captcha = require('../services/captcha.service');

/**
 * Require a valid Cloudflare Turnstile token for this request (body.captchaToken or the
 * `x-captcha-token` header). Does nothing until TURNSTILE_SECRET_KEY + TURNSTILE_SITE_KEY are set.
 *
 * `action` is bound to the widget that produced the token, so a token solved on the login form
 * can't be replayed against registration.
 */
module.exports = function requireCaptcha(action) {
  return asyncHandler(async (req, _res, next) => {
    if (!captcha.isEnabled()) return next();

    const token = req.body?.captchaToken || req.get('x-captcha-token');
    if (req.body && 'captchaToken' in req.body) delete req.body.captchaToken; // never reaches handlers
    if (!token || typeof token !== 'string') {
      throw ApiError.badRequest('Please complete the security check and try again.', { code: 'CAPTCHA_REQUIRED' });
    }

    let result;
    try {
      result = await captcha.verifyToken(token, req.ip);
    } catch (err) {
      console.error('[captcha] could not reach Turnstile:', err.message);
      throw ApiError.badRequest('The security check is temporarily unavailable. Please try again in a moment.', {
        code: 'CAPTCHA_UNAVAILABLE',
      });
    }

    if (!result.ok || (result.action && action && result.action !== action)) {
      throw ApiError.badRequest('The security check failed. Please refresh the page and try again.', {
        code: 'CAPTCHA_FAILED',
        reason: result.ok ? 'action_mismatch' : result.reason,
      });
    }
    next();
  });
};
