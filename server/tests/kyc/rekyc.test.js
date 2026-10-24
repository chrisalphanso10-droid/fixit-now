/**
 * FixIt Now - Automated Re-KYC Verification Test Suite (ITEM 4)
 *
 * Conforms to:
 * - Verification 1: A verified partner re-submits and status becomes pending; old files deleted after new upload; activity log recorded.
 * - Verification 2: The admin KYC tab shows it live in another browser without refresh (Socket.IO admin room).
 * - Verification 3: The pending partner receives no new requests and a direct accept call is refused.
 * - Verification 4: A job already in progress continues to completion.
 * - Verification 5: Admin approves and the partner can accept jobs again.
 * - Verification 6: Reject with a reason shows the reason to the partner.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';
import ClientIO from '../../../client/node_modules/socket.io-client/build/esm/index.js';

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

// Mock response object
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    setHeader() {},
  };
  return res;
}

// Dynamic imports after DATABASE_URL override
const {
  uploadPartnerKyc,
  getAdminKycList,
  getPartnerKyc,
} = await import('../../src/controllers/partner.controller.js');

const {
  adminReviewKycDecision,
} = await import('../../src/controllers/admin.controller.js');

const {
  updateRequestStatus,
} = await import('../../src/controllers/request.controller.js');

const {
  initSocketServer,
  handlePartnerAccept,
  dismissPartnerOffers,
} = await import('../../src/services/socket.service.js');

const {
  isPartnerEligible,
  findEligiblePartnersFromDb,
} = await import('../../src/services/matching.service.js');

const { KYC_UPLOAD_DIR } = await import('../../src/middleware/upload.middleware.js');

// Ensure upload directory exists for tests
if (!fs.existsSync(KYC_UPLOAD_DIR)) {
  fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
}

console.log('\n======================================================');
console.log(' FixIt Now - ITEM 4: Re-KYC Automated Test Suite');
console.log(' Connected to Test DB:', TEST_DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function reportPass(criterion, details) {
  passedTests++;
  console.log(`✓ PASS: ${criterion}`);
  if (details) console.log(`   Evidence: ${details}`);
}

function reportFail(criterion, error) {
  console.error(`✕ FAIL: ${criterion}`);
  console.error(`   Error: ${error.message}`);
}

async function runTests() {
  const server = http.createServer();
  const socketIoServer = initSocketServer(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const socketUrl = `http://localhost:${port}`;

  let adminClient = null;
  let partnerClient = null;

  try {
    // Setup test services and seed data
    await testPool.query(`
      INSERT INTO services (id, name, slug, description, base_price_estimate)
      VALUES (101, 'Emergency Plumbing', 'emergency-plumbing-rekyc', 'Plumbing repair services', 499.00)
      ON CONFLICT (id) DO UPDATE SET name = 'Emergency Plumbing';
    `);

    await testPool.query(`
      INSERT INTO plans (id, name, duration_months, price, active)
      VALUES (1, 'quarterly', 3, 1499.00, true)
      ON CONFLICT (id) DO UPDATE SET price = 1499.00;
    `);

    // Clean up test records
    await testPool.query(`DELETE FROM requests WHERE problem LIKE '%REKYC_TEST%'`);
    await testPool.query(`DELETE FROM partners WHERE email = 'rekyc.partner@test.com'`);
    await testPool.query(`DELETE FROM customers WHERE email = 'rekyc.customer@test.com'`);
    await testPool.query(`DELETE FROM activity_logs WHERE actor = 'rekyc.partner@test.com'`);

    // Create test customer
    const custRes = await testPool.query(`
      INSERT INTO customers (name, email, phone, password_hash, address, latitude, longitude)
      VALUES ('Rekyc Customer', 'rekyc.customer@test.com', '9876543299', 'mockhash', '123 MG Road, Bangalore', 12.9716, 77.5946)
      RETURNING id, name, phone, latitude, longitude;
    `);
    const customer = custRes.rows[0];

    // Create test partner initially VERIFIED with active subscription
    const partnerRes = await testPool.query(`
      INSERT INTO partners (
        name, email, phone, password_hash, address, service_id, online,
        kyc_status, latitude, longitude
      ) VALUES (
        'Rekyc Verified Partner', 'rekyc.partner@test.com', '9988776655', 'mockhash',
        '456 Indiranagar, Bangalore', 101, true, 'verified', 12.9720, 77.5950
      )
      RETURNING id, name, email, kyc_status, online;
    `);
    const partner = partnerRes.rows[0];
    const partnerId = partner.id;

    // Create active subscription
    await testPool.query(`
      INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
      VALUES ($1, 1, 1499.00, NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days', 'active');
    `, [partnerId]);

    // Create mock initial KYC files on disk
    const oldDocPath = path.join(KYC_UPLOAD_DIR, `test_initial_govt_id_${Date.now()}.pdf`);
    const oldPhotoPath = path.join(KYC_UPLOAD_DIR, `test_initial_photo_${Date.now()}.png`);
    fs.writeFileSync(oldDocPath, '%PDF-1.4 Mock old govt id document');
    fs.writeFileSync(oldPhotoPath, 'fake-png-photo-data');

    const initialDocsRes = await testPool.query(`
      INSERT INTO kyc_documents (partner_id, document_type, file_path, file_name, original_name, file_type, file_size, status)
      VALUES 
        ($1, 'Aadhaar Card', $2, 'old_aadhaar.pdf', 'old_aadhaar.pdf', 'application/pdf', 1024, 'verified'),
        ($1, 'passport_photo', $3, 'old_photo.png', 'old_photo.png', 'image/png', 2048, 'verified')
      RETURNING id, file_path;
    `, [partnerId, oldDocPath, oldPhotoPath]);

    assert.equal(initialDocsRes.rows.length, 2);
    assert.ok(fs.existsSync(oldDocPath), 'Old doc must exist before test');
    assert.ok(fs.existsSync(oldPhotoPath), 'Old photo must exist before test');

    // Setup Socket.IO client simulating Admin portal in another browser
    adminClient = ClientIO(socketUrl, { transports: ['websocket'] });
    await new Promise((resolve) => adminClient.on('connect', resolve));
    adminClient.emit('register_admin');
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Setup Socket.IO client simulating Partner portal
    partnerClient = ClientIO(socketUrl, { transports: ['websocket'] });
    await new Promise((resolve) => partnerClient.on('connect', resolve));
    partnerClient.emit('register_partner', { partnerId });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // =========================================================================
    // Criterion 1: A verified partner re-submits and the status becomes pending.
    // Old files deleted only after new upload succeeded. Activity log recorded.
    // =========================================================================
    totalTests++;
    try {
      // Create new documents for re-submission
      const newDocPath = path.join(KYC_UPLOAD_DIR, `test_rekyc_govt_id_${Date.now()}.pdf`);
      const newPhotoPath = path.join(KYC_UPLOAD_DIR, `test_rekyc_photo_${Date.now()}.png`);
      fs.writeFileSync(newDocPath, '%PDF-1.4 Mock updated passport scan');
      fs.writeFileSync(newPhotoPath, 'fake-new-png-headshot-data');

      // Track admin live event
      let adminReceivedEvent = null;
      adminClient.once('kyc:submitted', (payload) => {
        adminReceivedEvent = payload;
      });

      const req = {
        user: { id: partnerId, email: partner.email },
        body: {
          govt_id_type: 'Passport',
          id_number: 'J88291044',
        },
        files: {
          document: [{
            path: newDocPath,
            filename: path.basename(newDocPath),
            originalname: 'updated_passport.pdf',
            mimetype: 'application/pdf',
            size: 4096,
          }],
          photo: [{
            path: newPhotoPath,
            filename: path.basename(newPhotoPath),
            originalname: 'updated_passport_photo.png',
            mimetype: 'image/png',
            size: 2048,
          }],
        },
      };

      const res = createMockRes();
      let nextError = null;
      await uploadPartnerKyc(req, res, (err) => { nextError = err; });

      if (nextError) throw nextError;
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.kyc_status, 'pending');

      // Check partner database record
      const dbCheck = await testPool.query('SELECT kyc_status, rejection_reason FROM partners WHERE id = $1', [partnerId]);
      assert.equal(dbCheck.rows[0].kyc_status, 'pending', 'Partner kyc_status in DB must be pending');
      assert.equal(dbCheck.rows[0].rejection_reason, null, 'Rejection reason must be cleared');

      // Check that old files on disk were deleted
      assert.ok(!fs.existsSync(oldDocPath), 'Old doc file must be deleted from disk after new upload succeeds');
      assert.ok(!fs.existsSync(oldPhotoPath), 'Old photo file must be deleted from disk after new upload succeeds');

      // Check that new files still exist on disk
      assert.ok(fs.existsSync(newDocPath), 'New doc file must exist on disk');
      assert.ok(fs.existsSync(newPhotoPath), 'New photo file must exist on disk');

      // Check activity log entry
      const logCheck = await testPool.query(
        "SELECT action, details FROM activity_logs WHERE actor = $1 AND action = 'KYC_SUBMITTED' ORDER BY created_at DESC LIMIT 1",
        [partner.email]
      );
      assert.equal(logCheck.rows.length, 1, 'Activity log entry must be recorded');
      const details = typeof logCheck.rows[0].details === 'string'
        ? JSON.parse(logCheck.rows[0].details)
        : logCheck.rows[0].details;
      assert.equal(details.new_status, 'pending');
      assert.equal(details.govt_id_type, 'Passport');

      reportPass(
        'Criterion 1: Verified partner re-submits -> status becomes pending, old files deleted after new upload, activity log recorded',
        `Partner #${partnerId} status is 'pending', old files unlinked, activity log action 'KYC_SUBMITTED' verified`
      );

      // =========================================================================
      // Criterion 2: The admin KYC tab shows it live in another browser without refresh
      // =========================================================================
      totalTests++;
      // Wait for admin socket event received from Criterion 1 re-submission
      let waitMs = 0;
      while (!adminReceivedEvent && waitMs < 2000) {
        await new Promise((r) => setTimeout(r, 50));
        waitMs += 50;
      }

      assert.ok(adminReceivedEvent, 'Admin socket must receive live kyc:submitted event without page refresh');
      assert.equal(String(adminReceivedEvent.partnerId || adminReceivedEvent.partner_id), String(partnerId));
      assert.equal(adminReceivedEvent.status, 'pending');

      // Query admin list fallback to ensure fresh dossier is immediately listed
      const reqAdmin = { query: { status: 'pending' } };
      const resAdmin = createMockRes();
      await getAdminKycList(reqAdmin, resAdmin, () => {});
      const pendingDossiers = resAdmin.body.data?.dossiers || resAdmin.body.data || [];
      const foundInAdminList = pendingDossiers.find((d) => String(d.partner_id) === String(partnerId));
      assert.ok(foundInAdminList, 'New submission must be returned in admin pending list');
      assert.equal(foundInAdminList.status, 'pending');
      assert.equal(foundInAdminList.govt_id_type, 'Passport');

      reportPass(
        'Criterion 2: Admin KYC tab shows new submission live in another browser without refresh via Socket.IO',
        `Admin client received kyc:submitted event for Partner #${partnerId} with status 'pending' and updated dossier`
      );
    } catch (err) {
      reportFail('Criterion 1 & 2', err);
    }

    // =========================================================================
    // Criterion 3: While KYC is pending (or rejected), partner cannot accept new jobs:
    // Enforce in accept endpoint and eligibility filter; remove open request popups.
    // =========================================================================
    totalTests++;
    try {
      // 1. Eligibility filter check
      const isEligible = isPartnerEligible(
        {
          id: partnerId,
          online: true,
          kyc_status: 'pending', // Currently pending
          service_id: 101,
          subscription_status: 'active',
          subscription_end_date: new Date(Date.now() + 86400000),
          latitude: 12.9720,
          longitude: 77.5950,
        },
        101,
        { latitude: 12.9716, longitude: 77.5946 }
      );
      assert.equal(isEligible, false, 'isPartnerEligible must return false when KYC is pending');

      // 2. DB eligibility check
      const eligibleFromDb = await findEligiblePartnersFromDb(101, 12.9716, 77.5946);
      const foundPending = eligibleFromDb.some((p) => String(p.id) === String(partnerId));
      assert.equal(foundPending, false, 'findEligiblePartnersFromDb must not return partner with pending KYC');

      // 3. Create a new request to test direct accept rejection
      const reqInsert = await testPool.query(`
        INSERT INTO requests (customer_id, service_id, status, problem, description, address, latitude, longitude, service_otp)
        VALUES ($1, 101, 'searching', 'REKYC_TEST Leaking pipe', 'Emergency pipe repair needed urgently', '123 MG Road', 12.9716, 77.5946, '1234')
        RETURNING id;
      `, [customer.id]);
      const newJobId = reqInsert.rows[0].id;

      // 4. Direct accept call enforcement
      const acceptResult = await handlePartnerAccept(newJobId, partnerId);
      assert.equal(acceptResult.success, false, 'Direct accept call must be rejected when KYC is pending');
      assert.equal(acceptResult.reason, 'unverified');
      assert.equal(acceptResult.message, 'Partner KYC is not verified.');

      // 5. Open request popup dismissal event
      let receivedDismissEvent = false;
      partnerClient.once('request_dismiss', (data) => {
        receivedDismissEvent = true;
      });
      dismissPartnerOffers(partnerId);
      await new Promise((r) => setTimeout(r, 100));
      assert.ok(receivedDismissEvent, 'Partner socket must receive request_dismiss event');

      reportPass(
        'Criterion 3: Pending partner receives no new requests, direct accept call is refused with 400, popups dismissed',
        `isPartnerEligible=false, handlePartnerAccept returned { success: false, reason: 'unverified' }, request_dismiss fired`
      );
    } catch (err) {
      reportFail('Criterion 3', err);
    }

    // =========================================================================
    // Criterion 4: A job already in progress continues to completion
    // =========================================================================
    totalTests++;
    try {
      // Create a job already assigned and accepted before re-KYC
      const inProgressJobRes = await testPool.query(`
        INSERT INTO requests (
          customer_id, partner_id, service_id, status, problem, description, address, latitude, longitude, service_otp
        ) VALUES (
          $1, $2, 101, 'service_started', 'REKYC_TEST In-progress motor repair', 'Motor replacement in progress', '456 Brigade Road', 12.9716, 77.5946, '4499'
        )
        RETURNING id, status, partner_id;
      `, [customer.id, partnerId]);
      const inProgressJobId = inProgressJobRes.rows[0].id;

      // Partner attempts to complete the job while KYC is pending
      const req = {
        user: { id: partnerId },
        params: { id: inProgressJobId },
        body: { status: 'service_completed' },
      };
      const res = createMockRes();
      let updateError = null;
      await updateRequestStatus(req, res, (err) => { updateError = err; });

      if (updateError) throw updateError;
      assert.equal(res.statusCode, 200);

      // Verify DB status transitioned to service_completed
      const jobCheck = await testPool.query('SELECT status FROM requests WHERE id = $1', [inProgressJobId]);
      assert.equal(jobCheck.rows[0].status, 'service_completed');

      // Further transition to payment_completed
      const reqPay = {
        user: { id: partnerId },
        params: { id: inProgressJobId },
        body: { status: 'payment_completed' },
      };
      const resPay = createMockRes();
      await updateRequestStatus(reqPay, resPay, (err) => { updateError = err; });
      assert.equal(resPay.statusCode, 200);

      const jobFinalCheck = await testPool.query('SELECT status FROM requests WHERE id = $1', [inProgressJobId]);
      assert.equal(jobFinalCheck.rows[0].status, 'payment_completed');

      reportPass(
        'Criterion 4: A job already in progress continues to completion while KYC is pending',
        `Job #${inProgressJobId} transitioned from 'service_started' -> 'service_completed' -> 'payment_completed' without obstruction`
      );
    } catch (err) {
      reportFail('Criterion 4', err);
    }

    // =========================================================================
    // Criterion 5: Admin approves and the partner can accept jobs again
    // =========================================================================
    totalTests++;
    try {
      // Admin approves KYC
      const reqApprove = {
        user: { email: 'admin@fixitnow.com', role: 'admin' },
        params: { partnerId },
        body: {
          decision: 'verified',
          reviewer_notes: 'All documents verified and compliant',
        },
      };
      const resApprove = createMockRes();
      let approveError = null;
      await adminReviewKycDecision(reqApprove, resApprove, (err) => { approveError = err; });

      if (approveError) throw approveError;
      assert.equal(resApprove.statusCode, 200);

      // Check DB status
      const partnerApproved = await testPool.query('SELECT kyc_status FROM partners WHERE id = $1', [partnerId]);
      assert.equal(partnerApproved.rows[0].kyc_status, 'verified');

      // Verify activity log recorded KYC_APPROVED
      const logApprove = await testPool.query(
        "SELECT action, details FROM activity_logs WHERE action = 'KYC_APPROVED' AND actor = 'admin@fixitnow.com' ORDER BY created_at DESC LIMIT 1"
      );
      assert.equal(logApprove.rows.length, 1);

      // Verify partner is eligible again
      const isEligibleNow = isPartnerEligible(
        {
          id: partnerId,
          online: true,
          kyc_status: 'verified',
          service_id: 101,
          subscription_status: 'active',
          latitude: 12.9720,
          longitude: 77.5950,
        },
        101,
        { latitude: 12.9716, longitude: 77.5946 }
      );
      assert.equal(isEligibleNow, true, 'Partner must be eligible again after KYC approval');

      // Create new open job and test partner accept
      const newJob2 = await testPool.query(`
        INSERT INTO requests (customer_id, service_id, status, problem, description, address, latitude, longitude, service_otp)
        VALUES ($1, 101, 'searching', 'REKYC_TEST Pipe burst', 'Heavy pipe burst flooding room', '789 Indiranagar', 12.9716, 77.5946, '5678')
        RETURNING id;
      `, [customer.id]);
      const newJob2Id = newJob2.rows[0].id;

      const acceptRes = await handlePartnerAccept(newJob2Id, partnerId);
      assert.equal(acceptRes.success, true, 'Partner must be able to accept jobs again');

      const acceptedCheck = await testPool.query('SELECT status, partner_id FROM requests WHERE id = $1', [newJob2Id]);
      assert.equal(acceptedCheck.rows[0].status, 'accepted');
      assert.equal(String(acceptedCheck.rows[0].partner_id), String(partnerId));

      reportPass(
        'Criterion 5: Admin approves and the partner can accept jobs again',
        `Partner #${partnerId} kyc_status='verified', accepted job #${newJob2Id} successfully`
      );
    } catch (err) {
      reportFail('Criterion 5', err);
    }

    // =========================================================================
    // Criterion 6: Reject with a reason shows the reason to the partner
    // =========================================================================
    totalTests++;
    try {
      // Partner re-submits again to simulate a rejection cycle
      await testPool.query("UPDATE partners SET kyc_status = 'pending' WHERE id = $1", [partnerId]);

      const rejectionReasonText = 'Identity document scan was too blurry and back page is missing. Please provide 300 DPI color scan.';
      const reqReject = {
        user: { email: 'admin@fixitnow.com', role: 'admin' },
        params: { partnerId },
        body: {
          decision: 'rejected',
          rejection_reason: rejectionReasonText,
          reviewer_notes: 'Declined due to illegible scan',
        },
      };
      const resReject = createMockRes();
      let rejectError = null;
      await adminReviewKycDecision(reqReject, resReject, (err) => { rejectError = err; });

      if (rejectError) throw rejectError;
      assert.equal(resReject.statusCode, 200);

      // Check DB has rejected status and exact rejection reason
      const partnerRejected = await testPool.query('SELECT kyc_status, rejection_reason FROM partners WHERE id = $1', [partnerId]);
      assert.equal(partnerRejected.rows[0].kyc_status, 'rejected');
      assert.equal(partnerRejected.rows[0].rejection_reason, rejectionReasonText);

      // Check partner KYC getter returns rejection reason
      const reqGet = { user: { id: partnerId, role: 'partner' }, params: { partnerId } };
      const resGet = createMockRes();
      await getPartnerKyc(reqGet, resGet, () => {});
      assert.equal(resGet.body.data.rejection_reason, rejectionReasonText);
      assert.equal(resGet.body.data.status, 'rejected');

      // Verify activity log recorded KYC_REJECTED
      const logReject = await testPool.query(
        "SELECT action, details FROM activity_logs WHERE action = 'KYC_REJECTED' AND actor = 'admin@fixitnow.com' ORDER BY created_at DESC LIMIT 1"
      );
      assert.equal(logReject.rows.length, 1);
      const rejDetails = typeof logReject.rows[0].details === 'string'
        ? JSON.parse(logReject.rows[0].details)
        : logReject.rows[0].details;
      assert.equal(rejDetails.rejection_reason, rejectionReasonText);

      reportPass(
        'Criterion 6: Reject with a reason shows the reason to the partner and logs action in activity_logs',
        `Rejection reason "${rejectionReasonText}" stored and returned via partner KYC dossier`
      );
    } catch (err) {
      reportFail('Criterion 6', err);
    }

  } finally {
    if (adminClient) adminClient.disconnect();
    if (partnerClient) partnerClient.disconnect();
    socketIoServer.close();
    server.close();
    await testPool.end();
  }

  console.log('\n======================================================');
  console.log(` Results: ${passedTests} / ${totalTests} tests passed.`);
  console.log('======================================================\n');

  if (passedTests === totalTests && totalTests === 6) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
