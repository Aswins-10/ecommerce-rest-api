'use strict';

/**
 * src/middlewares/auth.middleware.js
 *
 * Verifies the Bearer JWT on every protected route.
 *
 * Flow:
 *   1. Extract token from Authorization: Bearer <token> header
 *   2. Verify and decode the token
 *   3. Load the user from DB (ensures user still exists + checks isActive)
 *   4. Attach user to req.user for downstream middleware/controllers
 *
 * Why reload from DB on every request?
 *   - If an admin deactivates a user, their existing token must be rejected
 *     immediately — not when the token expires days later.
 *   - If a user is deleted, their token must also be rejected.
 *   - The DB hit is minimal (indexed _id lookup, no password selected).
 */

const { verifyToken } = require('../utils/jwt');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  // ── 1. Extract token ────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Please log in.', 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new AppError('Authentication required. Please log in.', 401);
  }

  // ── 2. Verify token ─────────────────────────────────────────────────────────
  // verifyToken throws JsonWebTokenError or TokenExpiredError on failure —
  // those are caught by asyncHandler and forwarded to the error handler,
  // which are mapped to 401 responses by the global error handler.
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    // Map all JWT errors to a clean 401 right here
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Your session has expired. Please log in again.', 401);
    }
    throw new AppError('Invalid token. Please log in again.', 401);
  }

  // ── 3. Load user from DB ────────────────────────────────────────────────────
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError('The user belonging to this token no longer exists.', 401);
  }

  // ── 4. Check account is still active ────────────────────────────────────────
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 401);
  }

  // ── 5. Attach user and proceed ──────────────────────────────────────────────
  req.user = user;
  next();
});

module.exports = { protect };
