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

async function verifyAdminReflection() {
  console.log('===============================================================');
  console.log('Testing Admin Portal Real-Time Database Reflection for New Data');
  console.log('===============================================================\n');

  // Step 1: Admin logs in
  const adminLogin = await request('/admin/login', {
    method: 'POST',
    body: { email: 'admin@fixitnow.com', password: 'admin@123' },
  });
  assert.equal(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated');

  // Step 2: Register a new customer
  const rand = Date.now();
  const customerEmail = `live_customer_${rand}@example.com`;
  const customerName = `Pooja Sharma ${rand.toString().slice(-4)}`;
  const regCustRes = await request('/auth/customer/register', {
    method: 'POST',
    body: {
      name: customerName,
      email: customerEmail,
      phone: `98765${rand.toString().slice(-5)}`,
      address: '22, 12th Main Road, Indiranagar, Bengaluru',
      password: 'LivePassword@2026',
    },
  });
  assert.equal(regCustRes.status, 201, 'Customer registration failed');
  const custToken = regCustRes.data.token;
  const custId = regCustRes.data.user.id;
  console.log(`✓ New customer registered: ${customerName} (${customerEmail})`);

  // Step 3: Check Admin Customers view reflection
  const adminCustRes = await request('/admin/customers', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminCustRes.status, 200);
  const foundCust = adminCustRes.data.data.find((c) => c.id === custId || c.email === customerEmail);
  assert.ok(foundCust, 'Newly created customer must reflect in Admin Customers list');
  console.log(`✓ VERIFIED: New customer reflected in Admin Portal (ID: ${foundCust.id}, Name: ${foundCust.name})`);

  // Step 4: Register a new partner
  const partnerEmail = `live_partner_${rand}@example.com`;
  const partnerName = `Vikram Mason ${rand.toString().slice(-4)}`;
  const regPartRes = await request('/auth/partner/register', {
    method: 'POST',
    body: {
      name: partnerName,
      email: partnerEmail,
      phone: `91234${rand.toString().slice(-5)}`,
      address: '45, Old Airport Road, Domlur, Bengaluru',
      password: 'LivePartner@2026',
      service_id: 12, // Plumber
      vehicle: 'TVS Jupiter (KA-04-AB-1234)',
    },
  });
  assert.equal(regPartRes.status, 201, 'Partner registration failed');
  const partToken = regPartRes.data.token;
  const partId = regPartRes.data.user.id;
  console.log(`✓ New partner registered: ${partnerName} (${partnerEmail})`);

  // Step 5: Check Admin Partners view reflection
  const adminPartRes = await request('/admin/partners', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminPartRes.status, 200);
  const foundPart = adminPartRes.data.data.find((p) => p.id === partId || p.email === partnerEmail);
  assert.ok(foundPart, 'Newly created partner must reflect in Admin Partners list');
  console.log(`✓ VERIFIED: New partner reflected in Admin Portal (ID: ${foundPart.id}, Trade: ${foundPart.service_name})`);

  // Step 6: Partner subscribes to a plan
  const subRes = await request('/partner/subscribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${partToken}` },
    body: { plan_id: 7 }, // quarterly
  });
  assert.equal(subRes.status, 201, 'Subscription failed');
  console.log(`✓ Partner subscribed to Quarterly plan`);

  // Step 7: Check Admin Subscriptions view reflection
  const adminSubRes = await request('/admin/subscriptions', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminSubRes.status, 200);
  const foundSub = adminSubRes.data.data.find((s) => s.partner_id === partId);
  assert.ok(foundSub, 'New subscription must reflect in Admin Subscriptions list');
  console.log(`✓ VERIFIED: New subscription reflected in Admin Portal (Plan: ${foundSub.plan_name}, Days remaining: ${foundSub.days_remaining})`);

  // Step 8: Customer creates a new service request / job
  const jobRes = await request('/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      service_id: 12,
      problem: 'Emergency bathroom pipe burst',
      description: 'Main pipe leaking heavily, needs urgent attention',
      address: '22, 12th Main Road, Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
    },
  });
  assert.equal(jobRes.status, 201, 'Job creation failed');
  const newJobId = jobRes.data.data.request.id;
  const orderNumber = jobRes.data.data.order_number;
  console.log(`✓ New service request created: ${orderNumber} (ID: ${newJobId})`);

  // Step 9: Check Admin Service Requests view reflection
  const adminReqRes = await request('/admin/requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminReqRes.status, 200);
  const foundJob = adminReqRes.data.data.find((r) => r.id === newJobId);
  assert.ok(foundJob, 'Newly created job must reflect in Admin Requests list');
  assert.equal(foundJob.order_number, orderNumber);
  assert.equal(foundJob.customer_name, customerName);
  console.log(`✓ VERIFIED: New job reflected in Admin Requests Stream (${foundJob.order_number}, Customer: ${foundJob.customer_name}, Status: ${foundJob.status})`);

  // Step 10: Check filter support on Admin Requests
  const pendingReqRes = await request('/admin/requests?status=pending', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(pendingReqRes.status, 200);
  const foundPending = pendingReqRes.data.data.find((r) => r.id === newJobId);
  assert.ok(foundPending, 'New job must appear when admin filters by "pending"');
  console.log(`✓ VERIFIED: New job correctly found in Admin "Searching (Pending)" filter tab`);

  console.log('\n===============================================================');
  console.log('ALL NEW ACCOUNTS AND JOBS 100% REFLECT IN THE ADMIN PORTAL!');
  console.log('===============================================================\n');
}

verifyAdminReflection().catch((err) => {
  console.error('Reflection test failed:', err);
  process.exit(1);
});
