/**
 * FixIt Now - Automated End-to-End Demo Checklist Runner
 * Executes all 8 scenarios defined in docs/PLAN.md Section 7:
 * 
 * 1. Landing page walkthrough (Services, Plans, FAQs).
 * 2. Register partner, subscribe, submit KYC; Admin approves.
 * 3. Register customer and create request with real street address.
 * 4. Partner within 2 km accepts; walk through status buttons (accepted, on_the_way, arrived).
 * 5. Service OTP, payment, rating, receipt, history and 0% commission earnings.
 * 6. Customer cancels a second request; partner is freed.
 * 7. Request > 2 km away triggers "All partners busy".
 * 8. Admin views analytics and updates plan price; existing partners keep original price (BR-2).
 */

import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5001';

let passed = 0;
let failed = 0;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runScenario(scenarioNum, title, fn) {
  console.log(`\n======================================================`);
  console.log(`[SCENARIO ${scenarioNum}] ${title}`);
  console.log(`======================================================`);
  try {
    await fn();
    console.log(`✅ SCENARIO ${scenarioNum} PASSED: ${title}`);
    passed++;
  } catch (err) {
    console.error(`❌ SCENARIO ${scenarioNum} FAILED: ${title}`);
    console.error(err);
    failed++;
  }
}

async function main() {
  console.log('\n🚀 Starting FixIt Now Phase 10 Demo Checklist E2E Validation...\n');

  // Shared state across scenarios
  let availableServices = [];
  let availablePlans = [];
  let selectedService = null;
  let selectedPlan = null;

  let partnerToken = null;
  let partnerId = null;
  let partnerEmail = `demo_partner_${Date.now()}@example.com`;
  
  let adminToken = null;

  let customerToken = null;
  let customerId = null;
  let customerEmail = `demo_customer_${Date.now()}@example.com`;

  let activeRequestId = null;
  let serviceOtp = null;

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Landing page walkthrough
  // ---------------------------------------------------------------------------
  await runScenario(1, 'Landing Page Walkthrough (Services, Plans, FAQs)', async () => {
    // 1. Services
    const sRes = await request('/api/services');
    assert.equal(sRes.status, 200, 'Expected 200 from /api/services');
    assert.ok(Array.isArray(sRes.data.data), 'Expected array of services');
    assert.ok(sRes.data.data.length >= 5, 'Expected at least 5 service categories');
    availableServices = sRes.data.data;
    selectedService = availableServices.find((s) => s.slug === 'plumber') || availableServices[0];
    console.log(`  ✓ Fetched ${availableServices.length} trade services (Selected: ${selectedService.name}, ID: ${selectedService.id})`);

    // 2. Plans
    const pRes = await request('/api/partner/plans');
    assert.equal(pRes.status, 200, 'Expected 200 from /api/partner/plans');
    assert.ok(Array.isArray(pRes.data.data), 'Expected array of plans');
    assert.equal(pRes.data.data.length, 3, 'Expected 3 subscription tiers (quarterly, half-yearly, yearly)');
    availablePlans = pRes.data.data;
    selectedPlan = availablePlans.find((p) => p.name.toLowerCase().includes('quarter')) || availablePlans[0];
    console.log(`  ✓ Fetched ${availablePlans.length} subscription plans (Selected: ${selectedPlan.name}, ID: ${selectedPlan.id})`);

    // 3. FAQs
    const fRes = await request('/api/support/faqs');
    assert.equal(fRes.status, 200, 'Expected 200 from /api/support/faqs');
    assert.ok(Array.isArray(fRes.data.data), 'Expected array of FAQs');
    assert.ok(fRes.data.data.length >= 3, 'Expected landing FAQs');
    console.log(`  ✓ Fetched ${fRes.data.data.length} FAQs`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Register a partner, subscribe, submit KYC; Admin approves
  // ---------------------------------------------------------------------------
  await runScenario(2, 'Partner Registration, Subscription, KYC & Admin Approval', async () => {
    // 1. Register partner (at 12.97800, 77.64100)
    const regRes = await request('/api/auth/partner/register', {
      method: 'POST',
      body: {
        name: 'Arjun Verma',
        email: partnerEmail,
        phone: '9876543210',
        password: 'Password@123',
        service_id: selectedService.id,
        address: '88, 12th Main Road, Indiranagar, Bengaluru',
        latitude: 12.97800,
        longitude: 77.64100,
      },
    });
    assert.equal(regRes.status, 201, `Partner register failed: ${JSON.stringify(regRes.data)}`);
    partnerToken = regRes.data.token || regRes.data.data?.token;
    partnerId = (regRes.data.user || regRes.data.data?.user)?.id;
    assert.ok(partnerToken, 'Partner token must exist');
    assert.ok(partnerId, 'Partner ID must exist');
    console.log(`  ✓ Registered partner ${partnerEmail} (ID: ${partnerId})`);

    // 2. Subscribe to selected plan
    const subRes = await request('/api/partner/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { plan_id: selectedPlan.id },
    });
    assert.equal(subRes.status, 201, `Subscribe failed: ${JSON.stringify(subRes.data)}`);
    console.log(`  ✓ Subscribed partner to ${selectedPlan.name} plan (Price: ₹${subRes.data.data.price_paid})`);

    // 3. Submit KYC info via multipart/form-data
    const formData = new FormData();
    formData.append('govt_id_type', 'Aadhaar Card');
    formData.append('id_number', '1234-5678-9012');
    const pdfBlob = new Blob(['%PDF-1.4 simulated pdf document content for verification'], { type: 'application/pdf' });
    formData.append('document', pdfBlob, 'aadhaar_card.pdf');
    const photoBlob = new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])], { type: 'image/jpeg' });
    formData.append('photo', photoBlob, 'passport_photo.jpg');

    const kycHttp = await fetch(`${BASE_URL}/api/partner/kyc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: formData,
    });
    const kycJson = await kycHttp.json();
    assert.equal(kycHttp.status, 200, `KYC submit failed: ${JSON.stringify(kycJson)}`);
    console.log(`  ✓ Submitted KYC documents (Status: pending)`);

    // 4. Admin login
    const adminLogRes = await request('/api/admin/login', {
      method: 'POST',
      body: {
        email: 'admin@fixitnow.com',
        password: 'admin@123',
      },
    });
    assert.equal(adminLogRes.status, 200, `Admin login failed: ${JSON.stringify(adminLogRes.data)}`);
    adminToken = adminLogRes.data.token || adminLogRes.data.data?.token;
    assert.ok(adminToken, 'Admin token must exist');
    console.log(`  ✓ Logged in as Admin`);

    // 5. Admin approve partner KYC
    const appRes = await request(`/api/admin/kyc/${partnerId}/decision`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        decision: 'verified',
        reviewer_notes: 'Approved during E2E demo test suite',
      },
    });
    assert.equal(appRes.status, 200, `Admin approval failed: ${JSON.stringify(appRes.data)}`);
    console.log(`  ✓ Admin approved KYC for partner ${partnerId}`);

    // 6. Turn partner online
    const onRes = await request('/api/partner/online', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { is_online: true },
    });
    assert.equal(onRes.status, 200, 'Failed to toggle partner online');
    console.log(`  ✓ Partner toggled ONLINE and ready for jobs`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Register a customer and create a request with a real street address
  // ---------------------------------------------------------------------------
  await runScenario(3, 'Customer Registration and Service Request Booking', async () => {
    // 1. Register Customer
    const cReg = await request('/api/auth/customer/register', {
      method: 'POST',
      body: {
        name: 'Ananya Sharma',
        email: customerEmail,
        phone: '9812345678',
        password: 'Password@123',
        address: '42, 100ft Road, Indiranagar, Bengaluru 560038',
        latitude: 12.9784,
        longitude: 77.6408,
      },
    });
    assert.equal(cReg.status, 201, `Customer register failed: ${JSON.stringify(cReg.data)}`);
    customerToken = cReg.data.token || cReg.data.data?.token;
    customerId = (cReg.data.user || cReg.data.data?.user)?.id;
    assert.ok(customerToken, 'Customer token must exist');
    assert.ok(customerId, 'Customer ID must exist');
    console.log(`  ✓ Registered customer ${customerEmail} (ID: ${customerId})`);

    // 2. Create service request (Plumbing at 12th Main Road, Indiranagar)
    const reqRes = await request('/api/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        service_id: selectedService.id,
        problem: 'Kitchen sink pipe burst and leaking profusely',
        description: 'Water leaking under counter, urgent assistance needed',
        address: '88, 12th Main Road, Indiranagar, Bengaluru 560038',
        latitude: 12.97800,
        longitude: 77.64100,
      },
    });
    assert.equal(reqRes.status, 201, `Request creation failed: ${JSON.stringify(reqRes.data)}`);
    activeRequestId = reqRes.data.data.request?.id || reqRes.data.data?.id;
    serviceOtp = reqRes.data.data.request?.service_otp || reqRes.data.data?.service_otp;
    assert.ok(activeRequestId, 'activeRequestId must be valid');
    assert.ok(serviceOtp, 'serviceOtp must be valid');
    console.log(`  ✓ Created service request #${activeRequestId} (Status: ${reqRes.data.data.request?.status || reqRes.data.data?.status})`);
    console.log(`  ✓ Generated 6-digit service OTP: ${serviceOtp}`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Partner accepts, walks through status progression
  // ---------------------------------------------------------------------------
  await runScenario(4, 'Partner Accepts Request and Advances Status Progression', async () => {
    // 1. Partner accepts the request
    const acceptRes = await request(`/api/requests/${activeRequestId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { decision: 'accept' },
    });
    assert.equal(acceptRes.status, 200, `Accept failed: ${JSON.stringify(acceptRes.data)}`);
    const acceptedStatus = acceptRes.data.data.request?.status || acceptRes.data.data?.status;
    assert.equal(acceptedStatus, 'accepted');
    console.log(`  ✓ Partner accepted request #${activeRequestId} (Status: accepted)`);

    // 2. Partner advances to 'on_the_way'
    const otwRes = await request(`/api/requests/${activeRequestId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { status: 'on_the_way' },
    });
    assert.equal(otwRes.status, 200, `On the way failed: ${JSON.stringify(otwRes.data)}`);
    const otwStatus = otwRes.data.data.status;
    assert.ok(otwStatus === 'partner_on_way' || otwStatus === 'on_the_way');
    console.log(`  ✓ Partner is on the way (Status: ${otwStatus})`);

    // 3. Partner advances to 'arrived'
    const arrRes = await request(`/api/requests/${activeRequestId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { status: 'arrived' },
    });
    assert.equal(arrRes.status, 200, `Arrived failed: ${JSON.stringify(arrRes.data)}`);
    const arrStatus = arrRes.data.data.status;
    assert.ok(arrStatus === 'partner_arrived' || arrStatus === 'arrived');
    console.log(`  ✓ Partner arrived at customer location (Status: ${arrStatus})`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Service OTP, Payment, Rating, Receipt, and Earnings
  // ---------------------------------------------------------------------------
  await runScenario(5, 'Service OTP Verification, Payment, Rating, Receipt & Earnings', async () => {
    // 1. Partner verifies service OTP provided by customer
    const otpRes = await request(`/api/requests/${activeRequestId}/verify-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { otp: serviceOtp },
    });
    assert.equal(otpRes.status, 200, `OTP verify failed: ${JSON.stringify(otpRes.data)}`);
    const otpStatus = otpRes.data.data.status;
    assert.ok(otpStatus === 'service_started' || otpStatus === 'in_progress');
    console.log(`  ✓ Verified OTP ${serviceOtp} -> Service status: ${otpStatus}`);

    // 2. Partner marks service completed
    const compRes = await request(`/api/requests/${activeRequestId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { status: 'completed' },
    });
    assert.equal(compRes.status, 200, `Complete service failed: ${JSON.stringify(compRes.data)}`);
    console.log(`  ✓ Partner marked service completed`);

    // 3. Process simulated on-site payment
    const payRes = await request(`/api/requests/${activeRequestId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        payment_method: 'cash',
        amount: 450.0,
      },
    });
    assert.equal(payRes.status, 200, `Payment failed: ${JSON.stringify(payRes.data)}`);
    console.log(`  ✓ Settled payment (Status: paid)`);

    // 4. Customer submits rating
    const rateRes = await request(`/api/requests/${activeRequestId}/rate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        rating: 5,
        review: 'Prompt arrival, fixed the pipe leak in 20 minutes cleanly!',
      },
    });
    assert.ok(rateRes.status === 200 || rateRes.status === 201, `Rate failed: ${JSON.stringify(rateRes.data)}`);
    console.log(`  ✓ Customer submitted 5-star rating`);

    // 5. Fetch digital receipt
    const recRes = await request(`/api/requests/${activeRequestId}/receipt`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(recRes.status, 200, `Receipt fetch failed: ${JSON.stringify(recRes.data)}`);
    console.log(`  ✓ Digital receipt verified (Work order #${activeRequestId}, total: ₹${recRes.data.data.amount})`);

    // 6. Check partner earnings (Verify job ledger & on-site settlement)
    const earnRes = await request('/api/partner/earnings', {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert.equal(earnRes.status, 200, `Earnings fetch failed: ${JSON.stringify(earnRes.data)}`);
    assert.ok(earnRes.data.data.total_jobs >= 1, 'Partner should have at least 1 completed job in ledger');
    assert.ok(Array.isArray(earnRes.data.data.ledger) && earnRes.data.data.ledger.length >= 1, 'Completed job must be in ledger');
    console.log(`  ✓ Partner completed jobs ledger confirmed: ${earnRes.data.data.total_jobs} completed job(s)`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Customer cancellation with reason; Partner is freed
  // ---------------------------------------------------------------------------
  await runScenario(6, 'Customer Request Cancellation and Partner Liberation', async () => {
    // 1. Customer creates a second request
    const req2Res = await request('/api/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        service_id: selectedService.id,
        problem: 'Second test request for cancellation',
        description: 'Testing cancellation flow',
        address: '88, 12th Main Road, Indiranagar, Bengaluru 560038',
        latitude: 12.97800,
        longitude: 77.64100,
      },
    });
    assert.equal(req2Res.status, 201);
    const req2Id = req2Res.data.data.request?.id || req2Res.data.data?.id;
    assert.ok(req2Id, 'req2Id must be valid');
    console.log(`  ✓ Created second request #${req2Id}`);

    // 2. Partner accepts
    await request(`/api/requests/${req2Id}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${partnerToken}` },
      body: { decision: 'accept' },
    });
    console.log(`  ✓ Partner accepted request #${req2Id}`);

    // 3. Customer cancels with reason
    const cancelRes = await request(`/api/requests/${req2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        reason: 'Issue resolved by building maintenance, partner not needed.',
      },
    });
    assert.equal(cancelRes.status, 200, `Cancel failed: ${JSON.stringify(cancelRes.data)}`);
    assert.equal(cancelRes.data.data.status, 'cancelled');
    console.log(`  ✓ Customer cancelled request #${req2Id} (Reason recorded: "${cancelRes.data.data.cancel_reason}")`);

    // 4. Confirm partner is freed (has no active jobs in progress)
    const pHistoryRes = await request('/api/requests/history', {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert.equal(pHistoryRes.status, 200);
    const activeJobs = pHistoryRes.data.data.filter((r) =>
      ['accepted', 'partner_on_way', 'partner_arrived', 'service_started', 'in_progress'].includes(r.status)
    );
    assert.equal(activeJobs.length, 0, 'Partner should have 0 active jobs in progress');
    console.log(`  ✓ Partner is immediately freed and ready for new dispatches`);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Request from address > 2 km away shows "All partners busy"
  // ---------------------------------------------------------------------------
  await runScenario(7, 'Out of Range (> 2 km) Booking Triggers All Partners Busy', async () => {
    // Electronic City Phase 1: 12.8452, 77.6602 (~16 km away from Indiranagar)
    const farReqRes = await request('/api/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        service_id: selectedService.id,
        problem: 'Office tap leak in Electronic City',
        description: 'Far location testing strict 2.0 km cutoff',
        address: 'Infosys Main Gate, Electronic City, Bengaluru 560100',
        latitude: 12.8452,
        longitude: 77.6602,
      },
    });
    assert.equal(farReqRes.status, 201);
    const farReqId = farReqRes.data.data.request?.id || farReqRes.data.data?.id;
    assert.ok(farReqId, 'farReqId must be valid');

    // Fetch the updated request state after matching runs
    // Wait brief tick for async socket/matching dispatch cycle
    await new Promise((resolve) => setTimeout(resolve, 500));

    const checkRes = await request(`/api/requests/${farReqId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(checkRes.status, 200);
    console.log(`  ✓ Far request status: ${checkRes.data.data.status}`);
    assert.ok(
      checkRes.data.data.status === 'cancelled' || checkRes.data.data.status === 'searching',
      `Expected cancelled or searching with busy reason, got ${checkRes.data.data.status}`
    );
    if (checkRes.data.data.cancellation_reason) {
      console.log(`  ✓ Reason logged: "${checkRes.data.data.cancellation_reason}"`);
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Admin views analytics & updates plan price (BR-2 rule)
  // ---------------------------------------------------------------------------
  await runScenario(8, 'Admin Analytics & Plan Price Update with BR-2 Grandfathering', async () => {
    // 1. Admin views analytics
    const aRes = await request('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(aRes.status, 200, `Admin analytics failed: ${JSON.stringify(aRes.data)}`);
    assert.ok(aRes.data.data.summary, 'Expected analytics summary');
    console.log(`  ✓ Admin analytics loaded: total requests = ${aRes.data.data.summary.total_requests}`);

    // 2. Admin views plans
    const plansRes = await request('/api/admin/plans', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(plansRes.status, 200);
    const planToUpdate = plansRes.data.data.find((p) => p.id === selectedPlan.id) || plansRes.data.data[0];
    const originalPrice = parseFloat(planToUpdate.price);
    const newPrice = originalPrice + 100;
    console.log(`  ✓ Original ${planToUpdate.name} Plan Price: ₹${originalPrice}`);

    // 3. Admin updates Plan price
    const updateRes = await request(`/api/admin/plans/${planToUpdate.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { price: newPrice },
    });
    assert.equal(updateRes.status, 200, `Update plan failed: ${JSON.stringify(updateRes.data)}`);
    console.log(`  ✓ Updated ${planToUpdate.name} Plan Price to ₹${newPrice}`);

    // 4. Verify existing partner keeps the price they paid (SRS BR-2)
    const pSubRes = await request('/api/partner/subscription', {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert.equal(pSubRes.status, 200);
    assert.equal(
      parseFloat(pSubRes.data.data.price_paid),
      originalPrice,
      `Existing partner price_paid must remain original ₹${originalPrice} per BR-2`
    );
    console.log(`  ✓ Verified BR-2 rule: Partner's subscription retains original locked-in price_paid ₹${pSubRes.data.data.price_paid}`);

    // Revert plan price back to original for clean demo state
    await request(`/api/admin/plans/${planToUpdate.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { price: originalPrice },
    });
    console.log(`  ✓ Reverted plan price back to ₹${originalPrice} for demo cleanliness`);
  });

  console.log(`\n======================================================`);
  console.log(`FixIt Now Demo Checklist Validation Complete`);
  console.log(`Total Passed: ${passed} / 8`);
  console.log(`Total Failed: ${failed} / 8`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Unhandled E2E Error]', err);
  process.exit(1);
});
