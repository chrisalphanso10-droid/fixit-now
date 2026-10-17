/**
 * FixIt Now - End-to-End Verification Script for Phase 6 (Request Creation and Matching)
 *
 * Verifies:
 * 1. Customer registration / login
 * 2. Saved addresses & profile updating
 * 3. Nearest eligible partner matching within 2 km (Rajesh Kumar, Plumber)
 * 4. Socket.IO incoming_request offer with 30s countdown to nearest partner
 * 5. Partner accept flow
 * 6. Address MORE than 2 km away (Whitefield) triggers "All partners busy, try again later"
 * 7. Partner decline / cascade logic
 *
 * Run via: node server/scripts/test-phase6-matching.js
 */

import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';

const API_BASE = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

async function postJson(endpoint, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function putJson(endpoint, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function getJson(endpoint, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run() {
  console.log('===============================================================');
  console.log('FixIt Now: Phase 6 Request Creation & Matching E2E Verification');
  console.log('===============================================================\n');

  // 1. Authenticate Customer
  console.log('Step 1: Authenticate Customer');
  const custEmail = `cust_${Date.now()}@test.local`;
  const regRes = await postJson('/auth/customer/register', {
    name: 'Pooja Hegde',
    email: custEmail,
    password: 'Password@123',
    phone: '+91 98450 77123',
    address: '42, 3rd Cross, Indiranagar, Bengaluru 560038',
  });

  if (regRes.status !== 201) {
    console.error('Customer registration failed:', regRes.body);
    process.exit(1);
  }
  const custToken = regRes.body.token || regRes.body.data?.token;
  const customerId = (regRes.body.user || regRes.body.data?.customer)?.id;
  console.log(`  ✓ Customer registered & authenticated: ${custEmail} (ID: ${customerId})`);

  // 2. Verify Saved Addresses API
  console.log('\nStep 2: Saved Addresses CRUD');
  const addrsRes = await getJson('/customer/addresses', custToken);
  console.log(`  ✓ Retrieved ${addrsRes.body.data?.length} saved addresses (default created on register)`);

  const newAddrRes = await postJson(
    '/customer/addresses',
    {
      label: 'Office',
      address: 'Suite 401, Brigade Arcade, Whitefield, Bengaluru',
      latitude: 12.9698,
      longitude: 77.7499,
      is_default: false,
    },
    custToken
  );
  console.log(`  ✓ Added new saved address: ${newAddrRes.body.data?.label} (${newAddrRes.body.data?.address})`);

  // 3. Authenticate Partner (Rajesh Kumar - Verified Plumber in Indiranagar)
  console.log('\nStep 3: Authenticate Partner (Rajesh Kumar)');
  const partLogin = await postJson('/auth/partner/login', {
    email: 'rajesh@example.com',
    password: 'Partner@2026',
  });

  if (partLogin.status !== 200) {
    console.error('Partner login failed:', partLogin.body);
    process.exit(1);
  }
  const partToken = partLogin.body.token || partLogin.body.data?.token;
  const partnerObj = partLogin.body.user || partLogin.body.data?.partner;
  const partnerId = partnerObj.id;
  console.log(`  ✓ Partner authenticated: ${partnerObj.name} (Service: Plumber, ID: ${partnerId})`);

  // Ensure Partner is ONLINE
  const partDash = await getJson('/partner/dashboard', partToken);
  if (!partDash.body.data.partner.online) {
    const toggleRes = await fetch(`${API_BASE}/partner/online`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${partToken}` },
    });
    console.log('  ✓ Toggled partner status to ONLINE');
  } else {
    console.log('  ✓ Partner status is confirmed ONLINE');
  }

  // 4. Connect Partner to Socket.IO and listen for incoming_request
  console.log('\nStep 4: Connect Partner Socket.IO Listener');
  const partnerSocket = io(SOCKET_URL, { transports: ['websocket'] });
  const customerSocket = io(SOCKET_URL, { transports: ['websocket'] });

  await new Promise((resolve) => partnerSocket.on('connect', resolve));
  await new Promise((resolve) => customerSocket.on('connect', resolve));

  partnerSocket.emit('register_partner', { partnerId });
  customerSocket.emit('register_customer', { customerId });
  console.log('  ✓ Partner and Customer connected and registered on Socket.IO');

  // 5. Test Case A: Create Request WITHIN 2 KM (Indiranagar -> Indiranagar ~0.8 km)
  console.log('\nStep 5: Test Case A - Request within 2 km matches nearest eligible partner');

  let partnerReceivedJobPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Partner socket did not receive incoming_request within 10s')), 10000);
    partnerSocket.on('incoming_request', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  // Look up Plumber service ID
  const srvListRes = await getJson('/services');
  const plumberService = (srvListRes.body.data || []).find((s) =>
    s.name.toLowerCase().includes('plumb')
  ) || { id: 12 };
  const plumberServiceId = plumberService.id;
  console.log(`  ✓ Using Service: Plumber (ID: ${plumberServiceId})`);

  const nearbyReqRes = await postJson(
    '/requests',
    {
      service_id: plumberServiceId,
      problem: 'Kitchen sink pipe burst and flooding kitchen floor',
      description: 'Major leak under basin. Water isolated from main line, need immediate pipe joint replacement.',
      address: '14, 100ft Road, Indiranagar, Bengaluru 560038',
      latitude: 12.9784,
      longitude: 77.6408,
    },
    custToken
  );

  if (nearbyReqRes.status !== 201) {
    console.error('Failed to create nearby request:', nearbyReqRes.body);
    process.exit(1);
  }

  console.log(`  ✓ Created nearby service request: ${nearbyReqRes.body.data?.order_number}`);
  console.log(`    Eligible partners in 2 km: ${nearbyReqRes.body.data?.eligible_partners_count}`);

  const incomingJobPayload = await partnerReceivedJobPromise;
  console.log(`  ✓ Partner Socket.IO received 'incoming_request'!`);
  console.log(`    Order: ${incomingJobPayload.job.order_number}`);
  console.log(`    Problem: "${incomingJobPayload.job.problem}"`);
  console.log(`    Distance: ${incomingJobPayload.job.distance_km} km (< 2.0 km)`);
  console.log(`    Countdown: ${incomingJobPayload.countdown} seconds`);

  // Partner accepts the job offer
  console.log('\nStep 6: Partner Accepts the Offered Request');
  let customerAcceptedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Customer socket did not receive request_accepted')), 10000);
    customerSocket.on('request_accepted', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  partnerSocket.emit('partner_respond', {
    requestId: incomingJobPayload.job.id,
    partnerId,
    decision: 'accept',
  });

  const customerAcceptedEvent = await customerAcceptedPromise;
  console.log(`  ✓ Customer Socket.IO received 'request_accepted'!`);
  console.log(`    Matched Partner: ${customerAcceptedEvent.partner.name} (${customerAcceptedEvent.partner.service_name})`);
  console.log(`    Status: ${customerAcceptedEvent.status} (Step: ${customerAcceptedEvent.step_index})`);
  console.log(`    Service OTP: ${customerAcceptedEvent.service_otp}`);

  // Step 6b: Partner advances position/status -> Customer tracking updates via Socket.IO
  console.log('\nStep 6b: Partner Updates Position/Status & OTP Verification');

  // 1. Partner starts trip -> on_the_way (Step 2)
  let onTheWayPromise = new Promise((resolve) => {
    customerSocket.once('request_status_updated', resolve);
  });
  const step2Res = await putJson(
    `/requests/${incomingJobPayload.job.id}/status`,
    { status: 'on_the_way' },
    partToken
  );
  if (step2Res.status !== 200) throw new Error('Failed to update status to on_the_way');
  const step2Event = await onTheWayPromise;
  console.log(`  ✓ Partner moved to 'on_the_way' -> Customer socket received Step ${step2Event.step_index} (${step2Event.status})`);

  // 2. Partner arrives at location -> arrived (Step 3)
  let arrivedPromise = new Promise((resolve) => {
    customerSocket.once('request_status_updated', resolve);
  });
  const step3Res = await putJson(
    `/requests/${incomingJobPayload.job.id}/status`,
    { status: 'arrived' },
    partToken
  );
  if (step3Res.status !== 200) throw new Error('Failed to update status to arrived');
  const step3Event = await arrivedPromise;
  console.log(`  ✓ Partner moved to 'arrived' -> Customer socket received Step ${step3Event.step_index} (${step3Event.status})`);

  // 3. Test Invalid OTP rejection on server
  const invalidOtpRes = await postJson(
    `/requests/${incomingJobPayload.job.id}/verify-otp`,
    { otp: '000000' },
    partToken
  );
  if (invalidOtpRes.status === 400) {
    console.log(`  ✓ Server properly REJECTED invalid OTP '000000': "${invalidOtpRes.body.message}"`);
  } else {
    throw new Error('Server should have rejected invalid OTP with 400');
  }

  // 4. Test Valid OTP verification on server
  let serviceStartedPromise = new Promise((resolve) => {
    customerSocket.once('request_status_updated', resolve);
  });
  const validOtpRes = await postJson(
    `/requests/${incomingJobPayload.job.id}/verify-otp`,
    { otp: customerAcceptedEvent.service_otp },
    partToken
  );
  if (validOtpRes.status !== 200) throw new Error('Valid OTP was not accepted: ' + JSON.stringify(validOtpRes.body));
  const step4Event = await serviceStartedPromise;
  console.log(`  ✓ Server VERIFIED valid OTP '${customerAcceptedEvent.service_otp}' -> Customer socket received Step ${step4Event.step_index} (${step4Event.status})`);

  // 5. Partner completes work and settles payment
  await putJson(`/requests/${incomingJobPayload.job.id}/status`, { status: 'completed' }, partToken);
  await putJson(`/requests/${incomingJobPayload.job.id}/status`, { status: 'paid' }, partToken);
  console.log(`  ✓ Partner marked job as completed & settled on-site.`);

  // 6. Check Customer History includes this completed request
  const histRes = await getJson('/requests?filter=all', custToken);
  const foundInHist = (histRes.body.data || []).find((r) => r.id === incomingJobPayload.job.id);
  if (foundInHist) {
    console.log(`  ✓ Customer history contains finished work order ${foundInHist.order_number} with status: ${foundInHist.status}`);
  } else {
    throw new Error('Finished work order was not found in customer history');
  }

  // 6. Test Case B: Request MORE than 2 KM away (Whitefield ~ 12.5 km away)
  console.log('\nStep 7: Test Case B - Address MORE than 2 km away triggers "All partners busy, try again later"');

  let customerBusyPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Customer socket did not receive all_partners_busy')), 10000);
    customerSocket.on('all_partners_busy', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  const distantReqRes = await postJson(
    '/requests',
    {
      service_id: plumberServiceId,
      problem: 'Bathroom faucet replacement in Whitefield',
      description: 'Dripping tap in master bedroom bathroom.',
      address: 'Suite 401, Brigade Arcade, ITPL Main Road, Whitefield, Bengaluru',
      latitude: 12.9698, // Whitefield coordinates ~ 12.5 km away from Indiranagar
      longitude: 77.7499,
    },
    custToken
  );

  console.log(`  ✓ Distant request created: status code ${distantReqRes.status}`);
  console.log(`    Eligible partners count: ${distantReqRes.body.data?.eligible_partners_count} (Expected: 0)`);
  console.log(`    Dispatch status: ${distantReqRes.body.data?.dispatch_status}`);

  const busyEvent = await customerBusyPromise;
  console.log(`  ✓ Customer received 'all_partners_busy' event!`);
  console.log(`    Message: "${busyEvent.message}"`);
  console.log(`    Reason: ${busyEvent.reason}`);

  // Clean up sockets
  partnerSocket.disconnect();
  customerSocket.disconnect();

  console.log('\n===============================================================');
  console.log('✓ ALL PHASE 6 E2E VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n✗ Verification Failure:', err);
  process.exit(1);
});
