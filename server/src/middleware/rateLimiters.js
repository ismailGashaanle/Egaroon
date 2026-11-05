const rateLimit = require('express-rate-limit');

// Auth endpoints (login/register) get much stricter limits than general reads,
// since they are the most common brute-force / credential-stuffing target.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts, please try again later' } },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please slow down' } },
});

/** Payment initiate / mock-confirm — tighter than general API. */
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many payment attempts, please wait' } },
});

/**
 * OTP send / forgot-password — stricter than login to limit SMS cost & brute force.
 * Complements per-target limits inside otp.service.
 */
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many OTP requests from this IP, please try again later' },
  },
});

/** Slot demand / competing Book attempts — per IP. */
const demandLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many book attempts for this slot — wait a moment' } },
});

/** Match Code preview/join — tighter; complements per-user fail lockout in service. */
const matchJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many Match Code attempts — try again later' },
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
  paymentLimiter,
  otpSendLimiter,
  demandLimiter,
  matchJoinLimiter,
};
