'use strict';

/**
 * src/services/category.service.js
 *
 * Business logic for category management.
 *
 * ── Key operations ────────────────────────────────────────────────────────────
 *
 * create:
 *   - Generate unique slug from name
 *   - If parent provided: validate it exists, compute ancestors array
 *   - Save the new category
 *
 * update:
 *   - If parent is changing: run circular reference check, recompute ancestors,
 *     then cascade-update ALL descendants' ancestors arrays
 *   - If name is changing: regenerate slug
 *
 * delete:
 *   - Block if category has children
 *   - Block if any products belong to this category (checked after Phase 6)
 *
 * getTree:
 *   - Fetch all categories, build nested tree in JS (no aggregation needed)
 *
 * ── Circular Reference Prevention ────────────────────────────────────────────
 * When moving category C to new parent P:
 *   - C cannot be P (self-reference)
 *   - C cannot be an ancestor of P (would create a loop)
 *   Detection: check if C._id is in P.ancestors, or P._id === C._id
 *   This is O(depth) — no recursive queries needed.
 *
 * ── Ancestor Cascade on Reparent ─────────────────────────────────────────────
 * When C moves from old parent to new parent P:
 *   C's new ancestors = [...P.ancestors, P._id]
 *   For each descendant D of C:
 *     D's new ancestors = [...C.newAncestors, C._id, ...D.ancestors.slice(D.ancestors.indexOf(C._id) + 1)]
 *   This is done with bulkWrite for efficiency.
 */

const mongoose = require('mongoose');
const slugify  = require('slugify');
const Category = require('../models/category.model');
const AppError = require('../utils/AppError');
const { buildCategoryTree } = require('../utils/categoryTree');

// ─── Slug Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe slug from a name.
 * @param {string} name
 * @returns {string}
 */
const toSlug = (name) =>
  slugify(name, { lower: true, strict: true, trim: true });

/**
 * Generate a slug that is guaranteed unique in the DB.
 * If "laptops" already exists, tries "laptops-2", "laptops-3", etc.
 *
 * @param {string} name
 * @param {string} [excludeId] - Exclude this doc's own ID (for updates)
 * @returns {Promise<string>}
 */
const generateUniqueSlug = async (name, excludeId = null) => {
  const base = toSlug(name);
  let slug = base;
  let counter = 2;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await Category.findOne(query).select('_id').lean();
    if (!exists) return slug;

    slug = `${base}-${counter}`;
    counter += 1;
  }
};

// ─── Ancestor Helpers ─────────────────────────────────────────────────────────

/**
 * Compute the ancestors array for a category given its parent document.
 * @param {object|null} parentDoc - The parent category document (or null)
 * @returns {mongoose.Types.ObjectId[]}
 */
const computeAncestors = (parentDoc) => {
  if (!parentDoc) return [];
  return [...parentDoc.ancestors, parentDoc._id];
};

/**
 * Check if moving `category` under `newParent` would create a circular reference.
 * @param {object} category   - The category being moved
 * @param {object} newParent  - The proposed new parent
 * @throws {AppError} 400 if circular reference detected
 */
const assertNoCircularReference = (category, newParent) => {
  // Self-reference check
  if (newParent._id.toString() === category._id.toString()) {
    throw new AppError('A category cannot be its own parent', 400);
  }

  // Descendant check: if category._id is in newParent's ancestor chain,
  // making newParent a child of category would close a cycle.
  const isDescendant = newParent.ancestors.some(
    (ancestorId) => ancestorId.toString() === category._id.toString()
  );

  if (isDescendant) {
    throw new AppError(
      'Circular reference detected: the selected parent is a descendant of this category',
      400
    );
  }
};

/**
 * After reparenting category C, cascade-update ancestors for all of C's descendants.
 *
 * For each descendant D:
 *   oldPrefix = C's old ancestors (before reparent)
 *   D's new ancestors = newCategoryAncestors + [C._id] + D.ancestors.slice(oldPrefix.length + 1)
 *   The +1 accounts for C._id itself which is already in D.ancestors after the old prefix.
 *
 * @param {object}   category         - The reparented category document (AFTER update)
 * @param {string[]} oldAncestorIds   - C's ancestors BEFORE the reparent (as strings)
 */
