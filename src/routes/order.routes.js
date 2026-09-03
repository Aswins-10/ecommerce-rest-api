'use strict';

/**
 * src/routes/order.routes.js
 *
 * Customer routes:
 *   POST /orders        → place a new order
 *   GET  /orders        → list my orders (paginated)
 *   GET  /orders/:id    → view single order detail (ownership enforced)
 *
 * Admin routes:
 *   GET   /orders/admin           → list all orders (paginated)
 *   GET   /orders/admin/:id       → get any order detail
 *   PATCH /orders/admin/:id/status → update order status
 *
 * IMPORTANT: /admin routes must be declared BEFORE /:id to prevent
 * route collision with Express param parsing.
 */

const express = require('express');
const router  = express.Router();

const orderController = require('../controllers/order.controller');
const { protect }     = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const {
  placeOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
} = require('../validators/order.validator');

// ── Admin Routes (Must precede /:id) ──────────────────────────────────────────
router.get(
  '/admin',
  protect,
  requireRole('admin'),
  validateQuery(listOrdersSchema),
  orderController.listAllOrders
);

router.get(
  '/admin/:id',
  protect,
  requireRole('admin'),
  orderController.getOrderById
);

router.patch(
  '/admin/:id/status',
  protect,
  requireRole('admin'),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

// ── Customer Routes ───────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  requireRole('customer', 'admin'),
  validate(placeOrderSchema),
  orderController.placeOrder
);

router.get(
  '/',
  protect,
  validateQuery(listOrdersSchema),
  orderController.getMyOrders
);

router.get(
  '/:id',
  protect,
  orderController.getMyOrderById
);

module.exports = router;
