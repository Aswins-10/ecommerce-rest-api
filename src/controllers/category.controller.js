'use strict';

/**
 * src/controllers/category.controller.js
 */

const categoryService = require('../services/category.service');
const asyncHandler    = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

// GET /api/v1/categories
const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories();
  sendSuccess(res, 200, 'Categories retrieved successfully', categories);
});

// GET /api/v1/categories/tree
const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await categoryService.getCategoryTree();
  sendSuccess(res, 200, 'Category tree retrieved successfully', tree);
});

// GET /api/v1/categories/:id
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  sendSuccess(res, 200, 'Category retrieved successfully', category);
});

// POST /api/v1/categories
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent } = req.body;
  const category = await categoryService.createCategory({ name, description, parent });
  sendSuccess(res, 201, 'Category created successfully', category);
});

// PATCH /api/v1/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  sendSuccess(res, 200, 'Category updated successfully', category);
});

// DELETE /api/v1/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.id);
  sendSuccess(res, 200, result.message);
});

module.exports = {
  listCategories,
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
