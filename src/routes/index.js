'use strict';

/**
 * src/routes/index.js
 *
 * Master router — mounts all feature routers under their prefix.
 * app.js imports this single file and mounts it at /api/v1.
 *
 * Adding a new feature:
 *   1. Create its route file in this folder
 *   2. require() it here
 *   3. router.use('/prefix', featureRouter)
 */

const express = require('express');
const router = express.Router();

// ─── Feature Routers ──────────────────────────────────────────────────────────
const authRoutes     = require('./auth.routes');
const userRoutes     = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes  = require('./product.routes');
const orderRoutes    = require('./order.routes');

router.use('/auth',       authRoutes);
router.use('/users',      userRoutes);
router.use('/categories', categoryRoutes);
router.use('/products',   productRoutes);
router.use('/orders',     orderRoutes);

module.exports = router;
