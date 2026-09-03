'use strict';

require('dotenv').config();
const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../app');

describe('Full E-commerce API Integration Tests', () => {
  let adminToken;
  let customerToken;
  let customerId;
  let rootCategoryId;
  let subCategoryId;
  let productId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── 1. Auth & User Endpoints ───────────────────────────────────────────────
  describe('Authentication & User Management', () => {
    const testEmail = `test.user.${Date.now()}@example.com`;

    it('POST /api/v1/auth/register should register a new user and return JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jest Customer',
          email: testEmail,
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.password).toBeUndefined();

      customerToken = res.body.data.token;
      customerId    = res.body.data.user._id;
    });

    it('POST /api/v1/auth/register should reject duplicate email with 409', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Duplicate',
          email: testEmail,
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/auth/login should authenticate and return token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('POST /api/v1/auth/login should reject incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'wrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/users/me should return authenticated profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testEmail);
    });

    it('GET /api/v1/users (Admin route) should reject customer with 403', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── 2. Categories & Circular Reference ─────────────────────────────────────
  describe('Category Management', () => {
    beforeAll(async () => {
      // Login as admin
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin1234',
        });
      adminToken = res.body.data.token;
    });

    it('POST /api/v1/categories should create a root category', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Electronics ${Date.now()}`,
          description: 'Root category for devices',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.parent).toBeNull();
      expect(res.body.data.ancestors).toEqual([]);
      rootCategoryId = res.body.data._id;
    });

    it('POST /api/v1/categories should create a child category with correct ancestors', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Audio Devices ${Date.now()}`,
          parent: rootCategoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.parent).toBe(rootCategoryId);
      expect(res.body.data.ancestors).toContain(rootCategoryId);
      subCategoryId = res.body.data._id;
    });

    it('PATCH /api/v1/categories/:id should reject circular reference', async () => {
      // Trying to make root category a child of its own sub-category
      const res = await request(app)
        .patch(`/api/v1/categories/${rootCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          parent: subCategoryId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/circular reference/i);
    });

    it('GET /api/v1/categories/tree should return nested category structure', async () => {
      const res = await request(app).get('/api/v1/categories/tree');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ─── 3. Products & Descendant Filtering ─────────────────────────────────────
  describe('Product Management', () => {
    it('POST /api/v1/products should create a product under sub-category', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Wireless Earbuds ${Date.now()}`,
          sku: `EARBUD-${Date.now()}`,
          price: 5000,
          salePrice: 4500,
          stock: 20,
          category: subCategoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.stock).toBe(20);
      productId = res.body.data._id;
    });

    it('GET /api/v1/products?category=rootCategory should include descendant products', async () => {
      const res = await request(app).get(`/api/v1/products?category=${rootCategoryId}`);
      expect(res.status).toBe(200);

      const found = res.body.data.some((p) => p._id.toString() === productId.toString());
      expect(found).toBe(true);
    });
  });

  // ─── 4. Orders, Stock & Isolation ───────────────────────────────────────────
  describe('Order Management', () => {
    it('POST /api/v1/orders should place order and calculate price on backend', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [
            {
              product: productId,
              quantity: 2,
              price: 1, // Tampered price: MUST BE IGNORED
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].price).toBe(4500); // from DB salePrice
      expect(res.body.data.total).toBe(9000); // 4500 * 2
      expect(res.body.data.status).toBe('pending');
    });

    it('POST /api/v1/orders should reject if stock is insufficient', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [
            {
              product: productId,
              quantity: 1000, // exceeds available stock
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient stock/i);
    });
  });
});
