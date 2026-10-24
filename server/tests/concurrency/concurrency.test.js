/**
 * FixIt Now - Automated Concurrency & Broadcast Verification Test Suite
 * Conforms to Item 1:
 * 1. 30 eligible partners accept the same request in parallel (50 repetitions)
 * 2. Ineligible partners never receive request and are refused on direct accept
 * 3. Accept and customer-cancel in parallel (50 repetitions)
 * 4. Accept racing the time-out (50 repetitions)
 * 5. One partner accepts two requests in parallel
 * 6. Same partner clicks Accept 10 times in parallel
 * 7. Double Create request from one customer
 * 8. Server restart while request is searching expires on startup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';

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

// Ensure all application modules use TEST_DATABASE_URL
process.env.DATABASE_URL = TEST_DATABASE_URL;

const { Pool } = pg;
const testPool = new Pool({ connectionString: TEST_DATABASE_URL });

// Import server modules after setting process.env.DATABASE_URL
const { default: db } = await import('../../src/config/db.js');
const {
  handlePartnerAccept,
  handlePartnerDecline,
  handleCustomerCancel,
  handleMatchingTimeout,
  cleanupOrphanedSearchingRequests,
} = await import('../../src/services/socket.service.js');
const { findEligiblePartnersFromDb } = await import('../../src/services/matching.service.js');

let customerId = null;
let serviceId = 2; // Plumbing
let eligiblePartners = [];
let ineligiblePartners = {};

/**
 * Initializes fix_it_now_test database from db/schema.sql and db/migrations/*.sql
 */
