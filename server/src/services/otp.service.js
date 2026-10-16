/**
 * FixIt Now - One-Time Password (OTP) Service
 * Conforms to docs/SRS.md FR-C4, FR-P6, Section 4 & docs/PLAN.md Phase 3.
 *
 * Requirements:
 * - Generate 6-digit numeric OTP with 10-minute expiry.
 * - Store in PostgreSQL otps table.
 * - Log to server console for now (with email dispatch planned later).
 * - Verify OTP and invalidate after single use.
 */

import { query } from '../config/db.js';

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generates a cryptographically random 6-digit numeric code
 * @returns {string} 6-digit code string e.g. "482019"
 */
function generate6DigitCode() {
  const codeNum = Math.floor(100000 + Math.random() * 900000);
  return codeNum.toString();
}

/**
 * Creates and stores an OTP for a target (email or phone)
 * @param {string} target - Target email address
 * @param {'forgot_password' | 'service_otp'} purpose
 * @returns {Promise<{ code: string, expiresAt: Date }>}
 */
export async function createAndDispatchOtp(target, purpose = 'forgot_password') {
  const cleanTarget = target.trim().toLowerCase();
  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any existing unused OTPs for this target & purpose
  await query(
    `DELETE FROM otps WHERE target = $1 AND purpose = $2`,
    [cleanTarget, purpose]
  );

  // Store in PostgreSQL
  await query(
    `INSERT INTO otps (target, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [cleanTarget, code, purpose, expiresAt]
  );

  // Server console dispatch per PLAN.md / Task description
  console.log('\n======================================================');
  console.log(`[OTP DISPATCH] FixIt Now Verification Code`);
  console.log(`Target:      ${cleanTarget}`);
  console.log(`Code:        ${code}`);
  console.log(`Purpose:     ${purpose}`);
  console.log(`Expires At:  ${expiresAt.toISOString()} (${OTP_EXPIRY_MINUTES} min)`);
  console.log('======================================================\n');

  return { code, expiresAt };
}

/**
 * Verifies an OTP and deletes it on success
 * @param {string} target - Target email address
 * @param {string} code - 6-digit code entered by user
 * @param {'forgot_password' | 'service_otp'} purpose
 * @returns {Promise<boolean>}
 */
export async function verifyOtp(target, code, purpose = 'forgot_password') {
  const cleanTarget = target.trim().toLowerCase();
  const cleanCode = (code || '').trim();

  if (!cleanTarget || !cleanCode) {
    return false;
  }

  const result = await query(
    `SELECT id, code, expires_at FROM otps
     WHERE target = $1 AND code = $2 AND purpose = $3 AND expires_at > CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`,
    [cleanTarget, cleanCode, purpose]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // OTP is valid - delete it so it cannot be reused
  await query(`DELETE FROM otps WHERE id = $1`, [result.rows[0].id]);
  return true;
}

export default {
  createAndDispatchOtp,
  verifyOtp,
};
