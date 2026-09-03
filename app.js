'use strict';

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');

const AppError      = require('./src/utils/AppError');
const errorHandler  = require('./src/middlewares/errorHandler.middleware');
const { apiLimiter } = require('./src/middlewares/rateLimiter.middleware');
const routes        = require('./src/routes');

const { swaggerSpec, swaggerServe, swaggerSetup } = require('./src/config/swagger');

const app = express();

// ─── Security Middlewares ─────────────────────────────────────────────────────
// Set security HTTP headers; configure CSP so Swagger UI assets load cleanly
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// Enable CORS for all incoming requests (configurable for specific origins in prod)
app.use(cors());

// ─── HTTP Request Logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Parse incoming JSON payloads with a safety size limit (10kb) to prevent payload DOS
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Health Check (Unthrottled) ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Documentation (Swagger / OpenAPI) ───────────────────────────────────
app.use('/api/v1/docs', swaggerServe, swaggerSetup);
app.get('/api/v1/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Rate Limiting & API Routes ───────────────────────────────────────────────
// Apply general rate limiter to all API endpoints
app.use('/api/v1', apiLimiter, routes);

// ─── 404 Handler (Catch-all for unhandled routes) ──────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server`, 404));
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
