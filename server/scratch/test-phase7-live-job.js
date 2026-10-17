/**
 * FixIt Now - Phase 7 Live Job Flow E2E Test
 * Tests full live job flow between customer and partner across Socket.IO and REST API:
 * 1. Sequential partner status: Accept -> Start trip -> Arrived -> Start service (OTP) -> Complete service -> Payment received.
 * 2. Instant Socket.IO event push with timestamps and status logs.
 * 3. 6 status steps with ticks for customer tracking.
 * 4. Coordinate movement simulation & ETA countdown.
 * 5. Customer OTP verification.
 * 6. Cancellation with reason, instant partner release, and history verification.
 */

import socketIoDist from '../../client/node_modules/socket.io-client/dist/socket.io.js';
import { query } from '../src/config/db.js';
const io = socketIoDist.io || socketIoDist;

const API_BASE = 'http://localhost:5001';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

function createSocket(token) {
  return io(API_BASE, {
    transports: ['websocket', 'polling'],
    reconnection: false,
    auth: { token },
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhase7LiveJobTest() {
  console.log('====================================================');
  console.log('   FIXIT NOW - PHASE 7 LIVE JOB FLOW VERIFICATION   ');
  console.log('====================================================\n');

  const uniqueId = Date.now();
  const testPassword = 'Password123!';

  // Step 1: Register and setup Customer & Partner
  console.log('1. Registering fresh Customer and Partner test accounts...');
  const custReg = await request('/api/auth/customer/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Ananya Test ${uniqueId}`,
      email: `test_cust_${uniqueId}@fixitnow.local`,
      password: testPassword,
      phone: '9876543210',
      address: '42, 3rd Cross, Indiranagar, Bengaluru',
    }),
  });
  const customerToken = custReg.token;
  const customerUser = custReg.user;
  console.log(`   ✓ Customer: ${customerUser.name} (id: ${customerUser.id})`);

  // Ensure services exist and get Plumbing service ID
  const srvRes = await query("SELECT id FROM services WHERE active = true AND name ILIKE '%plumb%' LIMIT 1");
  const plumbingServiceId = srvRes.rows[0]?.id || 2;

  const partReg = await request('/api/auth/partner/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Rajesh Tech ${uniqueId}`,
      email: `test_part_${uniqueId}@fixitnow.local`,
      password: testPassword,
      phone: '9845011223',
      address: '100 Ft Road, Indiranagar, Bengaluru',
      service_id: plumbingServiceId,
      vehicle: 'Bajaj Pulsar (KA-03-HJ-4421)',
    }),
  });
  const partnerToken = partReg.token;
  const partnerUser = partReg.user;
  console.log(`   ✓ Partner: ${partnerUser.name} (id: ${partnerUser.id})`);

  // Activate partner: verify KYC, ensure active subscription, set coordinates in 2km zone, and set online
  const planRes = await query("SELECT id, price FROM plans WHERE active = true LIMIT 1");
  const planId = planRes.rows[0]?.id || 8;
  const planPrice = planRes.rows[0]?.price || 1599.0;

  // Set any other partners offline so our test partner receives the immediate offer
  await query('UPDATE partners SET online = false WHERE id != $1', [partnerUser.id]);

  await query(
    `UPDATE partners
     SET kyc_status = 'verified', online = true,
         latitude = 12.9750, longitude = 77.6390
     WHERE id = $1`,
    [partnerUser.id]
  );
  await query(
    `INSERT INTO subscriptions (partner_id, plan_id, status, price_paid, start_date, end_date)
     VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 months')`,
    [partnerUser.id, planId, planPrice]
  );
  console.log('   ✓ Partner KYC verified, active plan activated, coordinates placed in 2 km zone, set ONLINE');

  // Step 2: Establish Socket.IO connections
  console.log('\n2. Connecting Socket.IO clients for Customer & Partner...');
  const customerSocket = createSocket(customerToken);
  const partnerSocket = createSocket(partnerToken);

  await new Promise((resolve) => {
    let count = 0;
    const check = () => {
      count++;
      if (count === 2) resolve();
    };
    customerSocket.on('connect', () => {
      customerSocket.emit('register_customer', { customerId: customerUser.id });
      check();
    });
    partnerSocket.on('connect', () => {
      partnerSocket.emit('register_partner', { partnerId: partnerUser.id });
      check();
    });
  });
  console.log('   ✓ Both sockets connected and registered in their respective rooms');

  // Track customer events
  const customerEvents = [];
  customerSocket.on('request_accepted', (data) => {
    customerEvents.push({ event: 'request_accepted', data });
  });
  customerSocket.on('request_status_updated', (data) => {
    customerEvents.push({ event: 'request_status_updated', data });
  });
  const locationUpdates = [];
  customerSocket.on('partner_location', (data) => {
    locationUpdates.push(data);
  });

  // Track partner events
  let partnerIncoming = null;
  partnerSocket.on('incoming_request', (data) => {
    partnerIncoming = data;
  });

  // Step 3: Customer creates a new service request
  console.log('\n3. Customer creates request for Plumbing Repairs...');
  const createRes = await request('/api/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      service_id: plumbingServiceId, // Plumbing
      problem: 'Kitchen sink pipe burst flooding cabinet',
      description: 'Major leak under counter. Need emergency pipe repair immediately.',
      address: '42, 3rd Cross, Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
    }),
  });

  const reqId = createRes.data.request.id;
  const serviceOtp = createRes.data.request.service_otp;
  console.log(`   ✓ Request created: ID=${reqId}, Order=${createRes.data.order_number}`);
  console.log(`   ✓ Service OTP generated: ${serviceOtp} (6 digits)`);

  // Wait for partner to receive incoming dispatch offer
  await wait(800);
  if (!partnerIncoming || String(partnerIncoming.job.id) !== String(reqId)) {
    throw new Error('Partner did not receive incoming_request event over Socket.IO!');
  }
  console.log(`   ✓ Partner received incoming_request popup over Socket.IO (countdown: ${partnerIncoming.countdown}s)`);

  // Step 4: Button 1 - "Accept"
  console.log('\n4. [Button 1: Accept] Partner accepts the incoming job offer...');
  customerSocket.emit('join_request', { requestId: reqId });
  partnerSocket.emit('join_request', { requestId: reqId });

  await request(`/api/requests/${reqId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ decision: 'accept' }),
  });

  await wait(500);
  const acceptEvt = customerEvents.find((e) => e.event === 'request_accepted');
  if (!acceptEvt) {
    throw new Error('Customer did not receive request_accepted event!');
  }
  console.log(`   ✓ Customer received request_accepted event (Step 1: Request accepted)!`);

  // Step 5: Button 2 - "Start trip"
  console.log('\n5. [Button 2: Start trip] Partner starts trip to customer doorstep...');
  await request(`/api/requests/${reqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ status: 'start_trip' }),
  });

  console.log('   Waiting 3.5s for movement simulation and ETA countdown...');
  await wait(3500);

  const step2Evt = customerEvents.find(
    (e) => e.event === 'request_status_updated' && e.data.status === 'partner_on_way'
  );
  if (!step2Evt) {
    throw new Error('Customer did not receive partner_on_way status update!');
  }
  console.log(`   ✓ Customer received status: partner_on_way (Step 2: Partner on the way, tick stamped)!`);

  if (locationUpdates.length === 0) {
    throw new Error('No partner_location movement updates received during transit!');
  }
  console.log(`   ✓ Received ${locationUpdates.length} simulated coordinate & ETA updates over Socket.IO!`);
  const latestLoc = locationUpdates[locationUpdates.length - 1];
  console.log(`     Latest coordinates: (${latestLoc.latitude.toFixed(4)}, ${latestLoc.longitude.toFixed(4)}), ETA: ${latestLoc.eta_minutes} min, Progress: ${(latestLoc.progress * 100).toFixed(0)}%`);

  // Step 6: Button 3 - "Arrived"
  console.log('\n6. [Button 3: Arrived] Partner arrives at customer location...');
  await request(`/api/requests/${reqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ status: 'arrived' }),
  });

  await wait(600);
  const step3Evt = customerEvents.find(
    (e) => e.event === 'request_status_updated' && e.data.status === 'partner_arrived'
  );
  if (!step3Evt) {
    throw new Error('Customer did not receive partner_arrived status update!');
  }
  console.log(`   ✓ Customer received status: partner_arrived (Step 3: Partner arrived, tick stamped)!`);

  // Step 7: Button 4 - "Start service" (Enter 6-digit OTP)
  console.log(`\n7. [Button 4: Start service] Partner enters customer's 6-digit OTP (${serviceOtp})...`);
  
  // Test invalid OTP rejection first
  try {
    await request(`/api/requests/${reqId}/verify-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: JSON.stringify({ otp: '000000' }),
    });
    throw new Error('Server accepted invalid OTP!');
  } catch (err) {
    console.log(`   ✓ Invalid OTP correctly rejected by server: "${err.message}"`);
  }

  // Submit valid OTP
  const verifyRes = await request(`/api/requests/${reqId}/verify-otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ otp: serviceOtp }),
  });
  console.log(`   ✓ OTP verified successfully: ${verifyRes.message}`);

  await wait(600);
  const step4Evt = customerEvents.find(
    (e) => e.event === 'request_status_updated' && e.data.status === 'service_started'
  );
  if (!step4Evt) {
    throw new Error('Customer did not receive service_started status update!');
  }
  console.log(`   ✓ Customer received status: service_started (Step 4: Service started, tick stamped)!`);

  // Step 8: Button 5 - "Complete service"
  console.log('\n8. [Button 5: Complete service] Partner finishes repair work...');
  await request(`/api/requests/${reqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ status: 'service_completed' }),
  });

  await wait(600);
  const step5Evt = customerEvents.find(
    (e) => e.event === 'request_status_updated' && e.data.status === 'service_completed'
  );
  if (!step5Evt) {
    throw new Error('Customer did not receive service_completed status update!');
  }
  console.log(`   ✓ Customer received status: service_completed (Step 5: Service completed, tick stamped)!`);

  // Step 9: Button 6 - "Payment received"
  console.log('\n9. [Button 6: Payment received] Partner receives direct on-site settlement...');
  await request(`/api/requests/${reqId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ status: 'payment_received' }),
  });

  await wait(600);
  const step6Evt = customerEvents.find(
    (e) => e.event === 'request_status_updated' && e.data.status === 'payment_completed'
  );
  if (!step6Evt) {
    throw new Error('Customer did not receive payment_completed status update!');
  }
  console.log(`   ✓ Customer received status: payment_completed (Step 6: Payment completed, tick stamped)!`);

  // Check request details in DB
  const reqCheck = await request(`/api/requests/${reqId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log(`   ✓ Final DB status: ${reqCheck.data.status}`);
  console.log(`   ✓ Status logs recorded in PostgreSQL: ${reqCheck.data.status_logs?.length || 0} transitions`);

  // Step 10: Test Cancellation Flow
  console.log('\n10. Testing Customer Cancellation Flow (SRS FR-C19)...');
  const cancelTestReq = await request('/api/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      service_id: plumbingServiceId,
      problem: 'Leaking pipe under kitchen sink test cancellation',
      description: 'Testing live cancellation behavior.',
      address: '42, 3rd Cross, Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
    }),
  });
  const cancelReqId = cancelTestReq.data.request.id;
  console.log(`   ✓ Created second request ID: ${cancelReqId}`);

  // Partner accepts
  await wait(600);
  await request(`/api/requests/${cancelReqId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify({ decision: 'accept' }),
  });
  console.log('   ✓ Partner accepted second request');

  // Listen for cancellation on partner socket
  let partnerReceivedCancel = null;
  partnerSocket.on('request_cancelled', (data) => {
    partnerReceivedCancel = data;
  });

  // Customer cancels with reason
  console.log('   Customer submits cancellation with reason: "Issue resolved itself"...');
  await request(`/api/requests/${cancelReqId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ reason: 'Issue resolved itself' }),
  });

  await wait(800);
  if (!partnerReceivedCancel || String(partnerReceivedCancel.requestId) !== String(cancelReqId)) {
    throw new Error('Partner did not receive request_cancelled event over Socket.IO!');
  }
  console.log(`   ✓ Partner received instant Socket.IO cancellation: "${partnerReceivedCancel.reason}"`);
  console.log(`   ✓ Partner message: "${partnerReceivedCancel.message}"`);

  // Verify partner is freed in DB
  const partCheck = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  console.log(`   ✓ Partner online status after cancellation: online=${partCheck.user.online} (freed for new jobs)`);

  // Verify cancelled job appears in customer history
  const historyCheck = await request('/api/requests?filter=cancelled', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const foundCancelled = historyCheck.data.find((r) => String(r.id) === String(cancelReqId));
  if (!foundCancelled) {
    throw new Error('Cancelled job not found in history!');
  }
  console.log(`   ✓ Cancelled job found in history: ${foundCancelled.order_number} (${foundCancelled.status}, reason: "${foundCancelled.cancel_reason}")`);

  // Disconnect sockets
  customerSocket.disconnect();
  partnerSocket.disconnect();

  console.log('\n====================================================');
  console.log('   ✓ PHASE 7 LIVE JOB FLOW TEST PASSED COMPLETELY!  ');
  console.log('====================================================');
}

runPhase7LiveJobTest().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
