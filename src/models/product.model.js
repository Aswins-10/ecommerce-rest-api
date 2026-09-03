'use strict';

/**
 * src/models/product.model.js
 *
 * Product schema.
 *
 * Key design decisions:
 *   - `sku` is unique — the business identifier for a product.
 *   - `price` is the regular/list price. `salePrice` is the discounted price.
 *     Effective selling price = salePrice ?? price (computed in service, never trusted from client).
 *   - `stock` is decremented atomically in Phase 7 (findOneAndUpdate with $inc).
 *   - `status` drives visibility: only 'active' products appear in public listings.
 *     'archived' is a soft-delete — the product is hidden but its data is preserved
 *     so existing orders still reference it.
 *   - `category` is indexed for filtering; a compound index with `status` is added
 *     for the common "list active products in category X" query pattern.
 *   - Text index on name + description powers the search feature.
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [200, 'Product name must be at most 200 characters'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
      default: '',
    },

    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },

    // Optional sale/discounted price. Null = no sale.
    salePrice: {
      type: Number,
      min: [0, 'Sale price cannot be negative'],
      default: null,
      validate: {
        validator: function (v) {
          // salePrice must be less than price if provided
          if (v === null || v === undefined) return true;
          return v < this.price;
        },
        message: 'Sale price must be less than the regular price',
      },
    },

    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be a whole number',
      },
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'Status must be active, inactive, or archived',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// sku and slug are indexed by unique:true above.

// Compound index for the most common query: active products in a category
productSchema.index({ category: 1, status: 1 });

// Index for admin queries by status
productSchema.index({ status: 1, createdAt: -1 });

// Text index for search across name and description.
// Weights: name matches score higher than description.
productSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 1 }, name: 'product_text_search' }
);

// ─── Virtual: effectivePrice ──────────────────────────────────────────────────
// The price a customer actually pays. salePrice takes precedence over price.
productSchema.virtual('effectivePrice').get(function () {
  return this.salePrice !== null && this.salePrice !== undefined
    ? this.salePrice
    : this.price;
});

// ─── toJSON cleanup ───────────────────────────────────────────────────────────
productSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
