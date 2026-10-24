/**
 * FixIt Now - Automated Terms & Conditions Verification Test Suite (ITEM 2)
 *
 * Verifies:
 * (1) Registration is impossible in the UI without ticking (static & behavioral check).
 * (2) Direct API call without terms_accepted is rejected (for both customer & partner).
 * (3) After registering, the database record has terms_accepted_at and terms_version ('1.0').
 * (4) Each portal shows its own verbatim terms and conditions text.
 * (5) Existing accounts with NULL terms_accepted_at can still log in without issue.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

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

// Import controllers after DATABASE_URL is set
const {
  registerCustomer,
  loginCustomer,
  registerPartner,
  loginPartner,
} = await import('../../src/controllers/auth.controller.js');

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
  };
  return res;
}

const CUSTOMER_TERMS = [
  '1. I confirm that the details I provide are genuine and that I am registering only to get a real problem fixed.',
  '2. I have no bad or harmful intentions toward any partner, their property or anyone else.',
  '3. I will treat partners respectfully and give accurate information about the problem and the address.',
  '4. I understand that FixIt Now is a platform that connects customers with independent partners. FixIt Now is not responsible for the conduct of any customer or partner, or for any loss, damage or dispute that arises between them. By accepting these terms, I accept responsibility for my own actions and agree that any issue is between me and the partner involved.',
];

const PARTNER_TERMS = [
  '1. I confirm that I am a genuine service professional and that the details and KYC documents I submit are true and belong to me.',
  '2. I will not cause any trouble, harm, harassment or damage to any customer or their property, and I will carry out jobs honestly and professionally.',
  '3. I will only accept jobs for the service I registered for.',
  '4. I understand that FixIt Now is a platform that connects customers with independent partners. FixIt Now is not responsible for the conduct of any partner or customer, or for any loss, damage or dispute that arises between them. By accepting these terms, I accept responsibility for my own actions and agree that any issue is between me and the customer involved.',
];

async function runTests() {
  console.log('\n======================================================');
  console.log(' FixIt Now - ITEM 2: Terms and Conditions Test Suite');
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

  // --- TEST 1: Direct API registration without terms_accepted is rejected (Customer) ---
  await test('Direct customer registration without terms_accepted is rejected with 400', async () => {
    // Case A: terms_accepted missing
    const req1 = {
      body: {
        name: 'Test Customer No Terms',
        email: `test_noterms_${Date.now()}@example.com`,
        phone: '9876543210',
        address: '123 Test Street, Bangalore',
        password: 'Password@123',
      },
    };
    const res1 = createMockRes();
    await registerCustomer(req1, res1);
    assert.equal(res1.statusCode, 400);
    assert.equal(res1.body.status, 'error');
    assert.match(res1.body.message, /Terms and Conditions/i);

    // Case B: terms_accepted is false
    const req2 = {
      body: {
        name: 'Test Customer False Terms',
        email: `test_false_${Date.now()}@example.com`,
        phone: '9876543211',
        address: '123 Test Street, Bangalore',
        password: 'Password@123',
        terms_accepted: false,
      },
    };
    const res2 = createMockRes();
    await registerCustomer(req2, res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(res2.body.status, 'error');
    assert.match(res2.body.message, /Terms and Conditions/i);
  });

  // --- TEST 2: Direct API registration without terms_accepted is rejected (Partner) ---
  await test('Direct partner registration without terms_accepted is rejected with 400', async () => {
    // Case A: terms_accepted missing
    const req1 = {
      body: {
        name: 'Test Partner No Terms',
        email: `test_p_noterms_${Date.now()}@example.com`,
        phone: '9876543220',
        address: '123 Test Street, Bangalore',
        password: 'Password@123',
        service_id: 1,
        experience_years: 3,
      },
    };
    const res1 = createMockRes();
    await registerPartner(req1, res1);
    assert.equal(res1.statusCode, 400);
    assert.equal(res1.body.status, 'error');
    assert.match(res1.body.message, /Terms and Conditions/i);

    // Case B: terms_accepted is false
    const req2 = {
      body: {
        name: 'Test Partner False Terms',
        email: `test_p_false_${Date.now()}@example.com`,
        phone: '9876543221',
        address: '123 Test Street, Bangalore',
        password: 'Password@123',
        service_id: 1,
        experience_years: 3,
        terms_accepted: false,
      },
    };
    const res2 = createMockRes();
    await registerPartner(req2, res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(res2.body.status, 'error');
    assert.match(res2.body.message, /Terms and Conditions/i);
  });

  // --- TEST 3: Registration with terms_accepted stores terms_accepted_at and terms_version ---
  await test('Customer registration with terms_accepted stores terms_accepted_at and terms_version', async () => {
    const email = `test_c_accept_${Date.now()}@example.com`;
    const req = {
      body: {
        name: 'Accepted Customer',
        email,
        phone: '9876543230',
        address: '123 Indiranagar, Bangalore',
        password: 'Password@123',
        terms_accepted: true,
      },
    };
    const res = createMockRes();
    await registerCustomer(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.user.terms_version, '1.0');
    assert.ok(res.body.user.terms_accepted_at);

    // Verify row in database
    const dbRes = await testPool.query('SELECT * FROM customers WHERE email = $1', [email]);
    assert.equal(dbRes.rows.length, 1);
    const row = dbRes.rows[0];
    assert.equal(row.terms_version, '1.0');
    assert.ok(row.terms_accepted_at);
    const diffSeconds = Math.abs(Date.now() - new Date(row.terms_accepted_at).getTime()) / 1000;
    assert.ok(diffSeconds < 30, `Timestamp was set recently (${diffSeconds}s ago)`);
  });

  // --- TEST 4: Partner registration with terms_accepted stores terms_accepted_at and terms_version ---
  await test('Partner registration with terms_accepted stores terms_accepted_at and terms_version', async () => {
    // Ensure at least one service exists in test database
    const svcRes = await testPool.query('SELECT id FROM services WHERE active = true LIMIT 1');
    const serviceId = svcRes.rows.length > 0 ? svcRes.rows[0].id : 1;

    const email = `test_p_accept_${Date.now()}@example.com`;
    const req = {
      body: {
        name: 'Accepted Partner',
        email,
        phone: '9876543240',
        address: '123 Indiranagar, Bangalore',
        password: 'Password@123',
        service_id: serviceId,
        experience_years: 5,
        terms_accepted: true,
      },
    };
    const res = createMockRes();
    await registerPartner(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.user.terms_version, '1.0');
    assert.ok(res.body.user.terms_accepted_at);

    // Verify row in database
    const dbRes = await testPool.query('SELECT * FROM partners WHERE email = $1', [email]);
    assert.equal(dbRes.rows.length, 1);
    const row = dbRes.rows[0];
    assert.equal(row.terms_version, '1.0');
    assert.ok(row.terms_accepted_at);
    const diffSeconds = Math.abs(Date.now() - new Date(row.terms_accepted_at).getTime()) / 1000;
    assert.ok(diffSeconds < 30, `Timestamp was set recently (${diffSeconds}s ago)`);
  });

  // --- TEST 5: Existing accounts with terms_accepted_at = NULL can still log in without issue ---
  await test('Existing customer and partner accounts with NULL terms_accepted_at are not blocked from login', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 10);

    // 1. Seed legacy customer
    const cEmail = `legacy_customer_${Date.now()}@example.com`;
    await testPool.query(
      `INSERT INTO customers (name, email, phone, address, password_hash, terms_accepted_at, terms_version)
       VALUES ('Legacy Customer', $1, '9876543250', '123 Old Town, Bangalore', $2, NULL, NULL)`,
      [cEmail, passwordHash]
    );

    const cReq = {
      body: {
        email: cEmail,
        password: 'Password@123',
      },
    };
    const cRes = createMockRes();
    await loginCustomer(cReq, cRes);
    assert.equal(cRes.statusCode, 200);
    assert.equal(cRes.body.status, 'success');
    assert.equal(cRes.body.user.email, cEmail);
    assert.ok(cRes.body.token);

    // Verify existing database row is unchanged
    const cDb = await testPool.query('SELECT terms_accepted_at, terms_version FROM customers WHERE email = $1', [cEmail]);
    assert.equal(cDb.rows[0].terms_accepted_at, null);
    assert.equal(cDb.rows[0].terms_version, null);

    // 2. Seed legacy partner
    const svcRes = await testPool.query('SELECT id FROM services WHERE active = true LIMIT 1');
    const serviceId = svcRes.rows.length > 0 ? svcRes.rows[0].id : 1;

    const pEmail = `legacy_partner_${Date.now()}@example.com`;
    await testPool.query(
      `INSERT INTO partners (name, email, phone, address, password_hash, service_id, terms_accepted_at, terms_version)
       VALUES ('Legacy Partner', $1, '9876543260', '123 Old Town, Bangalore', $2, $3, NULL, NULL)`,
      [pEmail, passwordHash, serviceId]
    );

    const pReq = {
      body: {
        email: pEmail,
        password: 'Password@123',
      },
    };
    const pRes = createMockRes();
    await loginPartner(pReq, pRes);
    assert.equal(pRes.statusCode, 200);
    assert.equal(pRes.body.status, 'success');
    assert.equal(pRes.body.user.email, pEmail);
    assert.ok(pRes.body.token);

    // Verify existing database row is unchanged
    const pDb = await testPool.query('SELECT terms_accepted_at, terms_version FROM partners WHERE email = $1', [pEmail]);
    assert.equal(pDb.rows[0].terms_accepted_at, null);
    assert.equal(pDb.rows[0].terms_version, null);
  });

  // --- TEST 6: UI Verification for Customer & Partner Portals ---
  await test('UI files contain required checkbox, disabled button binding, and exact distinct terms', () => {
    const customerViewPath = path.resolve(__dirname, '../../../client/src/pages/customer/CustomerAuthView.jsx');
    const partnerViewPath = path.resolve(__dirname, '../../../client/src/pages/partner/PartnerAuthView.jsx');

    const customerContent = fs.readFileSync(customerViewPath, 'utf8');
    const partnerContent = fs.readFileSync(partnerViewPath, 'utf8');

    // 1. Required checkbox text
    assert.ok(
      customerContent.includes('I have read and agree to the') && customerContent.includes('Terms and Conditions'),
      'CustomerAuthView contains Terms checkbox label'
    );
    assert.ok(
      partnerContent.includes('I have read and agree to the') && partnerContent.includes('Terms and Conditions'),
      'PartnerAuthView contains Terms checkbox label'
    );

    // 2. Register button is disabled until ticked
    assert.ok(
      customerContent.includes('disabled={loading || !termsAccepted}'),
      'Customer register button is disabled when termsAccepted is false'
    );
    assert.ok(
      partnerContent.includes('disabled={loading || !termsAccepted}'),
      'Partner register button is disabled when termsAccepted is false'
    );

    // 3. Customer terms text verification (verbatim check)
    CUSTOMER_TERMS.forEach((term, idx) => {
      // Strip line number prefix for normalized check
      const textOnly = term.replace(/^\d+\.\s*/, '').trim();
      assert.ok(
        customerContent.includes(textOnly),
        `CustomerAuthView contains Customer Term ${idx + 1}`
      );
    });

    // 4. Partner terms text verification (verbatim check)
    PARTNER_TERMS.forEach((term, idx) => {
      const textOnly = term.replace(/^\d+\.\s*/, '').trim();
      assert.ok(
        partnerContent.includes(textOnly),
        `PartnerAuthView contains Partner Term ${idx + 1}`
      );
    });

    // 5. Each portal shows its own text and they are distinct
    assert.ok(
      customerContent.includes('genuine and that I am registering only to get a real problem fixed'),
      'Customer portal contains customer-specific condition 1'
    );
    assert.ok(
      !customerContent.includes('genuine service professional and that the details and KYC documents'),
      'Customer portal does NOT contain partner condition 1'
    );

    assert.ok(
      partnerContent.includes('genuine service professional and that the details and KYC documents'),
      'Partner portal contains partner-specific condition 1'
    );
    assert.ok(
      !partnerContent.includes('registering only to get a real problem fixed'),
      'Partner portal does NOT contain customer condition 1'
    );
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
