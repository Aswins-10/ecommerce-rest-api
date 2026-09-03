'use strict';

/**
 * src/validators/order.validator.js
 */

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ID');

// ─── Place Order ──────────────────────────────────────────────────────────────
// The client sends: which products, in what quantities.
// NOTHING else — price/subtotal/total are calculated on the backend.
const placeOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product:  objectId.required().messages({ 'any.required': 'Product ID is required' }),
        quantity: Joi.number().integer().min(1).required().messages({
          'number.min':     'Quantity must be at least 1',
          'number.integer': 'Quantity must be a whole number',
          'any.required':   'Quantity is required',
        }),
        // Any price/subtotal/total fields from the client are silently stripped
        // by stripUnknown:true in the validate middleware. They are NEVER trusted.
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Order must contain at least one item',
      'any.required': 'Items are required',
    }),
});

// ─── Update Order Status (Admin) ──────────────────────────────────────────────
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
    .required()
    .messages({
      'any.only':    'Status must be one of: confirmed, processing, shipped, delivered, cancelled',
      'any.required': 'Status is required',
    }),
});

// ─── List Orders Query ────────────────────────────────────────────────────────
const listOrdersSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
    .optional(),
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { placeOrderSchema, updateOrderStatusSchema, listOrdersSchema };
