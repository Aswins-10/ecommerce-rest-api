'use strict';

// Load environment variables FIRST — before any other require()
// so that process.env values are available throughout the entire app.
require('dotenv').config();

const app = require('./app');
const connectDB = require('./src/config/db');
const { PORT, NODE_ENV } = require('./src/config/env');

// ─── Boot Sequence ────────────────────────────────────────────────────────────
// Connect to MongoDB first, then start the HTTP server.
// This prevents the server from accepting requests before the DB is ready.
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`\n✅ Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`   Health check → http://localhost:${PORT}/health\n`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down gracefully…`);
    server.close(async () => {
      // Close the Mongoose connection cleanly
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('🔴 MongoDB connection closed.');
      console.log('🔴 HTTP server closed.');
      process.exit(0);
    });

    // Force exit if server doesn't close within 10 seconds
    setTimeout(() => {
      console.error('❌ Forcefully shutting down after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

// ─── Unhandled Rejections & Exceptions ───────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

startServer();
