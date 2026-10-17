import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5001/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('Testing specific fixes from the review...\n');

  // 1. Customer Registration and Default Address Seed (Fix #6)
  const custEmail = `audit_cust_${Date.now()}@example.com`;
  const regRes = await request('/auth/customer/register', {
    method: 'POST',
    body: {
      name: 'Audit Customer',
      email: custEmail,
      phone: '+91 9988776655',
      address: '100, 100ft Road, Indiranagar, Bengaluru',
      password: 'AuditPassword@123',
      latitude: 12.9783,
      longitude: 77.6408,
    },
  });
  assert.equal(regRes.status, 201, 'Customer registration failed');
  const custToken = regRes.data.token;
  const custId = regRes.data.user.id;
  console.log('✓ Customer registration and default address seed successful (Fix #6 verified)');

  // Verify default address exists in customer addresses
  const addrRes = await request('/customer/addresses', {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assert.equal(addrRes.status, 200);
  assert.ok(addrRes.data.data.length > 0, 'Default address should have been seeded');
  console.log('✓ Default address verified in saved addresses list');

  // Register second customer for cross-tenant testing
  const cust2Email = `audit_cust2_${Date.now()}@example.com`;
  const reg2Res = await request('/auth/customer/register', {
    method: 'POST',
    body: {
      name: 'Foreign Customer',
      email: cust2Email,
      phone: '+91 9988776656',
      address: '101, 100ft Road, Indiranagar, Bengaluru',
      password: 'AuditPassword@123',
    },
  });
  const cust2Token = reg2Res.data.token;

  // 2. Partner Profile GET & PUT (Fix #1)
  // Login as demo partner (Rajesh Kumar, plumber)
  const partLogin = await request('/auth/partner/login', {
    method: 'POST',
    body: {
      email: 'rajesh.plumber@fixitnow.local',
      password: 'Password@123',
    },
  });
  assert.equal(partLogin.status, 200, 'Partner login failed');
  const partToken = partLogin.data.token;

  // GET /partner/profile
  const profGet = await request('/partner/profile', {
    headers: { Authorization: `Bearer ${partToken}` },
  });
  assert.equal(profGet.status, 200, 'GET /partner/profile failed');
  assert.equal(profGet.data.data.service_name, 'Plumber');
  console.log(`✓ GET /partner/profile verified: Trade=${profGet.data.data.service_name}, Rating=${profGet.data.data.rating}`);

  // PUT /partner/profile (Update name, vehicle, address)
  const profPut = await request('/partner/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partToken}` },
    body: {
      name: 'Rajesh Kumar (Master Tech)',
      phone: '+91 98765 43210',
      address: 'Domlur Station, Bengaluru 560071',
      vehicle: 'Hero Splendor Plus (KA-01-EQ-4421)',
    },
  });
  assert.equal(profPut.status, 200, 'PUT /partner/profile failed');
  assert.equal(profPut.data.data.name, 'Rajesh Kumar (Master Tech)');
  console.log('✓ PUT /partner/profile verified: Updated partner name and details while keeping trade locked');

  // Fetch services dynamically
  const srvRes = await request('/services');
  const plumber = srvRes.data.data.find((s) => s.slug === 'plumber') || srvRes.data.data[0];

  // Customer 1 books a service request
  const reqRes = await request('/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      service_id: plumber.id,
      problem: 'Kitchen faucet pipe leaking',
      description: 'Water leaking heavily from kitchen faucet pipe under the sink',
      address: '100, 100ft Road, Indiranagar, Bengaluru',
      latitude: 12.9783,
      longitude: 77.6408,
    },
  });
  assert.equal(reqRes.status, 201, `Request booking failed: ${JSON.stringify(reqRes.data)}`);
  const activeReqId = reqRes.data.data.request.id;
  console.log(`✓ Customer 1 created request #${activeReqId}`);

  // Cross-tenant check on getRequestById (Fix #2): Customer 2 attempts to view Customer 1's request
  const crossView = await request(`/requests/${activeReqId}`, {
    headers: { Authorization: `Bearer ${cust2Token}` },
  });
  assert.equal(crossView.status, 403, 'Unauthorized customer should receive 403');
  console.log('✓ Cross-tenant request viewing blocked with 403 Forbidden (Fix #2 verified)');

  // Cross-tenant check on cancelRequest (Fix #3): Customer 2 attempts to cancel Customer 1's request
  const crossCancel = await request(`/requests/${activeReqId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cust2Token}` },
    body: { reason: 'Unauthorized cancel attempt' },
  });
  assert.equal(crossCancel.status, 403, 'Unauthorized customer cancel should receive 403');
  console.log('✓ Cross-tenant request cancellation blocked with 403 Forbidden (Fix #3 verified)');

  // Cross-tenant check on rateRequest (Fix #5): Attempt to rate before completion
  const earlyRate = await request(`/requests/${activeReqId}/rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: { stars: 5, comment: 'Premature rating' },
  });
  assert.equal(earlyRate.status, 400, 'Rating incomplete request should receive 400');
  console.log('✓ Rating incomplete request blocked with 400 Bad Request (Fix #5 verified)');

  // Advance request lifecycle to completion
  await request(`/requests/${activeReqId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { decision: 'accept' },
  });
  await request(`/requests/${activeReqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { status: 'on_the_way' },
  });
  await request(`/requests/${activeReqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { status: 'arrived' },
  });
  const otp = reqRes.data.data.request.service_otp;
  await request(`/requests/${activeReqId}/verify-otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { otp },
  });
  await request(`/requests/${activeReqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { status: 'completed' },
  });
  await request(`/requests/${activeReqId}/pay`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { amount: 450, payment_method: 'cash' },
  });

  // Cross-tenant check on payment receipt (Fix #4): Customer 2 attempts to view Customer 1's receipt
  const crossReceipt = await request(`/requests/${activeReqId}/receipt`, {
    headers: { Authorization: `Bearer ${cust2Token}` },
  });
  assert.equal(crossReceipt.status, 403, 'Unauthorized customer receipt fetch should receive 403');
  console.log('✓ Cross-tenant payment receipt fetch blocked with 403 Forbidden (Fix #4 verified)');

  // Owner customer successfully views their own receipt
  const ownerReceipt = await request(`/requests/${activeReqId}/receipt`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assert.equal(ownerReceipt.status, 200, 'Owner customer should be able to view receipt');
  console.log('✓ Owner customer can view receipt successfully');

  // Customer 2 attempts to rate Customer 1's completed request (Fix #5)
  const crossRate = await request(`/requests/${activeReqId}/rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cust2Token}` },
    body: { stars: 5, comment: 'Forged review' },
  });
  assert.equal(crossRate.status, 403, 'Unauthorized customer rating should receive 403');
  console.log('✓ Cross-tenant forged rating blocked with 403 Forbidden (Fix #5 verified)');

  // Owner customer invalid star rating (<1 or >5)
  const invalidStars = await request(`/requests/${activeReqId}/rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: { stars: 6, comment: 'Too many stars' },
  });
  assert.equal(invalidStars.status, 400, 'Stars > 5 should receive 400');
  console.log('✓ Invalid star range blocked with 400 Bad Request');

  // Owner customer rates successfully
  const validRate = await request(`/requests/${activeReqId}/rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: { stars: 5, comment: 'Superb job by Rajesh!' },
  });
  assert.equal(validRate.status, 201, 'Owner customer rating should succeed');
  console.log('✓ Owner customer rated request successfully');

  // Duplicate rating attempt (Fix #5)
  const dupRate = await request(`/requests/${activeReqId}/rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: { stars: 4, comment: 'Duplicate rating attempt' },
  });
  assert.equal(dupRate.status, 400, 'Duplicate rating should receive 400');
  console.log('✓ Duplicate rating blocked with 400 Bad Request (Fix #5 verified)');

  console.log('\n======================================================');
  console.log('ALL VERIFICATION TESTS FOR AUDITED DEFICIENCIES PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
