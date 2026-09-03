'use strict';

/**
 * src/controllers/product.controller.js
 */

const productService = require('../services/product.service');
const asyncHandler   = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

// GET /api/v1/products  (public)
const listProducts = asyncHandler(async (req, res) => {
  // Determine if caller is admin (req.user is set by protect, optional here)
  const isAdmin = req.user?.role === 'admin';
  const result  = await productService.listProducts(req.query, isAdmin);

  sendPaginated(res, 'Products retrieved successfully', result.products, {
    page:  result.page,
    limit: result.limit,
    total: result.total,
  });
});

// GET /api/v1/products/:id  (public)
const getProductById = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const product = await productService.getProductById(req.params.id, isAdmin);
  sendSuccess(res, 200, 'Product retrieved successfully', product);
});

// POST /api/v1/products  (admin)
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, 'Product created successfully', product);
});

// PATCH /api/v1/products/:id  (admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  sendSuccess(res, 200, 'Product updated successfully', product);
});

// DELETE /api/v1/products/:id  (admin — soft delete)
const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(req.params.id);
  sendSuccess(res, 200, result.message);
});

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
