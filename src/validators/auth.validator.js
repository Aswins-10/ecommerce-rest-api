'use strict';

/**
 * src/validators/auth.validator.js
 *
 * Joi schemas for authentication endpoints.
 *
 * Rules:
 *   - abortEarly: false  → collect ALL validation errors, not just the first.
 *   - stripUnknown: true → silently drop any extra fields the client sends.
 *     This prevents mass-assignment of fields like `role` or `isActive`.
 */

const Joi = require('joi');

// ─── Register ─────────────────────────────────────────────────────────────────
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must be at most 100 characters',
    'any.required': 'Name is required',
  }),

  email: Joi.string().trim().lowercase().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),

  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
});

// ─── Login ────────────────────────────────────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),

  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

module.exports = { registerSchema, loginSchema };
