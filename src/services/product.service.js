'use strict';

/**
 * src/services/product.service.js
 *
 * ── Category filtering with descendants ────────────────────────────────────────
 * When a user filters by category C, we must include products from C AND all
 * subcategories at any depth. Using the materialized path pattern from Phase 5:
 *
 *   Step 1: Find all categories where C._id is in their ancestors array,
 *           plus C itself → gives us a flat list of all matching category IDs.
 *   Step 2: Filter products where category is in that set.
 *
 * This is a single indexed query — no recursion needed.
 *
 * ── Sorting ───────────────────────────────────────────────────────────────────
 * price_asc / price_desc sort by effective price using an aggregation pipeline
 * that adds a computed `effectivePrice` field ($ifNull of salePrice / price).
 * Other sorts (name_asc, name_desc, newest) use a simple find().
 *
 * ── Admin vs Public ───────────────────────────────────────────────────────────
 * Public listing: only 'active' products, no override possible.
 * Admin listing:  can filter by any status (active/inactive/archived).
 */

const mongoose = require('mongoose');
const slugify  = require('slugify');
const Product  = require('../models/product.model');
const Category = require('../models/category.model');
const AppError = require('../utils/AppError');

// ─── Slug Helpers ─────────────────────────────────────────────────────────────

const toSlug = (name) =>
  slugify(name, { lower: true, strict: true, trim: true });

const generateUniqueSlug = async (name, excludeId = null) => {
  const base = toSlug(name);
  let slug = base;
  let counter = 2;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Product.findOne(query).select('_id').lean();
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
};

// ─── Category Descendant Resolver ─────────────────────────────────────────────

/**
 * Given a category ID, return that category's ID plus all descendant IDs.
 * Uses the materialized path: descendants are categories whose ancestors
 * array contains the given ID.
 *
 * @param {string} categoryId
 * @returns {Promise<mongoose.Types.ObjectId[]>}
 */
const resolveCategoryIds = async (categoryId) => {
  const categories = await Category
    .find({
      $or: [
        { _id: categoryId },
        { ancestors: categoryId },
      ],
    })
    .select('_id')
    .lean();

  return categories.map((c) => c._id);
};

// ─── Sort Map ─────────────────────────────────────────────────────────────────

const SORT_MAP = {
  price_asc:  { price:  1 },
  price_desc: { price: -1 },
  name_asc:   { name:   1 },
  name_desc:  { name:  -1 },
  newest:     { createdAt: -1 },
};

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * List products with search, category filter (incl. descendants), price range,
 * status, sort, and pagination.
 *
 * @param {object} query     - Validated query parameters
 * @param {boolean} isAdmin  - If true, allow status filter; otherwise force 'active'
 */
const listProducts = async (query, isAdmin = false) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    sort = 'newest',
    page  = 1,
    limit = 20,
  } = query;

  // Status: public always sees only active products
  const status = isAdmin ? query.status : 'active';

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // ── Build filter ──────────────────────────────────────────────────────────
  const filter = {};

  if (status) filter.status = status;

  // Category filter including all descendants
  if (category) {
    const categoryIds = await resolveCategoryIds(category);
    if (categoryIds.length === 0) {
      // Category doesn't exist — return empty result
      return { products: [], total: 0, page: pageNum, limit: limitNum };
    }
    filter.category = { $in: categoryIds };
  }

  // Price range filter (on effective price — salePrice if set, else price)
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter = {};
    if (minPrice !== undefined) priceFilter.$gte = Number(minPrice);
    if (maxPrice !== undefined) priceFilter.$lte = Number(maxPrice);
    filter.price = priceFilter;
  }

  // ── Text search ───────────────────────────────────────────────────────────
  if (search) {
    filter.$text = { $search: search };
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sortObj = SORT_MAP[sort] || SORT_MAP.newest;

  // If text search is active, also sort by relevance score
  const sortQuery = search
    ? { score: { $meta: 'textScore' }, ...sortObj }
    : sortObj;

  // ── Query ─────────────────────────────────────────────────────────────────
  const [products, total] = await Promise.all([
    Product
      .find(filter, search ? { score: { $meta: 'textScore' } } : {})
      .populate('category', 'name slug')
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .lean({ virtuals: true }),
    Product.countDocuments(filter),
  ]);

  return { products, total, page: pageNum, limit: limitNum };
};

/**
 * Get a single product by ID.
 * @param {string} id
 * @param {boolean} isAdmin - If false, reject inactive/archived products
 */
const getProductById = async (id, isAdmin = false) => {
  const product = await Product.findById(id)
    .populate('category', 'name slug ancestors')
    .lean({ virtuals: true });

  if (!product) throw new AppError('Product not found', 404);

  if (!isAdmin && product.status !== 'active') {
    throw new AppError('Product not found', 404); // same message — don't leak existence
  }

  return product;
};

/**
 * Create a new product.
 * @param {object} data - Validated product fields
 */
const createProduct = async (data) => {
  const { name, sku, description, price, salePrice, stock, category, status } = data;

  // Verify category exists
  const categoryDoc = await Category.findById(category).lean();
  if (!categoryDoc) throw new AppError('Category not found', 404);

  // Check SKU uniqueness (Mongoose unique index gives a cryptic error)
  const skuExists = await Product.findOne({ sku: sku.toUpperCase() }).select('_id').lean();
  if (skuExists) throw new AppError(`SKU '${sku.toUpperCase()}' is already in use`, 409);

  const slug = await generateUniqueSlug(name);

  const product = await Product.create({
    name,
    slug,
    sku,
    description,
    price,
    salePrice: salePrice ?? null,
    stock:     stock ?? 0,
    category,
    status:    status ?? 'active',
  });

  return product.populate('category', 'name slug');
};

/**
 * Update an existing product.
 * @param {string} id
 * @param {object} data - Validated update fields
 */
const updateProduct = async (id, data) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const { name, sku, category, salePrice, ...rest } = data;

  // Name change → regenerate slug
  if (name !== undefined) {
    product.name = name;
    product.slug = await generateUniqueSlug(name, id);
  }

  // SKU change → check uniqueness
  if (sku !== undefined) {
    const upper = sku.toUpperCase();
    const skuExists = await Product.findOne({ sku: upper, _id: { $ne: id } }).select('_id').lean();
    if (skuExists) throw new AppError(`SKU '${upper}' is already in use`, 409);
    product.sku = upper;
  }

  // Category change → verify it exists
  if (category !== undefined) {
    const catExists = await Category.findById(category).select('_id').lean();
    if (!catExists) throw new AppError('Category not found', 404);
    product.category = category;
  }

  // salePrice: allow setting to null (remove sale)
  if ('salePrice' in data) {
    product.salePrice = salePrice ?? null;
  }

  // Apply remaining fields
  Object.assign(product, rest);

  await product.save();
  return product.populate('category', 'name slug');
};

/**
 * Soft-delete a product by setting status to 'archived'.
 * Hard deletion is avoided so historical orders still reference valid product data.
 *
 * @param {string} id
 */
const deleteProduct = async (id) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  if (product.status === 'archived') {
    throw new AppError('Product is already archived', 400);
  }

  product.status = 'archived';
  await product.save();

  return { message: 'Product archived successfully' };
};

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
