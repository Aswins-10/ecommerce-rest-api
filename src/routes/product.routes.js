'use strict';

/**
 * src/routes/product.routes.js
 *
 * Public:
 *   GET /products        → list with search/filter/sort/pagination
 *   GET /products/:id    → single product detail
 *
 * Admin only:
 *   POST   /products       → create
 *   PATCH  /products/:id   → update
 *   DELETE /products/:id   → soft-delete (archive)
 *
 * Note on GET routes:
 *   - They are publicly accessible (no `protect` required).
 *   - We use `optionalProtect` — if a valid token IS present, req.user is set
 *     so the controller can return admin-visible products (inactive/archived).
 *   - Without a token, req.user is undefined and only 'active' products are shown.
 */

const express = require('express');
const router  = express.Router();

const productController = require('../controllers/product.controller');
const { protect }       = require('../middlewares/auth.middleware');
const { requireRole }   = require('../middlewares/role.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} = require('../validators/product.validator');

// ── Optional auth middleware ──────────────────────────────────────────────────
// Attempts to verify a token if present; does NOT reject missing tokens.
// This lets public GET routes optionally receive admin context.
const optionalProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  // Reuse protect but catch errors — on failure, just proceed as unauthenticated
  const { verifyToken } = require('../utils/jwt');
  const User = require('../models/user.model');

  try {
    const token   = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user    = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // Silently ignore — treat as unauthenticated
  }
  next();
};

// ── Public (with optional auth for admin visibility) ─────────────────────────
router.get(
  '/',
  optionalProtect,
  validateQuery(listProductsSchema),
  productController.listProducts
);

router.get(
  '/:id',
  optionalProtect,
  productController.getProductById
);

// ── Admin Only ────────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  requireRole('admin'),
  validate(createProductSchema),
  productController.createProduct
);

router.patch(
  '/:id',
  protect,
  requireRole('admin'),
  validate(updateProductSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  protect,
  requireRole('admin'),
  productController.deleteProduct
);

module.exports = router;
