'use strict';

/**
 * src/models/order.model.js
 *
 * Order schema with embedded item snapshots.
 *
 * ── Why embedded items (not references)? ──────────────────────────────────────
 * Product prices, names, and SKUs can change after an order is placed.
 * We copy these values INTO the order at creation time so historical orders
 * are permanently accurate regardless of future product edits.
 *
 * ── Status machine ────────────────────────────────────────────────────────────
 * pending → confirmed → processing → shipped → delivered
 *       ↘          ↘
 *        cancelled   cancelled
 *
 * delivered and cancelled are terminal — no further transitions.
 *
 * ── statusHistory ─────────────────────────────────────────────────────────────
 * Every status change is appended as an audit log entry. This lets admins
 * trace the full lifecycle of any order.
 */

const mongoose = require('mongoose');

// ─── Embedded: Order Item Snapshot ───────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    // Reference kept for display/lookup, but NOT used for pricing
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    // ── Snapshot fields (copied from product at purchase time) ──────────────
    // These must NEVER be updated after the order is created.
    name: {
      type: String,
      required: true,
    },

    sku: {
      type: String,
      required: true,
    },

    // The effective price the customer paid (salePrice ?? price at that moment)
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },

    // price × quantity — calculated on backend, never from client
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

// ─── Embedded: Status History Entry ──────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false }
);

// ─── Main: Order ──────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'An order must contain at least one item',
      },
    },

    // Sum of all item subtotals — calculated on backend, never from client
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        message: 'Invalid order status',
      },
      default: 'pending',
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Fast "my orders" query — filter by user, sort newest first
orderSchema.index({ user: 1, createdAt: -1 });

// Admin queries by status
orderSchema.index({ status: 1, createdAt: -1 });

// ─── toJSON cleanup ───────────────────────────────────────────────────────────
orderSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
