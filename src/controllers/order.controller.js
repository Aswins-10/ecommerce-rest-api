'use strict';

/**
 * src/controllers/order.controller.js
 */

const orderService = require('../services/order.service');
const asyncHandler  = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

// POST /api/v1/orders (Customer)
const placeOrder = asyncHandler(async (req, res) => {
  const order = await orderService.placeOrder(req.user._id, req.body.items);
  sendSuccess(res, 201, 'Order placed successfully', order);
});

// GET /api/v1/orders (Customer)
const getMyOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listMyOrders(req.user._id, req.query);
  sendPaginated(res, 'Orders retrieved successfully', result.orders, {
    page:  result.page,
    limit: result.limit,
    total: result.total,
  });
});

// GET /api/v1/orders/:id (Customer)
const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getMyOrderById(req.params.id, req.user._id);
  sendSuccess(res, 200, 'Order retrieved successfully', order);
});

// GET /api/v1/orders/admin (Admin - all orders)
const listAllOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listAllOrders(req.query);
  sendPaginated(res, 'All orders retrieved successfully', result.orders, {
    page:  result.page,
    limit: result.limit,
    total: result.total,
  });
});

// GET /api/v1/orders/admin/:id (Admin - get any order)
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  sendSuccess(res, 200, 'Order retrieved successfully', order);
});

// PATCH /api/v1/orders/admin/:id/status (Admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(
    req.params.id,
    req.body.status,
    req.user._id
  );
  sendSuccess(res, 200, 'Order status updated successfully', order);
});

module.exports = {
  placeOrder,
  getMyOrders,
  getMyOrderById,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
};
