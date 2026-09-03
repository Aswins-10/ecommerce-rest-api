/**
 * AppError — Custom operational error class.
 *
 * Extend the native Error so we can attach an HTTP statusCode and a flag
 * that distinguishes operational errors (expected: wrong input, not found,
 * unauthorised) from programming errors (unexpected bugs).
 *
 * Usage:
 *   throw new AppError('Resource not found', 404);
 *   throw new AppError('Validation failed', 422);
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable error message sent to the client.
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 422, 409 …).
   */
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;

    // 4xx = client error (operational), 5xx = server error
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Marks this as an operational error — the global error handler
    // will send a response; unhandled errors that are NOT operational
    // will be treated as programming bugs.
    this.isOperational = true;

    // Capture stack trace without this constructor cluttering it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
