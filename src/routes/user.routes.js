'use strict';

/**
 * src/routes/user.routes.js
 *
 * User management routes.
 *
 * Route structure:
 *   GET  /users/me               → any authenticated user (own profile)
 *   GET  /users                  → admin only
 *   GET  /users/:id              → admin only
 *   PATCH /users/:id/activate    → admin only
 *   PATCH /users/:id/deactivate  → admin only
 *
 * Middleware stack per route:
 *   protect       → verifies JWT, attaches req.user
 *   requireRole   → checks req.user.role
 *   validateQuery → (list route) validates pagination params
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validateQuery } = require('../middlewares/validate.middleware');
const { listUsersSchema } = require('../validators/user.validator');

// ── Customer + Admin ──────────────────────────────────────────────────────────

// GET /api/v1/users/me  — IMPORTANT: must be declared BEFORE /:id
// so Express doesn't try to match "me" as a MongoDB ObjectId
router.get('/me', protect, userController.getProfile);

// ── Admin Only ────────────────────────────────────────────────────────────────

router.get(
  '/',
  protect,
  requireRole('admin'),
  validateQuery(listUsersSchema),
  userController.listUsers
);

router.get(
  '/:id',
  protect,
  requireRole('admin'),
  userController.getUserById
);

router.patch(
  '/:id/activate',
  protect,
  requireRole('admin'),
  userController.activateUser
);

router.patch(
  '/:id/deactivate',
  protect,
  requireRole('admin'),
  userController.deactivateUser
);

module.exports = router;
