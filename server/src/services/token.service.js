/**
 * FixIt Now - Token & Password Security Service
 * Conforms to docs/SRS.md FR-C2, FR-P1, Section 5 & docs/PLAN.md Phase 3.
 *
 * Requirements:
 * - Password must be at least 6 characters and contain at least one special character.
 * - Hash passwords with bcrypt.
 * - Sign and verify JWT tokens with role-based claims.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

const SALT_ROUNDS = 10;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Validates password rules:
 * - At least 6 characters
 * - At least one special character
 *
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }

  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters in length.' };
  }

  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one special character (e.g. !@#$%^&*).',
    };
  }

  return { valid: true };
}

/**
 * Hashes a plaintext password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares plaintext password with bcrypt hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Generates signed JWT token
 * @param {{ id: string | number, email: string, role: 'customer' | 'partner' | 'admin', name?: string }} payload
 * @returns {string}
 */
export function generateToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name || '',
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    }
  );
}

/**
 * Verifies JWT token
 * @param {string} token
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export default {
  validatePassword,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
};
