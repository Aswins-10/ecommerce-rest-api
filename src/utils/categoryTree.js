'use strict';

/**
 * src/utils/categoryTree.js
 *
 * Builds a nested tree structure from a flat array of category documents.
 *
 * Algorithm (O(n)):
 *   1. Build a map of id → node (with empty children array)
 *   2. Iterate: if node has a parent, attach it to parent's children array
 *   3. Collect all root nodes (parent === null) as the top-level array
 *
 * This avoids O(n²) nested loops and works for any depth.
 *
 * Input:  flat array of category documents (from DB)
 * Output: nested array where each node has a `children` array
 *
 * Example output:
 * [
 *   {
 *     _id: "...", name: "Electronics", children: [
 *       { _id: "...", name: "Computers", children: [
 *         { _id: "...", name: "Laptops", children: [] }
 *       ]}
 *     ]
 *   }
 * ]
 */

/**
 * @param {Array} categories - Flat array of category plain objects (toJSON'd)
 * @returns {Array}          - Nested tree
 */
const buildCategoryTree = (categories) => {
  // Map of id string → node with empty children array
  const map = {};
  categories.forEach((cat) => {
    map[cat._id.toString()] = { ...cat, children: [] };
  });

  const roots = [];

  categories.forEach((cat) => {
    const node = map[cat._id.toString()];

    if (cat.parent) {
      const parentNode = map[cat.parent.toString()];
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent not in result set (shouldn't happen in normal use)
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
};

module.exports = { buildCategoryTree };
