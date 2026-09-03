'use strict';

/**
 * src/routes/category.routes.js
 *
 * Public:
 *   GET /categories        → flat list
 *   GET /categories/tree   → nested tree
 *   GET /categories/:id    → single category
 *
 * Admin only:
 *   POST   /categories       → create
 *   PATCH  /categories/:id   → update
 *   DELETE /categories/:id   → delete
 *
 * IMPORTANT: /tree must be declared BEFORE /:id
 * so Express doesn't match "tree" as an ObjectId parameter.
 */

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const { protect }        = require('../middlewares/auth.middleware');
const { requireRole }    = require('../middlewares/role.middleware');
const { validate }       = require('../middlewares/validate.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/category.validator');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',      categoryController.listCategories);
router.get('/tree',  categoryController.getCategoryTree);  // before /:id !
router.get('/:id',   categoryController.getCategoryById);

// ── Admin Only ────────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  requireRole('admin'),
  validate(createCategorySchema),
  categoryController.createCategory
);

router.patch(
  '/:id',
  protect,
  requireRole('admin'),
  validate(updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  protect,
  requireRole('admin'),
  categoryController.deleteCategory
);

module.exports = router;
