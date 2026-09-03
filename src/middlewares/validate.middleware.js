'use strict';

/**
 * src/middlewares/validate.middleware.js
 *
 * Generic Joi validation middleware factory.
 *
 * Usage:
 *   const { registerSchema } = require('../validators/auth.validator');
 *   router.post('/register', validate(registerSchema), authController.register);
 *
 * On failure: returns 422 Unprocessable Entity with an array of field-level errors.
 * On success: replaces req.body with the validated (and stripped) value, then calls next().
 *
 * Why 422 and not 400?
 *   400 = the request itself was malformed (bad JSON, wrong Content-Type).
 *   422 = the request was well-formed but the contained data failed validation rules.
 */

const AppError = require('../utils/AppError');

/**
 * @param {import('joi').ObjectSchema} schema - A Joi schema to validate req.body against
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = value;
  next();
};

/**
 * Validate req.query against a Joi schema.
 * On success, replaces req.query with validated + defaulted values.
 *
 * @param {import('joi').ObjectSchema} schema
 * @returns {import('express').RequestHandler}
 */
const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true, // coerce "20" → 20 for number types
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));

    return res.status(422).json({
      success: false,
      message: 'Invalid query parameters',
      errors,
    });
  }

  // Express 5: req.query is read-only — use Object.assign to merge validated values
  Object.assign(req.query, value);
  next();
};

module.exports = { validate, validateQuery };

