'use strict';

/**
 * src/validators/category.validator.js
 */

const Joi = require('joi');

// Reusable ObjectId pattern
const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ID');

// ─── Create Category ──────────────────────────────────────────────────────────
const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Category name must be at least 2 characters',
    'string.max': 'Category name must be at most 100 characters',
    'any.required': 'Category name is required',
  }),

  description: Joi.string().trim().max(500).allow('').optional(),

  // Parent is optional — omit or null for a root category
  parent: objectId.allow(null).optional(),
});

// ─── Update Category ──────────────────────────────────────────────────────────
const updateCategorySchema = Joi.object({
  name:        Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  parent:      objectId.allow(null).optional(),
}).min(1).message('At least one field must be provided for update');

module.exports = { createCategorySchema, updateCategorySchema };
