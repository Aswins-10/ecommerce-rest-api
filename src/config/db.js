'use strict';

/**
 * src/config/db.js
 *
 * Mongoose connection factory.
 *
 * Design decisions:
 *   - Exported as an async function so server.js can await it before
 *     starting the HTTP server — avoids race conditions where the server
 *     accepts requests before the DB is ready.
 *   - Mongoose 8.x uses native promises and handles connection pooling
 *     internally; we only need to call connect() once.
 *   - `serverSelectionTimeoutMS` is set to 10 s so startup fails fast
 *     instead of hanging silently on a bad Atlas URI.
 */

const mongoose = require('mongoose');
const { MONGODB_URI, NODE_ENV } = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      // Surface Atlas network errors quickly during startup
      serverSelectionTimeoutMS: 10_000,
    });

    console.log(`✅ MongoDB connected → ${conn.connection.host}`);
    if (NODE_ENV === 'development') {
      // Show which DB we landed on — useful to confirm Atlas routing
      console.log(`   Database: ${conn.connection.name}`);
    }
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    // Exit the process — no point running without a database
    process.exit(1);
  }
};

// ─── Connection Event Listeners ───────────────────────────────────────────────
// These fire on events after the initial connection (e.g. Atlas failover).

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Mongoose will attempt to reconnect…');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected.');
});

module.exports = connectDB;
