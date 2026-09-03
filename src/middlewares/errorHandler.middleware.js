'use strict';

/**
 * src/middlewares/errorHandler.middleware.js
 *
 * Centralized Error Handling Middleware.
 *
 * Captures all operational and programming errors from controllers/services,
 * normalizes specific database/JWT/parsing errors into appropriate HTTP responses,
 * and maintains a consistent response envelope.
 */

const AppError = require('../utils/AppError');

/**
 * Handles Mongoose CastError (e.g. malformed ObjectId).
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handles MongoDB duplicate key errors (code 11000).
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : '';
  const message = `Duplicate value '${value}' for field '${field}'. Please use another value.`;
  return new AppError(message, 409);
};

/**
 * Handles Mongoose schema validation errors.
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message,
  }));
  const error = new AppError('Validation failed', 422);
  error.errors = errors;
  return error;
};

/**
 * Handles JWT malformed/invalid errors.
 */
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

/**
 * Handles JWT expired errors.
 */
const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

/**
 * Handles malformed JSON body errors from express.json().
 */
const handleSyntaxError = (err) => {
  if (err.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON payload provided in request body', 400);
  }
  return err;
};

/**
 * Error formatting in development environment.
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    ...(err.errors && { errors: err.errors }),
    stack: err.stack,
  });
};

/**
 * Error formatting in production environment.
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or unknown error: don't leak details to client
    console.error('💥 UNEXPECTED ERROR:', err);

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong on our end. Please try again later.',
    });
  }
};

/**
 * Main global error handling middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Normalize known third-party and parser errors
  let error = err;

  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (error instanceof SyntaxError && 'body' in error) error = handleSyntaxError(error);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
