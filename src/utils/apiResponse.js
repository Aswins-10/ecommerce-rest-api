/**
 * apiResponse — Standardised response helpers.
 *
 * Every endpoint must return the same consistent JSON envelope so that
 * consumers always know what to expect, regardless of the operation.
 *
 * Success envelope:
 *   { success: true, message: "...", data: { ... } }
 *
 * Paginated envelope:
 *   { success: true, message: "...", data: [...], pagination: { page, limit, total, pages } }
 *
 * Error envelope (produced by errorHandler middleware, not here):
 *   { success: false, message: "...", errors: [...] }
 */

/**
 * Send a standard success response.
 *
 * @param {import('express').Response} res
 * @param {number} statusCode   - HTTP status code (200, 201, etc.)
 * @param {string} message      - Human-readable success message
 * @param {*}      [data]       - Payload to include under "data" key
 */
const sendSuccess = (res, statusCode, message, data = null) => {
  const body = { success: true, message };
  if (data !== null && data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
};

/**
 * Send a paginated list response.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {Array}  data          - The page of results
 * @param {object} pagination    - { page, limit, total }
 */
const sendPaginated = (res, message, data, { page, limit, total }) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

module.exports = { sendSuccess, sendPaginated };
