'use strict';

const { buildCategoryTree } = require('../../src/utils/categoryTree');

describe('Category Tree Utility (buildCategoryTree)', () => {
  it('should return an empty array if no categories are provided', () => {
    const tree = buildCategoryTree([]);
    expect(tree).toEqual([]);
  });

  it('should correctly build a multi-level nested hierarchy', () => {
    const electronicsId = '6a9910000000000000000001';
    const computersId   = '6a9910000000000000000002';
    const laptopsId     = '6a9910000000000000000003';

    const flatCategories = [
      { _id: electronicsId, name: 'Electronics', parent: null },
      { _id: computersId,   name: 'Computers',   parent: electronicsId },
      { _id: laptopsId,     name: 'Laptops',     parent: computersId },
    ];

    const tree = buildCategoryTree(flatCategories);

    expect(tree.length).toBe(1);
    expect(tree[0].name).toBe('Electronics');
    expect(tree[0].children.length).toBe(1);

    const computersNode = tree[0].children[0];
    expect(computersNode.name).toBe('Computers');
    expect(computersNode.children.length).toBe(1);

    const laptopsNode = computersNode.children[0];
    expect(laptopsNode.name).toBe('Laptops');
    expect(laptopsNode.children).toEqual([]);
  });

  it('should support multiple root nodes with their respective children', () => {
    const electronicsId = '6a9910000000000000000001';
    const apparelId     = '6a9910000000000000000004';
    const shoesId       = '6a9910000000000000000005';

    const flatCategories = [
      { _id: electronicsId, name: 'Electronics', parent: null },
      { _id: apparelId,     name: 'Apparel',     parent: null },
      { _id: shoesId,       name: 'Shoes',       parent: apparelId },
    ];

    const tree = buildCategoryTree(flatCategories);

    expect(tree.length).toBe(2);
    const apparel = tree.find((c) => c.name === 'Apparel');
    expect(apparel).toBeDefined();
    expect(apparel.children.length).toBe(1);
    expect(apparel.children[0].name).toBe('Shoes');
  });
});
