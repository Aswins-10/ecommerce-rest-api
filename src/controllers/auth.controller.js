'use strict';

/**
 * src/controllers/auth.controller.js
 *
 * Thin controllers — extract from req, call service, send response.
 * Zero business logic here.
 */

const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

// POST /api/v1/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });

  sendSuccess(res, 201, 'Account created successfully', result);
});

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });

  sendSuccess(res, 200, 'Login successful', result);
});

module.exports = { register, login };
