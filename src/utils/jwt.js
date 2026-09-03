'use strict';

/**
 * src/utils/jwt.js
 *
 * Thin wrappers around jsonwebtoken so the rest of the app never
 * imports jsonwebtoken directly. All JWT config lives here.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

/**
 * Sign a JWT containing the given payload.
 *
 * @param {object} payload  - Data to encode (e.g. { id, role })
 * @returns {string}        - Signed JWT string
 */
const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify and decode a JWT. Throws a JsonWebTokenError if invalid/expired.
 *
 * @param {string} token  - Raw JWT string
 * @returns {object}      - Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { signToken, verifyToken };
