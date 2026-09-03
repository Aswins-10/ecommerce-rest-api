'use strict';

/**
 * src/validators/product.validator.js
 */

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ID');

// ─── Create Product ───────────────────────────────────────────────────────────
const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required().messages({
    'any.required': 'Product name is required',
  }),

  sku: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'SKU is required',
  }),

  description: Joi.string().trim().max(2000).allow('').optional(),

  price: Joi.number().min(0).required().messages({
    'any.required': 'Price is required',
    'number.min':   'Price cannot be negative',
  }),

  salePrice: Joi.number().min(0).less(Joi.ref('price')).allow(null).optional().messages({
    'number.less': 'Sale price must be less than the regular price',
  }),

  stock: Joi.number().integer().min(0).default(0).messages({
    'number.integer': 'Stock must be a whole number',
    'number.min':     'Stock cannot be negative',
  }),

  category: objectId.required().messages({
    'any.required': 'Category is required',
  }),

  status: Joi.string().valid('active', 'inactive', 'archived').default('active'),
});

// ─── Update Product ───────────────────────────────────────────────────────────
const updateProductSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(200).optional(),
  sku:         Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  price:       Joi.number().min(0).optional(),
  salePrice:   Joi.number().min(0).allow(null).optional(),
  stock:       Joi.number().integer().min(0).optional(),
  category:    objectId.optional(),
  status:      Joi.string().valid('active', 'inactive', 'archived').optional(),
}).min(1).message('At least one field must be provided for update');

// ─── List Products Query ──────────────────────────────────────────────────────
const listProductsSchema = Joi.object({
  search:    Joi.string().trim().max(200).optional(),
  category:  objectId.optional(),
  minPrice:  Joi.number().min(0).optional(),
  maxPrice:  Joi.number().min(0).optional(),
  status:    Joi.string().valid('active', 'inactive', 'archived').optional(),
  sort:      Joi.string()
    .valid('price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest')
    .default('newest'),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createProductSchema, updateProductSchema, listProductsSchema };
