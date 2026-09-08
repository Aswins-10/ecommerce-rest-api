# E-commerce REST API

A production-grade, scalable **E-commerce REST API** built with **Node.js**, **Express.js**, **MongoDB Atlas**, **Mongoose**, and **JWT authentication**.

Developed to meet the rigorous technical standards of a **Mid-Level Node.js Backend Engineer**.

---

## Table of Contents
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Key Technical Implementations](#key-technical-implementations)
  - [1. Multi-Level Category Management (Materialized Path)](#1-multi-level-category-management-materialized-path)
  - [2. Backend Pricing Integrity & Price Snapshots](#2-backend-pricing-integrity--price-snapshots)
  - [3. Concurrency & Atomic Stock Management](#3-concurrency--atomic-stock-management)
  - [4. Security & Role-Based Access Control (RBAC)](#4-security--role-based-access-control-rbac)
  - [5. Centralized Error Handling](#5-centralized-error-handling)
- [Technology Stack](#technology-stack)
- [Project Directory Structure](#project-directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Running Automated Tests](#running-automated-tests)
- [API Documentation & Swagger](#api-documentation--swagger)
- [API Endpoints Overview](#api-endpoints-overview)

---

## Architecture & Design Decisions

The application adheres to a clean, **Layered Architecture** ensuring complete separation of concerns:

```
HTTP Request
    │
    ▼
[ Router ]          → Maps HTTP method & route path
    │
    ▼
[ Middlewares ]     → Rate limiting, Authentication (JWT), RBAC, Input validation (Joi)
    │
    ▼
[ Controller ]       → Thin layer: handles req/res, delegates to service
    │
    ▼
[ Service ]          → Core business logic, domain rules, transaction boundaries
    │
    ▼
[ Model (Mongoose) ] → Schema definitions, validation rules, hooks, database indexes
    │
    ▼
[ MongoDB Atlas ]
```

* **Thin Controllers**: Controllers contain no business logic. They extract request parameters, call services, and use standard response utilities (`apiResponse.js`).
* **Fat Services**: All database interactions, atomic operations, validations, and domain rules reside in services.
* **Pre-controller Validation**: Joi middleware validates and sanitizes request bodies and query parameters prior to controller execution (`stripUnknown: true` prevents mass assignment).

---

## Key Technical Implementations

### 1. Multi-Level Category Management (Materialized Path)
Categories support **unlimited nesting depth** (e.g., `Electronics → Computers → Laptops → Gaming Laptops`) using the **Materialized Path pattern**:
* Each category stores an `ancestors: [ObjectId]` array containing all ancestor IDs from root to direct parent.
* **Descendant Discovery**: Finding all products under a parent category and all its descendant subcategories is achieved in a single indexed query:
  ```javascript
  { $or: [{ _id: categoryId }, { ancestors: categoryId }] }
  ```
* **Circular Reference Prevention**: Before saving a parent change, the service verifies that the target parent is neither the category itself nor a descendant of the category (`O(depth)` verification without recursive DB queries).
* **Cascade Ancestor Maintenance**: Moving a parent category automatically cascade-updates the `ancestors` array of all downstream descendants in MongoDB using `bulkWrite`.
* **Tree Generation**: `GET /api/v1/categories/tree` constructs the full hierarchical JSON tree in `O(n)` time using an indexed map approach.

### 2. Backend Pricing Integrity & Price Snapshots
* **Zero Client Trust**: Order endpoints accept **only** `{ product: ObjectId, quantity: Number }`. Any client-supplied prices or subtotals are stripped by Joi.
* **Effective Price Calculation**: The backend queries the current prices (`salePrice ?? price`) directly from the database to calculate item subtotals and order totals.
* **Historical Immutability**: Product details (`name`, `sku`, `price`, `quantity`, `subtotal`) are snapshotted into embedded documents within the order at the time of purchase. Subsequent product price changes never alter past order records.

### 3. Concurrency & Atomic Stock Management
* **Atomic Stock Decrement**: Uses MongoDB atomic condition updates:
  ```javascript
  await Product.findOneAndUpdate(
    { _id: productId, status: 'active', stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { session, returnDocument: 'after' }
  );
  ```
  If stock is insufficient or the product is inactive, the query returns `null` and fails atomically, preventing race conditions or overselling.
* **Multi-Document ACID Transactions**: Order creation and stock reservations run within a MongoDB session/transaction (`startSession()`). If any item in the cart fails validation, the entire transaction is aborted and reserved stock is rolled back.
* **Stock Restoration on Cancellation**: If an admin cancels an order, reserved stock for each order item is automatically incremented back into inventory.

### 4. Security & Role-Based Access Control (RBAC)
* **Password Hashing**: Salted bcrypt hashing (12 cost factor) executed via pre-save Mongoose hook. `password` field has `select: false` to prevent accidental serialization.
* **Role-Based Authorization**: `requireRole('admin')` middleware strictly guards administrative routes. Customers accessing admin endpoints receive `403 Forbidden`.
* **Order Ownership Isolation**: Customers can only view their own orders (`404 Not Found` returned on unauthorized attempts to prevent ID harvesting).
* **Account Deactivation**: Admins can deactivate user accounts. The `protect` middleware validates user status on every request, immediately revoking active sessions.
* **Security Headers & Rate Limiting**:
  * `helmet()` configures HTTP headers (CSP, frameguard, nosniff).
  * `express-rate-limit`: Strict limiter on authentication routes (20 attempts / 15m) and general API limiter (100 req / 15m).
  * Body payload limit: Restricted to `10kb` to prevent payload DOS.

### 5. Centralized Error Handling
A single error handling middleware normalizes all application errors into a consistent response envelope:
```json
{
  "success": false,
  "status": "fail",
  "message": "Human-readable error explanation",
  "errors": [{ "field": "email", "message": "Email is required" }]
}
```
* Custom `AppError` class handles operational errors.
* Mongoose `CastError` (invalid ObjectId) → `400 Bad Request`.
* MongoDB duplicate key error (`code 11000`) → `409 Conflict`.
* Mongoose schema `ValidationError` → `422 Unprocessable Entity`.
* `JsonWebTokenError` / `TokenExpiredError` → `401 Unauthorized`.
* Malformed JSON syntax → `400 Bad Request`.
* Non-existent endpoints → `404 Not Found` catch-all.

---

## Technology Stack

* **Runtime**: Node.js (v18+)
* **Framework**: Express.js (v5.x)
* **Database**: MongoDB Atlas (Replica Set with Transactions support)
* **ODM**: Mongoose (v8/v9)
* **Authentication**: JSON Web Token (`jsonwebtoken`), `bcryptjs`
* **Validation**: `joi`
* **Security & Utilities**: `helmet`, `cors`, `express-rate-limit`, `morgan`, `slugify`
* **Documentation**: `swagger-ui-express`, `swagger-jsdoc` (OpenAPI 3.0)
* **Testing**: `jest`, `supertest`, `mongodb-memory-server`

---

## Project Directory Structure

```text
ecommerce-rest-api/
├── src/
│   ├── config/
│   │   ├── db.js                     # MongoDB connection factory & lifecycle events
│   │   ├── env.js                    # Environment variable validation & exports
│   │   └── swagger.js                # OpenAPI 3.0 specification & Swagger UI config
│   ├── controllers/
│   │   ├── auth.controller.js        # Register & login handlers
│   │   ├── category.controller.js    # Category CRUD & tree handlers
│   │   ├── order.controller.js       # Order placement, retrieval & status handlers
│   │   ├── product.controller.js     # Product CRUD & query handlers
│   │   └── user.controller.js        # Profile & admin user management handlers
│   ├── middlewares/
│   │   ├── auth.middleware.js        # JWT verification & active user check
│   │   ├── errorHandler.middleware.js# Centralized error mapping & formatting
│   │   ├── rateLimiter.middleware.js # API & auth rate limiters
│   │   ├── role.middleware.js        # Role-based authorization guard (admin/customer)
│   │   └── validate.middleware.js    # Joi schema validation for body and query
│   ├── models/
│   │   ├── category.model.js         # Category schema with materialized path
│   │   ├── order.model.js            # Order schema with embedded item snapshots
│   │   ├── product.model.js          # Product schema with indexes & effectivePrice
│   │   └── user.model.js             # User schema with bcrypt hooks & select: false
│   ├── routes/
│   │   ├── auth.routes.js            # /api/v1/auth
│   │   ├── category.routes.js        # /api/v1/categories
│   │   ├── index.js                  # Master router
│   │   ├── order.routes.js           # /api/v1/orders
│   │   ├── product.routes.js         # /api/v1/products
│   │   └── user.routes.js            # /api/v1/users
│   ├── services/
│   │   ├── auth.service.js           # Auth business logic
│   │   ├── category.service.js       # Category hierarchy, slugs, circular checks
│   │   ├── order.service.js          # Atomic transactions, price logic, stock restoration
│   │   ├── product.service.js        # Product queries, search, soft deletes
│   │   └── user.service.js           # User management logic
│   ├── utils/
│   │   ├── apiResponse.js            # Standardized success & paginated response helpers
│   │   ├── AppError.js               # Operational error class with HTTP status
│   │   ├── asyncHandler.js           # Wraps async controllers to eliminate try/catch
│   │   ├── categoryTree.js           # O(n) category tree builder algorithm
│   │   └── jwt.js                    # JWT signing and verification helpers
│   └── validators/
│       ├── auth.validator.js         # Register/login Joi schemas
│       ├── category.validator.js     # Category Joi schemas
│       ├── order.validator.js        # Order creation & status Joi schemas
│       ├── product.validator.js      # Product CRUD & query Joi schemas
│       └── user.validator.js         # User query Joi schemas
├── tests/
│   ├── integration/
│   │   ├── api.test.js               # End-to-end API integration tests
│   │   └── health.test.js            # Health check & 404 integration tests
│   └── unit/
│       ├── AppError.test.js          # AppError class tests
│       ├── categoryTree.test.js      # Tree builder utility tests
│       ├── jwt.test.js               # JWT utility tests
│       └── validators.test.js        # Joi validator unit tests
├── .env.example                      # Committed template for environment variables
├── .gitignore
├── .dockerignore                     # Excludes secrets and dev files from Docker image
├── app.js                            # Express application setup
├── docker-compose.yml                # Docker Compose for containerized deployment
├── Dockerfile                        # Multi-stage production Docker image
├── nodemon.json                      # Nodemon dev configuration
├── package.json
├── README.md
└── server.js                         # Application entrypoint & HTTP server lifecycle
```

---

## Environment Variables

Copy the provided [`.env.example`](.env.example) to `.env` and provide your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `PORT` | HTTP port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ecommerce_db?retryWrites=true&w=majority` |
| `JWT_SECRET` | Secret key for signing tokens (min 32 chars) | Random 64-byte hex string |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |

Generate a secure `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Aswins-10/ecommerce-rest-api.git
cd ecommerce-rest-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup `.env`
Ensure your MongoDB Atlas cluster allows network access from your IP (or `0.0.0.0/0`) and configure your `.env` file.

### 4. Start Development Server
```bash
npm run dev
```
The server will boot, verify required variables, connect to MongoDB Atlas, and listen on `http://localhost:3000`.

### 5. Production Start
```bash
npm start
```

---

## Running with Docker

A production-ready Docker setup is included (`Dockerfile` + `docker-compose.yml`).

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed and running
- Your `.env` file configured (see [Environment Variables](#environment-variables))

### Build and run
```bash
# Build the image and start the container
docker compose up --build

# Run in detached mode (background)
docker compose up --build -d
```

The API will be available at `http://localhost:3000`.

### Stop the container
```bash
docker compose down
```

> [!NOTE]
> The `MONGODB_URI` in your `.env` must be accessible from within the Docker container.
> If using **MongoDB Atlas**, ensure the Atlas cluster allows connections from `0.0.0.0/0`
> (or the specific Docker host IP) under **Network Access** settings.

---

## Running Automated Tests

The test suite includes 6 test suites covering both unit and integration tests:

```bash
npm test
```

Expected output:
```text
PASS tests/integration/api.test.js
PASS tests/integration/health.test.js
PASS tests/unit/validators.test.js
PASS tests/unit/jwt.test.js
PASS tests/unit/categoryTree.test.js
PASS tests/unit/AppError.test.js

Test Suites: 6 passed, 6 total
Tests:       31 passed, 31 total
Snapshots:   0 total
Time:        ~5 s
```

---

## API Documentation & Swagger

Interactive API documentation with request schemas, examples, and authentication support is available at:
* **Swagger UI**: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)
* **OpenAPI JSON Spec**: [http://localhost:3000/api/v1/docs.json](http://localhost:3000/api/v1/docs.json)

---

## API Endpoints Overview

**Base URL**: `/api/v1`

### 1. Authentication (`/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new customer account (returns JWT) |
| `POST` | `/auth/login` | Public | Authenticate user and receive JWT token |

### 2. Users (`/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/users/me` | Customer / Admin | Get authenticated user profile |
| `GET` | `/users` | Admin | List all registered users (paginated, role & active filter) |
| `GET` | `/users/:id` | Admin | Get user details by ID |
| `PATCH` | `/users/:id/activate` | Admin | Activate a deactivated user account |
| `PATCH` | `/users/:id/deactivate` | Admin | Deactivate an active user account |

### 3. Categories (`/categories`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/categories` | Public | List all categories (flat array) |
| `GET` | `/categories/tree` | Public | Retrieve complete nested category tree |
| `GET` | `/categories/:id` | Public | Get single category details |
| `POST` | `/categories` | Admin | Create category (supports `parent` reference for unlimited nesting) |
| `PATCH` | `/categories/:id` | Admin | Update category (reparent with circular reference checks) |
| `DELETE` | `/categories/:id` | Admin | Delete category (blocked if children or products exist) |

### 4. Products (`/products`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/products` | Public | List products (search, category filter with all descendants, price range, sort, pagination) |
| `GET` | `/products/:id` | Public | Get product details by ID |
| `POST` | `/products` | Admin | Create product with SKU and category reference |
| `PATCH` | `/products/:id` | Admin | Update product fields |
| `DELETE` | `/products/:id` | Admin | Soft-delete product (archives product) |

### 5. Orders (`/orders`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/orders` | Customer | Place order (atomic stock decrement, price snapshotting, transaction-backed) |
| `GET` | `/orders` | Customer | List customer's own orders (paginated) |
| `GET` | `/orders/:id` | Customer | Get customer's own order details (ownership enforced) |
| `GET` | `/orders/admin` | Admin | View all customer orders across the platform (paginated) |
| `GET` | `/orders/admin/:id` | Admin | View any customer order by ID |
| `PATCH` | `/orders/admin/:id/status` | Admin | Update status along state machine (`cancelled` restores stock) |