const cascadeAncestorUpdate = async (category, oldAncestorIds) => {
  // Find all descendants: categories that have category._id anywhere in their ancestors
  const descendants = await Category.find({ ancestors: category._id }).lean();

  if (descendants.length === 0) return;

  const oldPrefixLength = oldAncestorIds.length; // # ancestors C had before reparent
  const newCategoryAncestors = category.ancestors;  // C's new ancestors (already saved)

  const bulkOps = descendants.map((desc) => {
    // desc.ancestors = [...oldPrefix, C._id, ...suffix]
    // suffix = everything after C._id in the old ancestors list
    const cIdIndex = desc.ancestors.findIndex(
      (id) => id.toString() === category._id.toString()
    );

    // suffix: the part of desc.ancestors that comes AFTER C._id
    const suffix = cIdIndex >= 0 ? desc.ancestors.slice(cIdIndex + 1) : [];

    // New ancestors: C's new ancestors + C._id + suffix
    const newAncestors = [
      ...newCategoryAncestors,
      category._id,
      ...suffix,
    ];

    return {
      updateOne: {
        filter: { _id: desc._id },
        update: { $set: { ancestors: newAncestors } },
      },
    };
  });

  if (bulkOps.length > 0) {
    await Category.bulkWrite(bulkOps);
  }
};

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * List all categories (flat, sorted by name).
 */
const listCategories = async () => {
  return Category.find().sort({ name: 1 }).lean();
};

/**
 * Get the full category tree (nested).
 */
const getCategoryTree = async () => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  return buildCategoryTree(categories);
};

/**
 * Get a single category by ID.
 * @param {string} id
 */
const getCategoryById = async (id) => {
  const category = await Category.findById(id).lean();
  if (!category) throw new AppError('Category not found', 404);
  return category;
};

/**
 * Create a new category.
 * @param {{ name: string, description?: string, parent?: string|null }} data
 */
const createCategory = async ({ name, description = '', parent = null }) => {
  // Resolve parent document if provided
  let parentDoc = null;
  if (parent) {
    parentDoc = await Category.findById(parent);
    if (!parentDoc) throw new AppError('Parent category not found', 404);
  }

  const slug      = await generateUniqueSlug(name);
  const ancestors = computeAncestors(parentDoc);

  const category = await Category.create({
    name,
    slug,
    description,
    parent: parentDoc ? parentDoc._id : null,
    ancestors,
  });

  return category;
};

/**
 * Update an existing category.
 * Handles reparenting with circular reference detection and ancestor cascade.
 *
 * @param {string} id
 * @param {{ name?: string, description?: string, parent?: string|null }} data
 */
const updateCategory = async (id, { name, description, parent }) => {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);

  const isReparenting = parent !== undefined; // parent key was present in request body
  let newAncestors    = category.ancestors;
  const oldAncestorIds = category.ancestors.map((a) => a.toString());

  if (isReparenting) {
    const newParentId = parent; // could be null (promote to root)

    if (newParentId === null || newParentId === undefined) {
      // Moving to root
      newAncestors = [];
    } else {
      const newParentDoc = await Category.findById(newParentId);
      if (!newParentDoc) throw new AppError('Parent category not found', 404);

      // ── Circular reference check ────────────────────────────────────────────
      assertNoCircularReference(category, newParentDoc);

      newAncestors = computeAncestors(newParentDoc);
    }

    category.parent    = newParentId;
    category.ancestors = newAncestors;
  }

  if (name !== undefined) {
    category.name = name;
    // Regenerate slug (exclude own ID so it doesn't conflict with itself)
    category.slug = await generateUniqueSlug(name, id);
  }

  if (description !== undefined) {
    category.description = description;
  }

  await category.save();

  // ── Cascade ancestor update to all descendants ────────────────────────────
  if (isReparenting) {
    await cascadeAncestorUpdate(category, oldAncestorIds);
  }

  return category;
};

/**
 * Delete a category.
 * Blocks if the category has children or (Phase 6+) associated products.
 *
 * @param {string} id
 */
const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);

  // Block if this category has direct children
  const childCount = await Category.countDocuments({ parent: id });
  if (childCount > 0) {
    throw new AppError(
      `Cannot delete: this category has ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}. ` +
      'Delete or reassign them first.',
      400
    );
  }

  // NOTE: Product check will be enforced in Phase 6.
  // The product service will also call this before allowing deletion.
  // For now: a lazy require to avoid circular dependency if Product model is loaded later.
  try {
    const Product = require('../models/product.model');
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      throw new AppError(
        `Cannot delete: ${productCount} product${productCount === 1 ? '' : 's'} belong to this category. ` +
        'Reassign them first.',
        400
      );
    }
  } catch (err) {
    // If product model doesn't exist yet (Phase < 6), skip the check
    if (err instanceof AppError) throw err;
    // Otherwise: module not found → skip silently
  }

  await Category.findByIdAndDelete(id);
  return { message: 'Category deleted successfully' };
};

module.exports = {
  listCategories,
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