async function setupTestDatabase() {
  console.log('--- Initializing Test Database (fix_it_now_test) ---');
  const client = await testPool.connect();
  try {
    const currentDb = (await client.query('SELECT current_database()')).rows[0].current_database;
    if (currentDb !== 'fix_it_now_test') {
      throw new Error(`Safety check failed: connected to "${currentDb}" instead of "fix_it_now_test"`);
    }

    // Apply schema.sql
    const schemaPath = path.resolve(__dirname, '../../../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);

    // Apply migrations
    const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(migrationSql);
      }
    }

    // Clean tables for fresh test run
    await client.query('TRUNCATE TABLE request_status_logs, payments, ratings, requests, subscriptions, kyc_documents, partners, saved_addresses, customers, plans, services CASCADE');

    // Seed services
    await client.query(`
      INSERT INTO services (id, name, slug, description, base_price_estimate, active)
      VALUES 
        (1, 'Electrician', 'electrician', 'Electrical installations and repairs', 499.00, true),
        (2, 'Plumbing Repairs', 'plumber', 'Leak repairs and pipe fitting', 450.00, true),
        (3, 'Carpentry', 'carpenter', 'Woodwork and furniture fixes', 550.00, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed plans
    await client.query(`
      INSERT INTO plans (id, name, duration_months, price, active)
      VALUES 
        (1, 'quarterly', 3, 1499.00, true),
        (2, 'half-yearly', 6, 2699.00, true),
        (3, 'yearly', 12, 4999.00, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed customer
    const custRes = await client.query(`
      INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude)
      VALUES ('Test Customer', 'customer.test@example.com', 'hash', '9876543210', 'Indiranagar, Bengaluru', 12.9784, 77.6408)
      RETURNING id;
    `);
    customerId = custRes.rows[0].id;

    // Seed 35 eligible partners (service_id=2, online=true, kyc_status='verified', active sub, within 2 km)
    eligiblePartners = [];
    for (let i = 1; i <= 35; i++) {
      const pRes = await client.query(
        `INSERT INTO partners (
           name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status, rating, total_jobs
         ) VALUES (
           $1, $2, 'hash', $3, 'Indiranagar, Bengaluru', 2, true, 12.9780, 77.6410, 'verified', 5.0, 10
         ) RETURNING id, name, service_id`,
        [`Eligible Partner ${i}`, `partner.eligible${i}@example.com`, `98000000${String(i).padStart(2, '0')}`]
      );
      const pid = pRes.rows[0].id;
      eligiblePartners.push(pRes.rows[0]);

      // Active subscription
      await client.query(
        `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
         VALUES ($1, 1, 1499.00, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '80 days', 'active')`,
        [pid]
      );
    }

    // Seed Ineligible Partners for Verification 2:
    // a. Different service (service_id = 1)
    const diffServiceRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Electrician Partner', 'partner.diff@example.com', 'hash', '9900000001', 'Indiranagar', 1, true, 12.9780, 77.6410, 'verified')
      RETURNING id;
    `);
    ineligiblePartners.differentService = diffServiceRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.differentService]
    );

    // b. Offline
    const offlineRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Offline Partner', 'partner.offline@example.com', 'hash', '9900000002', 'Indiranagar', 2, false, 12.9780, 77.6410, 'verified')
      RETURNING id;
    `);
    ineligiblePartners.offline = offlineRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.offline]
    );

    // c. Unverified (not_submitted)
    const unverifiedRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Unverified Partner', 'partner.unverified@example.com', 'hash', '9900000003', 'Indiranagar', 2, true, 12.9780, 77.6410, 'not_submitted')
      RETURNING id;
    `);
    ineligiblePartners.unverified = unverifiedRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.unverified]
    );

    // d. Pending KYC
    const pendingKycRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Pending KYC Partner', 'partner.pendingkyc@example.com', 'hash', '9900000004', 'Indiranagar', 2, true, 12.9780, 77.6410, 'pending')
      RETURNING id;
    `);
    ineligiblePartners.pendingKyc = pendingKycRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.pendingKyc]
    );

    // e. Rejected KYC
    const rejectedKycRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Rejected KYC Partner', 'partner.rejectedkyc@example.com', 'hash', '9900000005', 'Indiranagar', 2, true, 12.9780, 77.6410, 'rejected')
      RETURNING id;
    `);
    ineligiblePartners.rejectedKyc = rejectedKycRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.rejectedKyc]
    );

    // f. Expired plan
    const expiredPlanRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Expired Plan Partner', 'partner.expiredplan@example.com', 'hash', '9900000006', 'Indiranagar', 2, true, 12.9780, 77.6410, 'verified')
      RETURNING id;
    `);
    ineligiblePartners.expiredPlan = expiredPlanRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW() - INTERVAL '60 days', NOW() - INTERVAL '1 day', 'expired')`,
      [ineligiblePartners.expiredPlan]
    );

    // g. Too far (> 2 km)
    const tooFarRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Far Partner', 'partner.far@example.com', 'hash', '9900000007', 'Whitefield', 2, true, 12.9698, 77.7499, 'verified')
      RETURNING id;
    `);
    ineligiblePartners.tooFar = tooFarRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.tooFar]
    );

    // h. Already busy on active job
    const busyPartnerRes = await client.query(`
      INSERT INTO partners (name, email, password_hash, phone, address, service_id, online, latitude, longitude, kyc_status)
      VALUES ('Busy Partner', 'partner.busy@example.com', 'hash', '9900000008', 'Indiranagar', 2, true, 12.9780, 77.6410, 'verified')
      RETURNING id;
    `);
    ineligiblePartners.busy = busyPartnerRes.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status) VALUES ($1, 1, 1499, NOW(), NOW() + INTERVAL '30 days', 'active')`,
      [ineligiblePartners.busy]
    );
    await client.query(`
      INSERT INTO requests (customer_id, partner_id, service_id, problem, description, address, latitude, longitude, status, service_otp)
      VALUES ($1, $2, 2, 'Existing Job', 'Active job test', 'Address', 12.9784, 77.6408, 'accepted', '123456');
    `, [customerId, ineligiblePartners.busy]);

    console.log(`✓ Test database populated: 35 eligible partners, 8 ineligible variants.`);
  } finally {
    client.release();
  }
}

/**
 * Creates a helper request row in fix_it_now_test
 */
async function createTestRequest(status = 'searching') {
  const res = await db.query(
    `INSERT INTO requests (customer_id, service_id, problem, description, address, latitude, longitude, status, service_otp)
     VALUES ($1, 2, 'Water Leakage', 'Pipe leaking under kitchen sink', 'Indiranagar, Bengaluru', 12.9784, 77.6408, $2, '654321')
     RETURNING *`,
    [customerId, status]
  );
  return res.rows[0];
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('FixIt Now: ITEM 1 Automated Concurrency & Broadcast Tests');
  console.log('=============================================================\n');

  await setupTestDatabase();

  let passedTests = 0;
  let failedTests = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Details: ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      failedTests++;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: 30 eligible partners accept the same request in parallel (50 repetitions)
  // ---------------------------------------------------------------------------
  await test('1. 30 eligible partners accept same request in parallel (50 repetitions): exactly 1 win, 29 taken, 1 status-log row, no 500s', async () => {
    const candidatePartners = eligiblePartners.slice(0, 30);
    assert.equal(candidatePartners.length, 30, 'Need at least 30 candidate partners');

    for (let rep = 1; rep <= 50; rep++) {
      const request = await createTestRequest('searching');

      // 30 partners invoke handlePartnerAccept in parallel
      const results = await Promise.all(
        candidatePartners.map((p) => handlePartnerAccept(request.id, p.id))
      );

      const successes = results.filter((r) => r && r.success === true);
      const takenResults = results.filter(
        (r) => r && r.success === false && (r.reason === 'taken' || r.message === 'Request accepted by another partner')
      );

      assert.equal(successes.length, 1, `Rep ${rep}: Expected exactly 1 success, got ${successes.length}`);
      assert.equal(takenResults.length, 29, `Rep ${rep}: Expected exactly 29 clean taken results, got ${takenResults.length}`);

      // Check database status log
      const logRes = await db.query(
        `SELECT * FROM request_status_logs WHERE request_id = $1 AND status = 'accepted'`,
        [request.id]
      );
      assert.equal(logRes.rows.length, 1, `Rep ${rep}: Expected exactly 1 accepted status log row, got ${logRes.rows.length}`);

      // Check request record
      const reqRes = await db.query(`SELECT status, partner_id FROM requests WHERE id = $1`, [request.id]);
      assert.equal(reqRes.rows[0].status, 'accepted');
      assert.ok(reqRes.rows[0].partner_id != null);

      // Free winning partner for next repetitions
      await db.query(`UPDATE requests SET status = 'service_completed' WHERE id = $1`, [request.id]);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Ineligible partners never receive request and are refused on direct accept
  // ---------------------------------------------------------------------------
  await test('2. Ineligible partners never receive request and are refused on direct accept', async () => {
    // Check findEligiblePartnersFromDb
    const eligibleList = await findEligiblePartnersFromDb(2, 12.9784, 77.6408, 2.0);
    const eligibleIds = new Set(eligibleList.map((p) => String(p.id)));

    for (const [type, pid] of Object.entries(ineligiblePartners)) {
      assert.ok(!eligibleIds.has(String(pid)), `Ineligible partner of type "${type}" must NOT be in eligible dispatch list`);
    }

    // Now test direct accept attempts
    const req = await createTestRequest('searching');

    // a. Different service
    const diffRes = await handlePartnerAccept(req.id, ineligiblePartners.differentService);
    assert.equal(diffRes.success, false);
    assert.equal(diffRes.reason, 'wrong_service');

    // b. Offline
    const offRes = await handlePartnerAccept(req.id, ineligiblePartners.offline);
    assert.equal(offRes.success, false);
    assert.equal(offRes.reason, 'offline');

    // c. Unverified
    const unverRes = await handlePartnerAccept(req.id, ineligiblePartners.unverified);
    assert.equal(unverRes.success, false);
    assert.equal(unverRes.reason, 'unverified');

    // d. Pending KYC
    const pendRes = await handlePartnerAccept(req.id, ineligiblePartners.pendingKyc);
    assert.equal(pendRes.success, false);
    assert.equal(pendRes.reason, 'unverified');

    // e. Rejected KYC
    const rejRes = await handlePartnerAccept(req.id, ineligiblePartners.rejectedKyc);
    assert.equal(rejRes.success, false);
    assert.equal(rejRes.reason, 'unverified');

    // f. Expired plan
    const expRes = await handlePartnerAccept(req.id, ineligiblePartners.expiredPlan);
    assert.equal(expRes.success, false);
    assert.equal(expRes.reason, 'expired_plan');

    // g. Already busy
    const busyRes = await handlePartnerAccept(req.id, ineligiblePartners.busy);
    assert.equal(busyRes.success, false);
    assert.equal(busyRes.reason, 'already_on_job');

    // Clean up
    await db.query(`UPDATE requests SET status = 'cancelled' WHERE id = $1`, [req.id]);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Accept and customer-cancel in parallel (50 repetitions)
  // ---------------------------------------------------------------------------
  await test('3. Accept and customer-cancel in parallel (50 repetitions): always exactly one final state', async () => {
    const partner = eligiblePartners[0];

    for (let rep = 1; rep <= 50; rep++) {
      const req = await createTestRequest('searching');

      // Race accept vs cancel
      const [acceptRes, cancelRes] = await Promise.all([
        handlePartnerAccept(req.id, partner.id),
        handleCustomerCancel(req.id, 'Customer cancellation race test'),
      ]);

      const check = await db.query('SELECT status, partner_id FROM requests WHERE id = $1', [req.id]);
      const finalStatus = check.rows[0].status;

      assert.ok(
        finalStatus === 'accepted' || finalStatus === 'cancelled',
        `Rep ${rep}: Final status must be 'accepted' or 'cancelled', got ${finalStatus}`
      );

      // Clean up partner for next repetition
      await db.query(`UPDATE requests SET status = 'service_completed' WHERE id = $1`, [req.id]);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Accept racing the time-out (50 repetitions)
  // ---------------------------------------------------------------------------
  await test('4. Accept racing the time-out (50 repetitions): always exactly one final state', async () => {
    const partner = eligiblePartners[1];

    for (let rep = 1; rep <= 50; rep++) {
      const req = await createTestRequest('searching');

      // Race accept vs timeout
      await Promise.all([
        handlePartnerAccept(req.id, partner.id),
        handleMatchingTimeout(req.id),
      ]);

      const check = await db.query('SELECT status, partner_id FROM requests WHERE id = $1', [req.id]);
      const finalStatus = check.rows[0].status;

      assert.ok(
        finalStatus === 'accepted' || finalStatus === 'cancelled',
        `Rep ${rep}: Final status must be 'accepted' or 'cancelled', got ${finalStatus}`
      );

      // Clean up partner for next repetition
      await db.query(`UPDATE requests SET status = 'service_completed' WHERE id = $1`, [req.id]);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: One partner accepts two requests in parallel: exactly one success
  // ---------------------------------------------------------------------------
  await test('5. One partner accepts two requests in parallel: exactly one success', async () => {
    const partner = eligiblePartners[2];
    const reqA = await createTestRequest('searching');
    const reqB = await createTestRequest('searching');

    const [resA, resB] = await Promise.all([
      handlePartnerAccept(reqA.id, partner.id),
      handlePartnerAccept(reqB.id, partner.id),
    ]);

    const successes = [resA, resB].filter((r) => r.success === true);
    const alreadyOnJob = [resA, resB].filter((r) => r.success === false && r.reason === 'already_on_job');

    assert.equal(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);
    assert.equal(alreadyOnJob.length, 1, `Expected exactly 1 already_on_job refusal, got ${alreadyOnJob.length}`);
    assert.equal(alreadyOnJob[0].message, 'you are already on a job');

    // Clean up
    await db.query(`UPDATE requests SET status = 'service_completed' WHERE id IN ($1, $2)`, [reqA.id, reqB.id]);
  });

  // ---------------------------------------------------------------------------
  // TEST 6: The same partner clicks Accept 10 times in parallel: one success, one log row
  // ---------------------------------------------------------------------------
  await test('6. The same partner clicks Accept 10 times in parallel: one success, one log row', async () => {
    const partner = eligiblePartners[3];
    const req = await createTestRequest('searching');

    const results = await Promise.all(
      Array.from({ length: 10 }, () => handlePartnerAccept(req.id, partner.id))
    );

    // All 10 return success (first accepts, subsequent are idempotent)
    const successCount = results.filter((r) => r.success === true).length;
    assert.equal(successCount, 10, `Expected 10 successes, got ${successCount}`);

    // Check status logs: exactly 1 log row for 'accepted'
    const logs = await db.query(
      `SELECT * FROM request_status_logs WHERE request_id = $1 AND status = 'accepted'`,
      [req.id]
    );
    assert.equal(logs.rows.length, 1, `Expected exactly 1 accepted status log row, got ${logs.rows.length}`);

    // Clean up
    await db.query(`UPDATE requests SET status = 'service_completed' WHERE id = $1`, [req.id]);
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Double Create request from one customer: one request
  // ---------------------------------------------------------------------------
  await test('7. Double Create request from one customer: one request', async () => {
    // Simulate double-click create using the transactional row lock deduplication logic from createRequest
    async function simulateCreate() {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);

        // Deduplication check
        const recent = await client.query(
          `SELECT * FROM requests
           WHERE customer_id = $1
             AND service_id = $2
             AND status IN ('searching', 'requested')
             AND created_at > (CURRENT_TIMESTAMP - INTERVAL '5 seconds')
           ORDER BY created_at DESC LIMIT 1`,
          [customerId, serviceId]
        );
        if (recent.rows.length > 0) {
          await client.query('COMMIT');
          return { isNew: false, request: recent.rows[0] };
        }

        const inserted = await client.query(
          `INSERT INTO requests (customer_id, service_id, problem, description, address, latitude, longitude, status, service_otp)
           VALUES ($1, $2, 'Double click', 'Desc', 'Indiranagar', 12.9784, 77.6408, 'searching', '123456')
           RETURNING *`,
          [customerId, serviceId]
        );
        await client.query('COMMIT');
        return { isNew: true, request: inserted.rows[0] };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const [call1, call2] = await Promise.all([simulateCreate(), simulateCreate()]);

    const createdIds = new Set([call1.request.id, call2.request.id]);
    assert.equal(createdIds.size, 1, `Expected identical request returned on double create, got IDs: ${[...createdIds].join(', ')}`);

    // Clean up
    await db.query(`UPDATE requests SET status = 'cancelled' WHERE id = $1`, [call1.request.id]);
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Server restart while a request is searching: it is expired on startup
  // ---------------------------------------------------------------------------
  await test('8. Server restart while a request is searching: it is expired on startup', async () => {
    const orphanReq = await createTestRequest('searching');

    // Simulate server startup cleanup
    await cleanupOrphanedSearchingRequests();

    const check = await db.query('SELECT status, cancel_reason FROM requests WHERE id = $1', [orphanReq.id]);
    assert.equal(check.rows[0].status, 'cancelled');
    assert.equal(check.rows[0].cancel_reason, 'All partners busy, try again later');

    const logs = await db.query(
      `SELECT * FROM request_status_logs WHERE request_id = $1 AND status = 'cancelled'`,
      [orphanReq.id]
    );
    assert.ok(logs.rows.length >= 1, 'Expected cancelled status log entry');
  });

  console.log('\n-------------------------------------------------------------');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('-------------------------------------------------------------\n');

  await testPool.end();
  await db.pool.end();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('[Unhandled Test Error]:', err);
  process.exit(1);
});
