'use strict';

/**
 * src/services/auth.service.js
 *
 * Business logic for authentication.
 * Controllers call these functions and only handle req/res.
 *
 * Responsibilities:
 *   - register: create user, return token
 *   - login: verify credentials, return token
 *
 * Security notes:
 *   - Duplicate email → 409 Conflict (not 500)
 *   - Invalid credentials → 401 with a generic message
 *     (we do NOT reveal whether the email exists or not)
 *   - Inactive account → 401 with a specific message
 */

const User = require('../models/user.model');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Build the token payload and assemble the response object.
 * Kept as a helper to avoid duplication between register and login.
 *
 * @param {import('../models/user.model').User} user
 * @returns {{ token: string, user: object }}
 */
const createTokenResponse = (user) => {
  const token = signToken({ id: user._id, role: user.role });

  // user.toJSON() already strips password and __v (see model transform)
  return { token, user };
};

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Create a new customer account.
 *
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 * @throws {AppError} 409 if email is already registered
 */
const register = async ({ name, email, password }) => {
  // Check for existing account with this email
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  // Create the user — password hashing happens in the pre-save hook
  const user = await User.create({ name, email, password });

  return createTokenResponse(user);
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user with email + password.
 *
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 * @throws {AppError} 401 on invalid credentials or inactive account
 */
const login = async ({ email, password }) => {
  // Explicitly select password (excluded by default via select:false)
  const user = await User.findOne({ email }).select('+password');

  // Generic error: do not reveal whether the email exists
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  // Separate check so we can give a more actionable message
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 401);
  }

  return createTokenResponse(user);
};

module.exports = { register, login };
