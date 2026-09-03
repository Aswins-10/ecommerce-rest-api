'use strict';

/**
 * src/config/swagger.js
 *
 * OpenAPI 3.0.0 Specification and Swagger UI Configuration.
 */

const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'E-commerce REST API',
    version: '1.0.0',
    description: `
**Production-ready E-commerce REST API** built with Node.js, Express.js, MongoDB Atlas, and JWT authentication.

### Key Architecture Features:
- **Layered Clean Architecture**: Router → Middleware → Controller → Service → Model
- **Security**: JWT authentication, Role-Based Access Control (RBAC), Helmet HTTP headers, CORS, strict rate limiting
- **Materialized Path Categories**: Unlimited nesting hierarchy, single-query descendant search, circular reference prevention
- **Atomic Concurrency & Orders**: MongoDB replica set transactions, atomic stock decrement, backend price integrity & price snapshots
- **Resilience**: Centralized error handler, normalized responses, input validation via Joi
    `,
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base URL',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6a991b6865a7d3099733688a' },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          role: { type: 'string', enum: ['admin', 'customer'], example: 'customer' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6a991e86f2d1dfc8026f2453' },
          name: { type: 'string', example: 'Laptops' },
          slug: { type: 'string', example: 'laptops' },
          description: { type: 'string', example: 'High performance portable computers' },
          parent: { type: 'string', nullable: true, example: '6a991e86f2d1dfc8026f2452' },
          ancestors: {
            type: 'array',
            items: { type: 'string' },
            example: ['6a991e86f2d1dfc8026f2451', '6a991e86f2d1dfc8026f2452'],
          },
          depth: { type: 'integer', example: 2 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6a992001f2d1dfc8026f2499' },
          name: { type: 'string', example: 'MacBook Pro 16"' },
          slug: { type: 'string', example: 'macbook-pro-16' },
          sku: { type: 'string', example: 'MAC-PRO-16-001' },
          description: { type: 'string', example: 'Apple M3 Max, 36GB RAM, 1TB SSD' },
          price: { type: 'number', example: 249999 },
          salePrice: { type: 'number', nullable: true, example: 229999 },
          effectivePrice: { type: 'number', example: 229999 },
          stock: { type: 'integer', example: 15 },
          category: { $ref: '#/components/schemas/Category' },
          status: { type: 'string', enum: ['active', 'inactive', 'archived'], example: 'active' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          product: { type: 'string', example: '6a992001f2d1dfc8026f2499' },
          name: { type: 'string', example: 'MacBook Pro 16"' },
          sku: { type: 'string', example: 'MAC-PRO-16-001' },
          price: { type: 'number', example: 229999 },
          quantity: { type: 'integer', example: 2 },
          subtotal: { type: 'number', example: 459998 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6a992252d97b9d632660f2bc' },
          user: { type: 'string', example: '6a991b6865a7d3099733688a' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          total: { type: 'number', example: 459998 },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
            example: 'pending',
          },
          statusHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'pending' },
                changedBy: { type: 'string', example: '6a991b6865a7d3099733688a' },
                changedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          status: { type: 'string', example: 'fail' },
          message: { type: 'string', example: 'Resource not found' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Please provide a valid email address' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new customer account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  password: { type: 'string', minLength: 8, example: 'securePassword123' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Account created successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          409: { description: 'Email already registered' },
          422: { description: 'Validation failed' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  password: { type: 'string', example: 'securePassword123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Login successful' },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid email or password / Account deactivated' },
        },
      },
    },

    // ── Users ─────────────────────────────────────────────────────────────────
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Current profile data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users (Admin)'],
        summary: 'List all users with pagination and filters',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'customer'] } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'Paginated user list' },
          403: { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users (Admin)'],
        summary: 'Get user by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User retrieved successfully' },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/{id}/activate': {
      patch: {
        tags: ['Users (Admin)'],
        summary: 'Activate a deactivated user',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User activated successfully' },
        },
      },
    },
    '/users/{id}/deactivate': {
      patch: {
        tags: ['Users (Admin)'],
        summary: 'Deactivate an active user',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User deactivated successfully' },
          400: { description: 'Cannot deactivate own account / already inactive' },
        },
      },
    },

    // ── Categories ────────────────────────────────────────────────────────────
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories (flat list)',
        responses: {
          200: { description: 'Categories list' },
        },
      },
      post: {
        tags: ['Categories (Admin)'],
        summary: 'Create a new category (supports unlimited nesting via parent)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Laptops' },
                  description: { type: 'string', example: 'Portable computers' },
                  parent: { type: 'string', nullable: true, example: '6a991e86f2d1dfc8026f2452' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Category created' },
          403: { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/categories/tree': {
      get: {
        tags: ['Categories'],
        summary: 'Retrieve full nested category hierarchy tree',
        responses: {
          200: { description: 'Nested category tree' },
        },
      },
    },
    '/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get single category by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Category retrieved' },
          404: { description: 'Category not found' },
        },
      },
      patch: {
        tags: ['Categories (Admin)'],
        summary: 'Update category (reparenting with circular reference prevention)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  parent: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Category updated' },
          400: { description: 'Circular reference detected or invalid parent' },
        },
      },
      delete: {
        tags: ['Categories (Admin)'],
        summary: 'Delete category (guarded against child categories and assigned products)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Category deleted' },
          400: { description: 'Cannot delete category with children or products' },
        },
      },
    },

    // ── Products ──────────────────────────────────────────────────────────────
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List products with search, descendant category filtering, price range, sorting, pagination',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Text search across name and description' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category ID — includes all descendant subcategories automatically' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'archived'] }, description: 'Admin only' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Paginated product list' },
        },
      },
      post: {
        tags: ['Products (Admin)'],
        summary: 'Create a new product',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'sku', 'price', 'category'],
                properties: {
                  name: { type: 'string', example: 'Sony WH-1000XM5' },
                  sku: { type: 'string', example: 'SONY-XM5-01' },
                  description: { type: 'string', example: 'Noise canceling headphones' },
                  price: { type: 'number', example: 29999 },
                  salePrice: { type: 'number', nullable: true, example: 26999 },
                  stock: { type: 'integer', example: 25 },
                  category: { type: 'string', example: '6a991e86f2d1dfc8026f2453' },
                  status: { type: 'string', enum: ['active', 'inactive', 'archived'], default: 'active' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Product created' },
          409: { description: 'SKU already in use' },
          422: { description: 'Validation failed (e.g. salePrice >= price)' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product detail by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product detail' },
          404: { description: 'Product not found' },
        },
      },
      patch: {
        tags: ['Products (Admin)'],
        summary: 'Update product',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sku: { type: 'string' },
                  price: { type: 'number' },
                  salePrice: { type: 'number', nullable: true },
                  stock: { type: 'integer' },
                  category: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'inactive', 'archived'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Product updated' },
        },
      },
      delete: {
        tags: ['Products (Admin)'],
        summary: 'Soft-delete (archive) product',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product archived successfully' },
        },
      },
    },

    // ── Orders ────────────────────────────────────────────────────────────────
    '/orders': {
      post: {
        tags: ['Orders (Customer)'],
        summary: 'Place order with multiple items (atomic stock deduction & backend price integrity)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['product', 'quantity'],
                      properties: {
                        product: { type: 'string', example: '6a992001f2d1dfc8026f2499' },
                        quantity: { type: 'integer', minimum: 1, example: 2 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Order placed successfully' },
          400: { description: 'Insufficient stock or unavailable product' },
        },
      },
      get: {
        tags: ['Orders (Customer)'],
        summary: 'List own orders with pagination and status filter',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Customer orders list' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders (Customer)'],
        summary: 'Get own order detail by ID (ownership enforced)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Order details' },
          404: { description: 'Order not found / Unauthorized' },
        },
      },
    },
    '/orders/admin': {
      get: {
        tags: ['Orders (Admin)'],
        summary: 'List all customer orders across the platform',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'All orders list with populated user info' },
          403: { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/orders/admin/{id}': {
      get: {
        tags: ['Orders (Admin)'],
        summary: 'Get any order by ID with user info',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Order details' },
        },
      },
    },
    '/orders/admin/{id}/status': {
      patch: {
        tags: ['Orders (Admin)'],
        summary: 'Update order status along state machine (restores stock on cancellation)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
                    example: 'confirmed',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Order status updated' },
          400: { description: 'Invalid state machine transition' },
        },
      },
    },
  },
};

const swaggerServe = swaggerUi.serve;
const swaggerSetup = swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'E-commerce REST API Docs',
});

module.exports = { swaggerSpec, swaggerServe, swaggerSetup };
