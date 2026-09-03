'use strict';

/**
 * src/config/env.js
 *
 * Centralised environment variable validation and export.
 *
 * Purpose:
 *   - Validate required env vars at startup — fail fast if anything is missing.
 *   - Export named constants so the rest of the app never reads process.env directly.
 *   - Makes env dependencies explicit and easy to audit.
 *
 * NOTE: dotenv must have been called (in server.js) before this module is required.
 */

require('dotenv').config();

const required = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n❌ Missing required environment variables:\n   ${missing.join('\n   ')}\n\n` +
    `   Copy .env.example → .env and fill in the values.\n`
  );
  process.exit(1);
}

module.exports = {
  NODE_ENV:      process.env.NODE_ENV || 'development',
  PORT:          parseInt(process.env.PORT, 10) || 3000,
  MONGODB_URI:   process.env.MONGODB_URI,
  JWT_SECRET:    process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
