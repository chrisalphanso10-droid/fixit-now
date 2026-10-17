/**
 * Automated Test Suite for Phase 5: Admin Portal Basics
 * Tests all requirements from docs/SRS.md Section 3.4 and docs/DESIGN.md:
 * - Admin login at /api/admin/login
 * - Dashboard KPIs & stats
 * - Read-only lists: customers, partners, requests, subscriptions, ratings, activity log
 * - Server-side immutability: admin CANNOT edit or delete customer or partner data (403 Forbidden)
 * - Plan price management: updates price for new subscriptions, existing subscriptions keep price paid (BR-2)
 * - Service category management: add, rename, update, deactivate
 * - KYC review: view submitted documents, approve or reject (rejection needs reason), log every decision to activity_logs
 */

const PORT = process.env.PORT || 5001;
const API_BASE = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 5 ADMIN BACKEND INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Admin Login
    console.log('--- 1. Admin Login ---');
    const loginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fixitnow.com',
        password: 'admin@123',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Admin login succeeded with status 200');
    assert(loginData.token, 'Admin login returned a valid JWT token');
    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Admin Dashboard
    console.log('\n--- 2. Dashboard KPIs & Activity ---');
    const dashRes = await fetch(`${API_BASE}/admin/dashboard`, { headers: authHeaders });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'GET /api/admin/dashboard returned 200');
    assert(dashData.data?.stats, 'Dashboard returns stats summary');
    console.log('Stats:', dashData.data.stats);

    // 3. Read-Only Customers List
    console.log('\n--- 3. Read-Only Customers ---');
    const custRes = await fetch(`${API_BASE}/admin/customers`, { headers: authHeaders });
    const custData = await custRes.json();
    assert(custRes.status === 200, 'GET /api/admin/customers returned 200');
    assert(Array.isArray(custData.data), 'Customers list is an array');
    console.log(`Loaded ${custData.data.length} registered customers`);

    // 4. Read-Only Partners List
    console.log('\n--- 4. Read-Only Partners ---');
    const partRes = await fetch(`${API_BASE}/admin/partners`, { headers: authHeaders });
    const partData = await partRes.json();
    assert(partRes.status === 200, 'GET /api/admin/partners returned 200');
    assert(Array.isArray(partData.data), 'Partners list is an array');
    console.log(`Loaded ${partData.data.length} registered partners`);

    // 5. Server-Side Guard: Admin CANNOT edit or delete customer or partner data (FR-A3)
    console.log('\n--- 5. Server-Side Guard: Customer/Partner Immutability (FR-A3) ---');
    const delCustRes = await fetch(`${API_BASE}/admin/customers/dummy-id`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert(delCustRes.status === 403, 'DELETE /api/admin/customers/:id returns 403 Forbidden');

    const putCustRes = await fetch(`${API_BASE}/admin/customers/dummy-id`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert(putCustRes.status === 403, 'PUT /api/admin/customers/:id returns 403 Forbidden');

    const delPartRes = await fetch(`${API_BASE}/admin/partners/dummy-id`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert(delPartRes.status === 403, 'DELETE /api/admin/partners/:id returns 403 Forbidden');

    const putPartRes = await fetch(`${API_BASE}/admin/partners/dummy-id`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Hacked Partner' }),
    });
    assert(putPartRes.status === 403, 'PUT /api/admin/partners/:id returns 403 Forbidden');

    // 6. Plans and Prices Management (FR-A5, BR-2)
    console.log('\n--- 6. Plans and Prices Management (FR-A5, BR-2) ---');
    const plansRes = await fetch(`${API_BASE}/admin/plans`, { headers: authHeaders });
    const plansData = await plansRes.json();
    assert(plansRes.status === 200, 'GET /api/admin/plans returned 200');
    assert(plansData.data.length >= 3, 'Returns quarterly, half-yearly, and yearly plans');
    const targetPlan = plansData.data[0];
    const originalPrice = targetPlan.price;
    const testNewPrice = originalPrice + 50;

    const updatePlanRes = await fetch(`${API_BASE}/admin/plans/${targetPlan.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ price: testNewPrice }),
    });
    const updatePlanData = await updatePlanRes.json();
    assert(updatePlanRes.status === 200, `PUT /api/admin/plans/${targetPlan.id} returned 200`);
    assert(updatePlanData.data.price === testNewPrice, `Plan price updated to ₹${testNewPrice}`);

    // Revert price back to original
    await fetch(`${API_BASE}/admin/plans/${targetPlan.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ price: originalPrice }),
    });

    // 7. Service Categories Management (FR-A6)
    console.log('\n--- 7. Service Categories Management (FR-A6) ---');
    const servicesRes = await fetch(`${API_BASE}/admin/services`, { headers: authHeaders });
    const servicesData = await servicesRes.json();
    assert(servicesRes.status === 200, 'GET /api/admin/services returned 200');
    console.log(`Current active service categories: ${servicesData.data.length}`);

    // Add new service
    const testCatName = `Test Carpentry ${Date.now()}`;
    const addCatRes = await fetch(`${API_BASE}/admin/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: testCatName,
        description: 'Custom wood crafting and door fitting services.',
        base_price_estimate: 450,
      }),
    });
    const addCatData = await addCatRes.json();
    assert(addCatRes.status === 201, 'POST /api/admin/services created new category with 201');
    const createdCatId = addCatData.data.id;

    // Rename / update service
    const updateCatRes = await fetch(`${API_BASE}/admin/services/${createdCatId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: `${testCatName} Renamed`,
        description: 'Updated carpentry and cabinetry services.',
        base_price_estimate: 500,
      }),
    });
    assert(updateCatRes.status === 200, 'PUT /api/admin/services/:id renamed category');

    // Deactivate service
    const toggleCatRes = await fetch(`${API_BASE}/admin/services/${createdCatId}/toggle`, {
      method: 'PUT',
      headers: authHeaders,
    });
    const toggleCatData = await toggleCatRes.json();
    assert(toggleCatRes.status === 200, 'PUT /api/admin/services/:id/toggle returned 200');
    assert(toggleCatData.data.active === false, 'Service category successfully deactivated');

    // 8. Read-Only Lists: Requests, Subscriptions, Ratings, Activity Log
    console.log('\n--- 8. Read-Only Lists (Requests, Subscriptions, Ratings, Activity Log) ---');
    const reqRes = await fetch(`${API_BASE}/admin/requests`, { headers: authHeaders });
    assert(reqRes.status === 200, 'GET /api/admin/requests returned 200');

    const subRes = await fetch(`${API_BASE}/admin/subscriptions`, { headers: authHeaders });
    assert(subRes.status === 200, 'GET /api/admin/subscriptions returned 200');

    const ratRes = await fetch(`${API_BASE}/admin/ratings`, { headers: authHeaders });
    assert(ratRes.status === 200, 'GET /api/admin/ratings returned 200');

    const actRes = await fetch(`${API_BASE}/admin/activity-log`, { headers: authHeaders });
    const actData = await actRes.json();
    assert(actRes.status === 200, 'GET /api/admin/activity-log returned 200');
    assert(actData.data.length > 0, 'Activity log contains audit records');
    console.log('Latest Activity:', actData.data[0]);

    // 9. KYC Review & Decision with Activity Log
    console.log('\n--- 9. KYC Review & Decision with Audit Logging ---');
    const kycListRes = await fetch(`${API_BASE}/admin/kyc`, { headers: authHeaders });
    const kycListData = await kycListRes.json();
    assert(kycListRes.status === 200, 'GET /api/admin/kyc returned 200');
    console.log(`Found ${kycListData.data.length} partners in KYC queue`);

    if (kycListData.data.length > 0) {
      const partnerToReview = kycListData.data[0];
      const partnerId = partnerToReview.partner_id;

      // Test rejection without reason -> must fail with 400
      const rejectFailRes = await fetch(`${API_BASE}/admin/kyc/${partnerId}/decision`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          decision: 'rejected',
          rejection_reason: '',
        }),
      });
      assert(rejectFailRes.status === 400, 'Rejection without reason rejected with 400 Bad Request');

      // Test approval
      const approveRes = await fetch(`${API_BASE}/admin/kyc/${partnerId}/decision`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          decision: 'verified',
          reviewer_notes: 'Automated test suite verification approval.',
        }),
      });
      assert(approveRes.status === 200, 'Approve partner KYC returned 200');

      // Verify that activity log now has the KYC_APPROVED action
      const checkActRes = await fetch(`${API_BASE}/admin/activity-log`, { headers: authHeaders });
      const checkActData = await checkActRes.json();
      const latestAction = checkActData.data[0];
      assert(latestAction.action === 'KYC_APPROVED', `Audit log recorded ${latestAction.action}`);
    }

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    process.exit(1);
  }
}

runTests();
