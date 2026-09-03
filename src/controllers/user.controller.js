'use strict';

/**
 * src/controllers/user.controller.js
 *
 * Thin controllers — extract from req, delegate to service, send response.
 */

const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

// GET /api/v1/users/me
const getProfile = asyncHandler(async (req, res) => {
  const user = userService.getProfile(req.user);
  sendSuccess(res, 200, 'Profile retrieved successfully', user);
});

// GET /api/v1/users
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, role, isActive } = req.query;
  const result = await userService.listUsers({ page, limit, role, isActive });

  sendPaginated(res, 'Users retrieved successfully', result.users, {
    page:  result.page,
    limit: result.limit,
    total: result.total,
  });
});

// GET /api/v1/users/:id
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, 200, 'User retrieved successfully', user);
});

// PATCH /api/v1/users/:id/activate
const activateUser = asyncHandler(async (req, res) => {
  const user = await userService.activateUser(req.params.id);
  sendSuccess(res, 200, 'User activated successfully', user);
});

// PATCH /api/v1/users/:id/deactivate
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, req.user._id);
  sendSuccess(res, 200, 'User deactivated successfully', user);
});

module.exports = {
  getProfile,
  listUsers,
  getUserById,
  activateUser,
  deactivateUser,
};
