/**
 * FixIt Now - Automated Payment & QR Verification Test Suite (ITEM 3)
 *
 * Verifies all criteria of Item 3 against TEST_DATABASE_URL:
 * 1. QR text decodes to PUBLIC_BASE_URL/pay/<token>, shows fake UPI ID, plan, amount & countdown.
 * 2. Opening link once: processing wait (2.5s), success, exactly one subscription with locked price.
 * 3. Opening same link again (and 20 parallel opens): exactly one succeeds, others show "This QR was already used", exactly one subscription.
 * 4. Expired link and random invalid token show their messages with no 500 error.
 * 5. New QR cancels the old one, old link no longer works.
 * 6. Admin plan price change after QR creation does not change locked attempt amount; next QR uses new price.
 * 7. Closing partner's tab right after scan: subscription is still created, reopening shows success.
 * 8. Restarting server during processing: attempt completed on startup, one subscription, no duplicates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Verify TEST_DATABASE_URL
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  console.error('\n[FATAL] TEST_DATABASE_URL is missing from server/.env!');
  console.error('Tests must never run against the real database. Please configure TEST_DATABASE_URL in server/.env.\n');
  process.exit(1);
}

// Ensure all modules use TEST_DATABASE_URL
process.env.DATABASE_URL = TEST_DATABASE_URL;

const { Pool } = pg;
const testPool = new Pool({ connectionString: TEST_DATABASE_URL });

// Import payment service & controllers
const {
  createPaymentAttempt,
  getActivePaymentAttempt,
  handleScanToken,
  completePaymentAndCreateSubscription,
  recoverPaymentAttemptsOnStartup,
} = await import('../../src/services/payment.service.js');

const { renderPayPage } = await import('../../src/controllers/payment.controller.js');
const { default: config } = await import('../../src/config/index.js');

function createMockReqRes(token) {
  const req = {
    params: { token },
    ip: '127.0.0.1',
  };
  const res = {
    statusCode: 200,
    sentHtml: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(html) {
      this.sentHtml = html;
      return this;
    },
  };
  return { req, res };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' FixIt Now - ITEM 3: QR Subscription Payment Test Suite');
  console.log(' Connected to Test DB:', TEST_DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // Ensure test partner and service exist
  let partnerId = null;
  const pCheck = await testPool.query(`SELECT id FROM partners LIMIT 1`);
  if (pCheck.rows.length > 0) {
    partnerId = pCheck.rows[0].id;
  } else {
    const sRes = await testPool.query(`SELECT id FROM services LIMIT 1`);
    const sId = sRes.rows[0].id;
    const ins = await testPool.query(
      `INSERT INTO partners (name, email, phone, address, password_hash, service_id)
       VALUES ('QR Test Partner', 'qrtest@fixitnow.local', '9988776655', 'Test Rd, BLR', 'hash', $1)
       RETURNING id`,
      [sId]
    );
    partnerId = ins.rows[0].id;
  }

  // --- CRITERION 1: QR text decodes to PUBLIC_BASE_URL/pay/<token> & shows fake UPI ID, plan, amount & countdown ---
  await test('Criterion 1: QR text decodes to PUBLIC_BASE_URL/pay/<token>, returns fake UPI ID, plan, locked amount', async () => {
    const attempt = await createPaymentAttempt(partnerId, 1);
    const expectedBase = (config.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

    assert.ok(attempt.scanUrl.startsWith(`${expectedBase}/pay/`));
    assert.equal(attempt.scanUrl, `${expectedBase}/pay/${attempt.token}`);
    assert.equal(attempt.token.length, 64); // 32 random bytes in hex
    assert.ok(attempt.upiId);
    const plan1Res = await testPool.query(`SELECT price FROM plans WHERE id = 1`);
    const expectedPlan1Price = parseFloat(plan1Res.rows[0].price);
    assert.equal(attempt.amount, expectedPlan1Price);
    assert.equal(attempt.status, 'created');
    assert.ok(new Date(attempt.expiresAt) > new Date());

    // UI code check for both first purchase and upgrade screens
    const modalPath = path.resolve(__dirname, '../../../client/src/components/partner/QrPaymentModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert.ok(modalContent.includes('QR expires in'), 'Modal displays "QR expires in mm:ss"');
    assert.ok(modalContent.includes('UPI ID:'), 'Modal displays UPI ID');
    assert.ok(modalContent.includes('COPY'), 'Modal includes copy button for UPI ID');
    assert.ok(modalContent.includes('↻ New QR') || modalContent.includes('New QR'), 'Modal includes "New QR" button');
    assert.ok(modalContent.includes('Processing payment...'), 'Modal includes "Processing payment..."');
    assert.ok(modalContent.includes('Payment successful'), 'Modal includes "Payment successful"');

    const planSelectionPath = path.resolve(__dirname, '../../../client/src/pages/partner/PlanSelectionView.jsx');
    const planSelectionContent = fs.readFileSync(planSelectionPath, 'utf8');
    assert.ok(planSelectionContent.includes('QrPaymentModal'), 'PlanSelectionView uses QrPaymentModal for first purchase');

    const planDetailsPath = path.resolve(__dirname, '../../../client/src/pages/partner/PlanDetailsView.jsx');
    const planDetailsContent = fs.readFileSync(planDetailsPath, 'utf8');
    assert.ok(planDetailsContent.includes('QrPaymentModal'), 'PlanDetailsView uses QrPaymentModal for upgrade/extension');
  });

  // --- CRITERION 2: Opening the link once shows processing then success, and creates exactly one subscription ---
  await test('Criterion 2: Opening link once processes and creates exactly one subscription with locked price', async () => {
    const plan2Res = await testPool.query(`SELECT price FROM plans WHERE id = 2`);
    const expectedPlan2Price = parseFloat(plan2Res.rows[0].price);
    const attempt = await createPaymentAttempt(partnerId, 2);
    const scanResult = await handleScanToken(attempt.token);

    assert.equal(scanResult.success, true);
    assert.equal(scanResult.amount, expectedPlan2Price);

    // Wait for the server 2.5s delay to complete
    await new Promise((resolve) => setTimeout(resolve, 2800));

    // Verify payment attempt status is 'paid'
    const dbAttempt = await testPool.query(`SELECT status FROM payment_attempts WHERE id = $1`, [attempt.attemptId]);
    assert.equal(dbAttempt.rows[0].status, 'paid');

    // Verify subscription created with locked price and unique link
    const subRes = await testPool.query(
      `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
      [attempt.attemptId]
    );
    assert.equal(subRes.rows.length, 1);
    assert.equal(parseFloat(subRes.rows[0].price_paid), expectedPlan2Price);
    assert.equal(subRes.rows[0].status, 'active');
  });

  // --- CRITERION 3: Opening the same link again (and 20 parallel opens) ---
  await test('Criterion 3: 20 parallel opens of the same link -> exactly one succeeds, others get "This QR was already used"', async () => {
    const attempt = await createPaymentAttempt(partnerId, 1);

    // 20 parallel requests to handleScanToken
    const promises = Array.from({ length: 20 }, () => handleScanToken(attempt.token));
    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success === true);
    const alreadyUsed = results.filter((r) => r.success === false && r.reason === 'used');

    assert.equal(successful.length, 1, 'Exactly one scan succeeded');
    assert.equal(alreadyUsed.length, 19, '19 parallel scans returned reason: "used"');

    // Wait for server-side completion
    await new Promise((resolve) => setTimeout(resolve, 2800));

    // Verify exactly one subscription exists
    const subRes = await testPool.query(
      `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
      [attempt.attemptId]
    );
    assert.equal(subRes.rows.length, 1, 'Exactly one subscription created');

    // Subsequent single scan also returns "This QR was already used"
    const { req, res } = createMockReqRes(attempt.token);
    await renderPayPage(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.sentHtml.includes('This QR was already used'));
  });

  // --- CRITERION 4: Expired link and random invalid token show their messages with no 500 ---
  await test('Criterion 4: Expired link and random invalid token show clear messages with no 500', async () => {
    // 1. Expired link
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes in the past

    await testPool.query(
      `INSERT INTO payment_attempts (partner_id, plan_id, amount, status, token_hash, expires_at)
       VALUES ($1, 1, 899.0, 'expired', $2, $3)`,
      [partnerId, tokenHash, pastDate.toISOString()]
    );

    const { req: req1, res: res1 } = createMockReqRes(rawToken);
    await renderPayPage(req1, res1);
    assert.equal(res1.statusCode, 200, 'Expired QR returns HTTP 200');
    assert.ok(res1.sentHtml.includes('This QR has expired'), 'Renders "This QR has expired"');

    // 2. Random invalid token
    const randomToken = crypto.randomBytes(32).toString('hex');
    const { req: req2, res: res2 } = createMockReqRes(randomToken);
    await renderPayPage(req2, res2);
    assert.equal(res2.statusCode, 200, 'Invalid QR returns HTTP 200');
    assert.ok(res2.sentHtml.includes('Invalid QR'), 'Renders "Invalid QR"');
  });

  // --- CRITERION 5: New QR cancels the old one, and old link no longer works ---
  await test('Criterion 5: New QR cancels the old one and old link no longer works', async () => {
    const attempt1 = await createPaymentAttempt(partnerId, 1);
    const attempt2 = await createPaymentAttempt(partnerId, 1); // Triggers cancellation of attempt 1

    // Verify attempt 1 is marked 'cancelled'
    const a1Db = await testPool.query(`SELECT status FROM payment_attempts WHERE id = $1`, [attempt1.attemptId]);
    assert.equal(a1Db.rows[0].status, 'cancelled');

    // Attempting to scan attempt 1 token fails with 'used' message
    const scan1 = await handleScanToken(attempt1.token);
    assert.equal(scan1.success, false);
    assert.equal(scan1.reason, 'used');

    const { req, res } = createMockReqRes(attempt1.token);
    await renderPayPage(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.sentHtml.includes('This QR was already used'));

    // Attempting to scan attempt 2 token succeeds
    const scan2 = await handleScanToken(attempt2.token);
    assert.equal(scan2.success, true);
  });

  // --- CRITERION 6: Admin price change does not change locked attempt amount; next QR uses new price ---
  await test('Criterion 6: Admin plan price change does not alter locked attempt amount; next QR uses new price', async () => {
    // 1. Create attempt at original price (e.g. ₹899 for Quarterly)
    const originalPlanRes = await testPool.query(`SELECT price FROM plans WHERE id = 1`);
    const origPrice = parseFloat(originalPlanRes.rows[0].price);

    const attempt1 = await createPaymentAttempt(partnerId, 1);
    assert.equal(attempt1.amount, origPrice);

    // 2. Simulate Admin changing plan price
    const newPrice = origPrice + 100.0;
    await testPool.query(`UPDATE plans SET price = $1 WHERE id = 1`, [newPrice]);

    // 3. Verify attempt1 still has locked original amount in database
    const a1Db = await testPool.query(`SELECT amount FROM payment_attempts WHERE id = $1`, [attempt1.attemptId]);
    assert.equal(parseFloat(a1Db.rows[0].amount), origPrice, 'Existing attempt amount is locked at original price');

    // 4. Create new attempt; it must lock the updated price
    const attempt2 = await createPaymentAttempt(partnerId, 1);
    assert.equal(attempt2.amount, newPrice, 'Next attempt locks the newly updated price');

    // Revert plan price
    await testPool.query(`UPDATE plans SET price = $1 WHERE id = 1`, [origPrice]);
  });

  // --- CRITERION 7: Closing partner tab right after scan: subscription is still created ---
  await test('Criterion 7: Closing partner tab right after scan still creates subscription, and reopening shows success', async () => {
    const attempt = await createPaymentAttempt(partnerId, 3); // 12 months, ₹2799
    const scanResult = await handleScanToken(attempt.token);
    assert.equal(scanResult.success, true);

    // Simulate partner closing tab immediately (no active socket/browser)
    // Wait for server background completion (2.5s)
    await new Promise((resolve) => setTimeout(resolve, 2800));

    // Partner terminal reconnects and queries active payment attempt
    const activeAttempt = await getActivePaymentAttempt(partnerId, 3);
    assert.equal(activeAttempt.status, 'paid');

    // Verify subscription was created
    const subRes = await testPool.query(
      `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
      [attempt.attemptId]
    );
    assert.equal(subRes.rows.length, 1);
    const plan3Res = await testPool.query(`SELECT price FROM plans WHERE id = 3`);
    assert.equal(parseFloat(subRes.rows[0].price_paid), parseFloat(plan3Res.rows[0].price));
  });

  // --- CRITERION 8: Server restart during processing: attempt completed on startup ---
  await test('Criterion 8: Server restart during processing completes attempt on startup with zero duplicate subscriptions', async () => {
    // 1. Create attempt and simulate server crash while in 'processing' state
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const insRes = await testPool.query(
      `INSERT INTO payment_attempts (partner_id, plan_id, amount, status, token_hash, expires_at)
       VALUES ($1, 1, 899.0, 'processing', $2, $3)
       RETURNING id`,
      [partnerId, tokenHash, expiresAt.toISOString()]
    );
    const interruptedAttemptId = insRes.rows[0].id;

    // 2. Simulate server restart: invoke recoverPaymentAttemptsOnStartup()
    await recoverPaymentAttemptsOnStartup();

    // 3. Verify attempt status is now 'paid'
    const checkAttempt = await testPool.query(
      `SELECT status FROM payment_attempts WHERE id = $1`,
      [interruptedAttemptId]
    );
    assert.equal(checkAttempt.rows[0].status, 'paid');

    // 4. Verify subscription was created exactly once
    const subRes = await testPool.query(
      `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
      [interruptedAttemptId]
    );
    assert.equal(subRes.rows.length, 1, 'Exactly one subscription created on restart recovery');

    // 5. Running recovery again is completely idempotent
    await recoverPaymentAttemptsOnStartup();
    const subResAgain = await testPool.query(
      `SELECT * FROM subscriptions WHERE payment_attempt_id = $1`,
      [interruptedAttemptId]
    );
    assert.equal(subResAgain.rows.length, 1, 'Zero duplicate subscriptions on subsequent recovery');
  });

  console.log('\n======================================================');
  console.log(` Results: ${passed} / ${total} tests passed.`);
  console.log('======================================================\n');

  await testPool.end();
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
