/**
 * FixIt Now - Payment Attempts & QR Code Subscription Payment Service
 * Conforms to Item 3:
 * - Creates payment attempts with locked amount, SHA-256 token hash, 5-min expiry.
 * - Atomic scan conditional update (status 'created' -> 'processing').
 * - 2.5s server-side wait, atomic transaction creating idempotent subscription.
 * - Socket.IO pushes to partner ('payment:processing', 'payment:success').
 * - Startup recovery for interrupted processing attempts and expired attempts.
 */

import crypto from 'crypto';
import db from '../config/db.js';
import config from '../config/index.js';
import { getIo } from './socket.service.js';

const { query, pool } = db;

/**
 * Creates a new payment attempt for partner and plan.
 * Cancels any existing open ('created') attempt for this partner and plan.
 * Locks the plan's current price.
 */
export async function createPaymentAttempt(partnerId, planId) {
  const planIdNum = parseInt(planId, 10);
  if (isNaN(planIdNum) || planIdNum <= 0) {
    throw new Error('Valid plan ID is required.');
  }

  // 1. Fetch current plan details to lock the amount
  const planRes = await query(
    `SELECT id, name, price, duration_months, active FROM plans WHERE id = $1 AND active = true`,
    [planIdNum]
  );
  if (planRes.rows.length === 0) {
    throw new Error('Selected plan is invalid or inactive.');
  }
  const plan = planRes.rows[0];
  const lockedAmount = parseFloat(plan.price);

  // 2. Cancel any existing open attempt for this partner and plan
  await query(
    `UPDATE payment_attempts
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE partner_id = $1 AND plan_id = $2 AND status = 'created'`,
    [partnerId, planIdNum]
  );

  // 3. Generate raw 32-byte hex token and its SHA-256 hash
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 4. Expires 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // 5. Insert new payment attempt record
  const insertRes = await query(
    `INSERT INTO payment_attempts (
       partner_id, plan_id, amount, status, token_hash, expires_at
     ) VALUES ($1, $2, $3, 'created', $4, $5)
     RETURNING id, partner_id, plan_id, amount, status, expires_at, created_at`,
    [partnerId, planIdNum, lockedAmount, tokenHash, expiresAt.toISOString()]
  );

  const attempt = insertRes.rows[0];

  const publicBase = (config.publicBaseUrl || process.env.PUBLIC_BASE_URL || `http://localhost:${config.port || 5001}`).replace(/\/$/, '');
  const scanUrl = `${publicBase}/pay/${rawToken}`;
  const upiId = config.upiId || process.env.UPI_ID || 'fixitnow@demo';

  // In development only (NODE_ENV=development), print the scan link in the server terminal
  if (process.env.NODE_ENV === 'development') {
    console.log('\n======================================================');
    console.log(' [QR PAYMENT SCAN LINK (DEV ONLY)]');
    console.log(` URL:    ${scanUrl}`);
    console.log(` Plan:   ${plan.name} | Amount: ₹${lockedAmount.toFixed(2)}`);
    console.log(` Expiry: ${expiresAt.toLocaleTimeString()}`);
    console.log('======================================================\n');
  }

  return {
    attemptId: attempt.id,
    planId: plan.id,
    planName: plan.name,
    amount: lockedAmount,
    token: rawToken,
    scanUrl,
    upiId,
    expiresAt: attempt.expires_at,
    status: attempt.status,
  };
}

/**
 * Retrieves the latest payment attempt for a partner and plan (for reconnect/reload).
 */
