'use strict';

/**
 * src/models/user.model.js
 *
 * User schema.
 *
 * Key design decisions:
 *   - `password` has `select: false` — excluded from ALL queries by default.
 *     Must be explicitly requested with `.select('+password')`.
 *   - Password hashing happens in a pre-save hook, not in the service layer,
 *     so it is impossible to accidentally save a plain-text password.
 *   - `isActive` flag supports admin activate/deactivate without deleting users.
 *   - `role` enum is enforced at schema level AND in middleware — defence in depth.
 *   - Indexes on `email` for login lookups.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // NEVER returned in queries unless explicitly requested
    },

    role: {
      type: String,
      enum: {
        values: ['admin', 'customer'],
        message: 'Role must be either admin or customer',
      },
      default: 'customer',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// email is already indexed by unique:true above.
// Add a compound index for admin list queries that filter by role + isActive.
userSchema.index({ role: 1, isActive: 1 });

// ─── Pre-save Hook: Hash Password ─────────────────────────────────────────────
// Runs ONLY when the password field is modified (new user or password change).
// This guarantees a plain-text password can never be persisted.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
// Used by auth service during login to compare candidate vs stored hash.
// Defined on the schema so it is available on every User document.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Transform: Remove Sensitive Fields from JSON Output ─────────────────────
// When a User document is serialised (res.json), strip password and __v.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
