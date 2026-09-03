'use strict';

/**
 * src/validators/user.validator.js
 *
 * Validation schemas for user management query parameters.
 * Body validation isn't needed for activate/deactivate (no body expected).
 */

const Joi = require('joi');

// Schema for GET /users query parameters
const listUsersSchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  role:     Joi.string().valid('admin', 'customer').optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = { listUsersSchema };