export async function getActivePaymentAttempt(partnerId, planId) {
  const planIdNum = parseInt(planId, 10);
  const res = await query(
    `SELECT pa.id, pa.partner_id, pa.plan_id, pa.amount, pa.status, pa.expires_at, pa.created_at,
            p.name as plan_name, p.duration_months
     FROM payment_attempts pa
     JOIN plans p ON p.id = pa.plan_id
     WHERE pa.partner_id = $1 AND pa.plan_id = $2
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [partnerId, planIdNum]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const upiId = config.upiId || process.env.UPI_ID || 'fixitnow@demo';

  return {
    attemptId: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
    amount: parseFloat(row.amount),
    expiresAt: row.expires_at,
    status: row.status,
    upiId,
  };
}

/**
 * Retrieves attempt by ID.
 */
export async function getPaymentAttemptById(attemptId) {
  const res = await query(
    `SELECT pa.id, pa.partner_id, pa.plan_id, pa.amount, pa.status, pa.expires_at, pa.created_at,
            p.name as plan_name, p.duration_months
     FROM payment_attempts pa
     JOIN plans p ON p.id = pa.plan_id
     WHERE pa.id = $1`,
    [attemptId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    attemptId: row.id,
    partnerId: row.partner_id,
    planId: row.plan_id,
    planName: row.plan_name,
    amount: parseFloat(row.amount),
    expiresAt: row.expires_at,
    status: row.status,
  };
}

/**
 * Handles GET /pay/:token scan:
 * 1. Hashes incoming raw token with SHA-256.
 * 2. Runs atomic conditional update:
 *    UPDATE payment_attempts SET status='processing' WHERE status='created' AND expires_at > now()
 * 3. If succeeded:
 *    - Emits Socket.IO 'payment:processing'
 *    - Triggers async server-side 2.5s wait and completes transaction.
 *    - Returns { success: true, planName, amount }.
 * 4. If failed:
 *    - Inspects state and returns { success: false, reason: 'used' | 'expired' | 'invalid' }.
 */
export async function handleScanToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return { success: false, reason: 'invalid' };
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  // Atomic conditional update
  const updateRes = await query(
    `UPDATE payment_attempts
     SET status = 'processing', updated_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1 AND status = 'created' AND expires_at > CURRENT_TIMESTAMP
     RETURNING id, partner_id, plan_id, amount, status, expires_at`,
    [tokenHash]
  );

  if (updateRes.rows.length === 1) {
    const attempt = updateRes.rows[0];
    const planRes = await query('SELECT name, duration_months FROM plans WHERE id = $1', [attempt.plan_id]);
    const planName = planRes.rows[0]?.name || 'Subscription Plan';
    const amount = parseFloat(attempt.amount);

    // Push Socket.IO event to that partner so their screen shows "Processing payment..."
    const io = getIo();
    if (io) {
      io.to(`partner:${attempt.partner_id}`).emit('payment:processing', {
        attemptId: attempt.id,
        partnerId: attempt.partner_id,
        planId: attempt.plan_id,
        planName,
        amount,
        status: 'processing',
      });
    }

    // Server-side 2.5s wait, then mark paid & create subscription in ONE transaction
    completePaymentAfterDelay(attempt.id, attempt.partner_id, attempt.plan_id, amount).catch((err) => {
      console.error(`[Payment Completion Error] Attempt ${attempt.id}:`, err);
    });

    return {
      success: true,
      planName,
      amount,
    };
  }

  // Atomic update matched 0 rows; determine failure reason
  const checkRes = await query(
    `SELECT id, status, expires_at FROM payment_attempts WHERE token_hash = $1`,
    [tokenHash]
  );

  if (checkRes.rows.length === 0) {
    return { success: false, reason: 'invalid' };
  }

  const row = checkRes.rows[0];
  const isPastExpiry = new Date(row.expires_at) <= new Date();

  if (row.status === 'processing' || row.status === 'paid' || row.status === 'cancelled') {
    return { success: false, reason: 'used' };
  }

  if (row.status === 'expired' || isPastExpiry) {
    return { success: false, reason: 'expired' };
  }

  return { success: false, reason: 'used' };
}

/**
 * Waits exactly 2.5 seconds on the server, then completes the payment and subscription creation.
 */
async function completePaymentAfterDelay(attemptId, partnerId, planId, lockedAmount) {
  // Exact 2.5s wait (never more than 3 seconds)
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await completePaymentAndCreateSubscription(attemptId);
}

/**
 * Atomically marks attempt 'paid' and creates subscription in ONE transaction.
 * Fully idempotent using payment_attempt_id unique constraint.
 */
export async function completePaymentAndCreateSubscription(attemptId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch attempt and lock row
    const attemptRes = await client.query(
      `SELECT id, partner_id, plan_id, amount, status FROM payment_attempts WHERE id = $1 FOR UPDATE`,
      [attemptId]
    );

    if (attemptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const attempt = attemptRes.rows[0];

    // If already paid and subscription exists, commit and return
    if (attempt.status === 'paid') {
      const existingSub = await client.query(
        `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
        [attemptId]
      );
      await client.query('COMMIT');
      return existingSub.rows[0] || null;
    }

    // 2. Fetch plan details
    const planRes = await client.query(
      `SELECT id, name, duration_months FROM plans WHERE id = $1`,
      [attempt.plan_id]
    );
    const plan = planRes.rows[0];
    const durationMonths = plan?.duration_months || 1;

    // 3. Mark attempt paid
    await client.query(
      `UPDATE payment_attempts
       SET status = 'paid', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [attemptId]
    );

    // 4. Calculate start_date and end_date (upgrade starts after current active plan expires)
    const existingSubRes = await client.query(
      `SELECT id, end_date
       FROM subscriptions
       WHERE partner_id = $1 AND status = 'active'
       ORDER BY end_date DESC
       LIMIT 1`,
      [attempt.partner_id]
    );

    const now = new Date();
    let startDate = now;
    if (existingSubRes.rows.length > 0) {
      const existingEnd = new Date(existingSubRes.rows[0].end_date);
      if (existingEnd > now) {
        startDate = existingEnd;
      }
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    // 5. Idempotent insert into subscriptions linked to payment_attempt_id
    let subRes = await client.query(
      `INSERT INTO subscriptions (
         partner_id, plan_id, price_paid, start_date, end_date, status, payment_attempt_id
       ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
       ON CONFLICT (payment_attempt_id) DO NOTHING
       RETURNING *`,
      [
        attempt.partner_id,
        attempt.plan_id,
        parseFloat(attempt.amount),
        startDate.toISOString(),
        endDate.toISOString(),
        attempt.id,
      ]
    );

    let subscription = subRes.rows[0];
    if (!subscription) {
      const existing = await client.query(
        `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
        [attempt.id]
      );
      subscription = existing.rows[0];
    }

    await client.query('COMMIT');

    // 6. Push Socket.IO 'payment:success' to partner
    const io = getIo();
    if (io) {
      io.to(`partner:${attempt.partner_id}`).emit('payment:success', {
        attemptId: attempt.id,
        partnerId: attempt.partner_id,
        planId: attempt.plan_id,
        planName: plan?.name,
        amount: parseFloat(attempt.amount),
        status: 'paid',
        subscription,
      });
    }

    return subscription;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * On server startup:
 * - Attempts left in 'processing' are completed (the scan already happened).
 * - Attempts past expires_at are marked expired.
 */
export async function recoverPaymentAttemptsOnStartup() {
  try {
    // 1. Mark expired created attempts
    const expiredRes = await query(
      `UPDATE payment_attempts
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'created' AND expires_at <= CURRENT_TIMESTAMP
       RETURNING id`
    );
    if (expiredRes.rowCount > 0) {
      console.log(`[Payment Recovery] Marked ${expiredRes.rowCount} past-expiry payment attempt(s) as 'expired'.`);
    }

    // 2. Complete processing attempts
    const processingRes = await query(
      `SELECT id, partner_id, plan_id FROM payment_attempts WHERE status = 'processing'`
    );

    for (const row of processingRes.rows) {
      console.log(`[Payment Recovery] Completing scanned payment attempt in processing state: ${row.id}`);
      await completePaymentAndCreateSubscription(row.id);
    }

    if (processingRes.rows.length > 0) {
      console.log(`[Payment Recovery] Successfully completed ${processingRes.rows.length} pending payment attempt(s).`);
    }
  } catch (err) {
    console.error('[Payment Recovery Error on Startup]:', err);
  }
}
