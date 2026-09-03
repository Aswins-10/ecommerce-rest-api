'use strict';

/**
 * src/middlewares/role.middleware.js
 *
 * Role-based authorization middleware factory.
 *
 * Usage:
 *   router.get('/admin/users', protect, requireRole('admin'), controller.listUsers);
 *   router.get('/profile',     protect, requireRole('admin', 'customer'), controller.me);
 *
 * MUST be used AFTER protect — it depends on req.user being set.
 *
 * Returns 403 Forbidden (not 404) so the caller knows the resource exists
 * but they are not authorised to access it.
 */

const AppError = require('../utils/AppError');

/**
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'customer')
 * @returns {import('express').RequestHandler}
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new AppError(
      `Access denied. This action requires one of the following roles: ${roles.join(', ')}`,
      403
    );
  }
  next();
};

module.exports = { requireRole };
