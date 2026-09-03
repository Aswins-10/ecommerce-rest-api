'use strict';

/**
 * src/services/order.service.js
 *
 * Business logic for order management.
 *
 * ── Architecture & Security Decisions ─────────────────────────────────────────
 *
 * 1. Price Integrity:
 *    - Client provides ONLY product ID and quantity.
 *    - Prices are fetched directly from MongoDB (salePrice ?? price).
 *    - Subtotals and total are calculated on the backend.
 *    - Snapshot of name, sku, price is recorded in order document.
 *
 * 2. Concurrency & Atomic Stock Management:
 *    - Uses MongoDB Atlas replica set transactions (`mongoose.startSession`).
 *    - Decrements stock atomically using `findOneAndUpdate` with condition
 *      `{ _id: productId, status: 'active', stock: { $gte: quantity } }`
 *      and `$inc: { stock: -quantity }`.
 *    - If stock is insufficient or product inactive, transaction aborts cleanly.
 *
 * 3. Status Transition Rules:
 *    - pending   → confirmed, cancelled
 *    - confirmed → processing, cancelled
 *    - processing → shipped, cancelled
 *    - shipped   → delivered
 *    - delivered → (terminal)
 *    - cancelled → (terminal)
 *    - When an order is cancelled, reserved stock is restored to products.
 */

const mongoose = require('mongoose');
const Order    = require('../models/order.model');
const Product  = require('../models/product.model');
const AppError = require('../utils/AppError');

// ─── Status Transition Graph ──────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
  delivered:  [],
  cancelled:  [],
};

// ─── Place Order (Customer) ───────────────────────────────────────────────────

/**
 * Place a new order with atomic stock decrement inside a MongoDB transaction.
 *
 * @param {string} userId
 * @param {{ product: string, quantity: number }[]} items
 * @returns {Promise<object>} Created order
 */
const placeOrder = async (userId, items) => {
  // Aggregate duplicates if client passes same product twice in one request
  const itemMap = new Map();
  for (const item of items) {
    const pId = item.product.toString();
    const qty = Number(item.quantity);
    itemMap.set(pId, (itemMap.get(pId) || 0) + qty);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderItems = [];
    let orderTotal = 0;

    for (const [productId, quantity] of itemMap.entries()) {
      // 1. Fetch product first to get details and verify status
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new AppError(`Product not found with ID: ${productId}`, 404);
      }

      if (product.status !== 'active') {
        throw new AppError(`Product "${product.name}" is currently unavailable`, 400);
      }

      // 2. Atomic stock decrement: ensure stock >= quantity at the moment of update
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          status: 'active',
          stock: { $gte: quantity },
        },
        {
          $inc: { stock: -quantity },
        },
        {
          session,
          returnDocument: 'after',
        }
      );

      if (!updatedProduct) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}`,
          400
        );
      }

      // 3. Determine effective price from DB (never trusted from client)
      const effectivePrice =
        product.salePrice !== null && product.salePrice !== undefined
          ? product.salePrice
          : product.price;

      const subtotal = effectivePrice * quantity;
      orderTotal += subtotal;

      // 4. Create snapshot for order item
      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        price: effectivePrice,
        quantity,
        subtotal,
      });
    }

    // 5. Create Order document inside transaction
    const [order] = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          total: orderTotal,
          status: 'pending',
          statusHistory: [
            {
              status: 'pending',
              changedBy: userId,
              changedAt: new Date(),
            },
          ],
        },
      ],
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    return order;
  } catch (error) {
    // Abort transaction and restore any changed state
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ─── Customer: My Orders ──────────────────────────────────────────────────────

/**
 * List orders belonging to the authenticated customer.
 *
 * @param {string} userId
 * @param {{ page?: number, limit?: number, status?: string }} query
 */
const listMyOrders = async (userId, query = {}) => {
  const { page = 1, limit = 20, status } = query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const filter = { user: userId };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, total, page: pageNum, limit: limitNum };
};

/**
 * Get single order detail for authenticated customer (enforces ownership).
 *
 * @param {string} orderId
 * @param {string} userId
 */
const getMyOrderById = async (orderId, userId) => {
  const order = await Order.findById(orderId).lean();

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Enforce ownership: customer cannot view another user's order
  if (order.user.toString() !== userId.toString()) {
    throw new AppError('Order not found', 404); // Return 404 to avoid leaking existence
  }

  return order;
};

// ─── Admin: All Orders ────────────────────────────────────────────────────────

/**
 * List all orders across all customers (admin only).
 *
 * @param {{ page?: number, limit?: number, status?: string }} query
 */
const listAllOrders = async (query = {}) => {
  const { page = 1, limit = 20, status } = query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, total, page: pageNum, limit: limitNum };
};

/**
 * Get single order detail (admin only).
 *
 * @param {string} orderId
 */
const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .lean();

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return order;
};

// ─── Admin: Update Order Status ───────────────────────────────────────────────

/**
 * Update order status with validation and stock restoration on cancellation.
 *
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} adminId
 */
const updateOrderStatus = async (orderId, newStatus, adminId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.status === newStatus) {
    throw new AppError(`Order is already in "${newStatus}" status`, 400);
  }

  const validNextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
  if (!validNextStatuses.includes(newStatus)) {
    throw new AppError(
      `Cannot transition order status from "${order.status}" to "${newStatus}". Allowed transitions: ${
        validNextStatuses.length > 0 ? validNextStatuses.join(', ') : 'none (terminal status)'
      }`,
      400
    );
  }

  // If order is cancelled, restore stock for all products inside a session
  if (newStatus === 'cancelled') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        changedBy: adminId,
        changedAt: new Date(),
      });

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
      return order;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  // Normal status transition
  order.status = newStatus;
  order.statusHistory.push({
    status: newStatus,
    changedBy: adminId,
    changedAt: new Date(),
  });

  await order.save();
  return order;
};

module.exports = {
  placeOrder,
  listMyOrders,
  getMyOrderById,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
};
