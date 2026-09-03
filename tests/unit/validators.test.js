'use strict';

const { registerSchema, loginSchema } = require('../../src/validators/auth.validator');
const { createProductSchema } = require('../../src/validators/product.validator');
const { placeOrderSchema } = require('../../src/validators/order.validator');

describe('Joi Validators', () => {
  describe('Auth Validators', () => {
    it('should validate a correct register payload', () => {
      const { error, value } = registerSchema.validate({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'securePassword123',
      });
      expect(error).toBeUndefined();
      expect(value.email).toBe('jane@example.com');
    });

    it('should reject registration with invalid email or short password', () => {
      const { error } = registerSchema.validate({
        name: 'J',
        email: 'invalid-email',
        password: '123',
      });
      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(0);
    });

    it('should validate a correct login payload', () => {
      const { error } = loginSchema.validate({
        email: 'jane@example.com',
        password: 'securePassword123',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('Product Validators', () => {
    it('should reject product if salePrice is greater than or equal to price', () => {
      const { error } = createProductSchema.validate({
        name: 'Wireless Mouse',
        sku: 'MOUSE-01',
        price: 50,
        salePrice: 60,
        category: '6a9910000000000000000001',
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/less than/i);
    });

    it('should accept product if salePrice is less than regular price', () => {
      const { error } = createProductSchema.validate({
        name: 'Wireless Mouse',
        sku: 'MOUSE-01',
        price: 50,
        salePrice: 40,
        category: '6a9910000000000000000001',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('Order Validators', () => {
    it('should validate an order with valid products and quantities', () => {
      const { error } = placeOrderSchema.validate({
        items: [
          { product: '6a9910000000000000000001', quantity: 2 },
          { product: '6a9910000000000000000002', quantity: 1 },
        ],
      });
      expect(error).toBeUndefined();
    });

    it('should reject order with empty items array', () => {
      const { error } = placeOrderSchema.validate({ items: [] });
      expect(error).toBeDefined();
    });

    it('should reject order with non-positive or non-integer quantities', () => {
      const { error } = placeOrderSchema.validate({
        items: [{ product: '6a9910000000000000000001', quantity: 0 }],
      });
      expect(error).toBeDefined();
    });
  });
});
