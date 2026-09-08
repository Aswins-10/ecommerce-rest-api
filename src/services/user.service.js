'use strict';

/**
 * src/services/user.service.js
 *
 * Business logic for user management.
 *
 * Endpoints served:
 *   GET    /users/me             → getProfile
 *   GET    /users                → listUsers      (admin)
 *   GET    /users/:id            → getUserById    (admin)
 *   PATCH  /users/:id/activate   → activateUser   (admin)
 *   PATCH  /users/:id/deactivate → deactivateUser (admin)
 */

const User = require('../models/user.model');
const AppError = require('../utils/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a user by ID or throw 404.
 * @param {string} id
 * @returns {Promise<import('../models/user.model')>}
 */
const findUserOrFail = async (id) => {
  // Mongoose will throw a CastError for invalid ObjectId format —
  // the global error handler maps that to 400.
  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

// ─── Get Own Profile ──────────────────────────────────────────────────────────

/**
 * Return the currently authenticated user's profile.
 * req.user is already the loaded document (set by protect middleware).
 *
 * @param {import('../models/user.model')} currentUser
 * @returns {object} User document (serialised via toJSON transform)
 */
const getProfile = (currentUser) => {
  // req.user is already loaded — no extra DB call needed
  return currentUser;
};

// ─── List Users (Admin) ───────────────────────────────────────────────────────

/**
 * Return a paginated list of all users.
 *
 * @param {{ page?: string, limit?: string, role?: string, isActive?: string }} query
 * @returns {Promise<{ users: object[], total: number, page: number, limit: number }>}
 */
const listUsers = async ({ page = 1, limit = 20, role, isActive } = {}) => {
  const pageNum  = Math.max(1, parseInt(page,  10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // Build optional filters
  const filter = {};
  if (role)     filter.role     = role;
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true' || isActive === true;
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    User.countDocuments(filter),
  ]);

  return { users, total, page: pageNum, limit: limitNum };
};

// ─── Get User By ID (Admin) ───────────────────────────────────────────────────

/**
 * @param {string} id
 * @returns {Promise<object>}
 */
const getUserById = async (id) => {
  return findUserOrFail(id);
};

// ─── Activate User (Admin) ────────────────────────────────────────────────────

/**
 * @param {string} id
 * @returns {Promise<object>} Updated user
 */
const activateUser = async (id) => {
  const user = await findUserOrFail(id);

  if (user.isActive) {
    throw new AppError('User is already active', 400);
  }

  user.isActive = true;
  await user.save();
  return user;
};

// ─── Deactivate User (Admin) ──────────────────────────────────────────────────

/**
 * @param {string} id
 * @param {string} currentUserId - Prevent admin from deactivating themselves
 * @returns {Promise<object>} Updated user
 */
const deactivateUser = async (id, currentUserId) => {
  const user = await findUserOrFail(id);

  // Safety guard: prevent an admin from locking themselves out
  if (user._id.toString() === currentUserId.toString()) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  if (!user.isActive) {
    throw new AppError('User is already inactive', 400);
  }

  user.isActive = false;
  await user.save();
  return user;
};

module.exports = {
  getProfile,
  listUsers,
  getUserById,
  activateUser,
  deactivateUser,
};
