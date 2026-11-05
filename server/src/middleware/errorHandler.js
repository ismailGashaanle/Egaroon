const env = require('../config/env');

function notFound(req, res, next) {
  next(new (require('../utils/ApiError'))(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Mongoose duplicate key — map common keys to actionable messages (not cryptic generic)
  if (err.code === 11000) {
    statusCode = 409;
    const keyValue = err.keyValue || {};
    const keyPattern = err.keyPattern || {};
    const keys = Object.keys(keyPattern).length
      ? Object.keys(keyPattern)
      : Object.keys(keyValue);
    details = Object.keys(keyValue).length ? keyValue : keyPattern;

    if (keys.includes('phone')) {
      message = 'This phone is already registered. Use the visitor captain number.';
      details = {
        code: 'PHONE_EXISTS',
        messageEn: message,
        messageSo: 'Lambarkan waa hore u diiwaangashan — geli telefoonka captain-ka soo galay.',
        ...(typeof details === 'object' ? details : {}),
      };
    } else if (keys.includes('email')) {
      message = 'This email is already registered';
      details = {
        code: 'EMAIL_EXISTS',
        messageEn: message,
        messageSo: 'Iimaylkan waa hore u diiwaangashan.',
        ...(typeof details === 'object' ? details : {}),
      };
    } else if (keys.includes('idempotencyKey')) {
      message = 'This payment was already submitted — refresh and check the booking.';
      details = {
        code: 'PAYMENT_DUP',
        messageEn: message,
        messageSo: 'Lacag-bixintan waa hore loo diray — dib u cusboonaysii oo eeg ballanka.',
        ...(typeof details === 'object' ? details : {}),
      };
    } else if (keys.includes('field') && keys.includes('startTime')) {
      message = 'This slot is already booked';
      details = {
        code: 'SLOT_BOOKED',
        messageEn: message,
        messageSo: 'Slot-kan waa la kiraystay — dooro waqti kale',
        ...(typeof details === 'object' ? details : {}),
      };
    } else if (keys.includes('dedupeKey') || keys.includes('user')) {
      message = 'Already processed';
      details = {
        code: 'ALREADY_EXISTS',
        messageEn: 'This action was already completed',
        messageSo: 'Hore ayaa loo sameeyay',
        ...(typeof details === 'object' ? details : {}),
      };
    } else {
      message = 'Resource already exists';
    }
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier: ${err.value}`;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  // bcryptjs: compare(password, undefined) → "Illegal arguments: string, undefined"
  if (
    typeof message === 'string' &&
    message.startsWith('Illegal arguments:')
  ) {
    statusCode = 401;
    message = 'Invalid email or password';
    details = {
      code: 'AUTH_COMPARE_FAILED',
      messageEn: 'Invalid email or password',
      messageSo: 'Email ama password waa khalad',
    };
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };
