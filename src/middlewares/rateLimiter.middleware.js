'use strict';

/**
 * src/middlewares/rateLimiter.middleware.js
 *
 * Rate limiting configurations using express-rate-limit.
 */

const rateLimit = require('express-rate-limit');
const AppError  = require('../utils/AppError');

/**
 * Standard API rate limiter.
 * Allows 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(new AppError('Too many requests from this IP, please try again in 15 minutes', 429));
  },
});

/**
 * Strict rate limiter for authentication routes.
 * Prevents credential stuffing / brute force attacks.
 * Allows 15 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new AppError('Too many authentication attempts, please try again in 15 minutes', 429));
  },
});

module.exports = { apiLimiter, authLimiter };
