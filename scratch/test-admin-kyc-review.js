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
  return { status: res.status, headers: res.headers, data };
}

async function runAdminKycTest() {
  console.log('===============================================================');
  console.log('Testing Admin KYC Document/Image Viewing & Status Update');
  console.log('===============================================================\n');

  // Step 1: Admin logs in
  console.log('Step 1: Authenticating Admin...');
  const adminLogin = await request('/admin/login', {
    method: 'POST',
    body: { email: 'admin@fixitnow.com', password: 'admin@123' },
  });
  assert.equal(adminLogin.status, 200, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated successfully.\n');

  // Step 2: Fetch Admin KYC list
  console.log('Step 2: Retrieving Partner KYC Dossiers via GET /api/admin/kyc...');
  const kycListRes = await request('/admin/kyc', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(kycListRes.status, 200, `Failed to fetch KYC list: ${JSON.stringify(kycListRes.data)}`);
  const dossiers = kycListRes.data.data;
  assert.ok(Array.isArray(dossiers), 'Dossiers should be an array');
  console.log(`✓ Retrieved ${dossiers.length} partner KYC dossiers.`);

  // Find a partner dossier with at least one document
  let targetDossier = dossiers.find((d) => d.documents && d.documents.length > 0);
  let docId = null;

  if (targetDossier && targetDossier.documents.length > 0) {
    docId = targetDossier.documents[0].id;
    console.log(`✓ Found target partner #${targetDossier.partner_id} (${targetDossier.partner_name}) with document #${docId}`);
  } else {
    // If no dossier has documents, register a partner and submit KYC
    console.log('No existing dossiers with documents. Registering test partner with KYC documents...');
    const rand = Date.now();
    const partnerEmail = `kyc_test_partner_${rand}@example.com`;
    const regRes = await request('/auth/partner/register', {
      method: 'POST',
      body: {
        name: `Kyc Test Partner ${rand.toString().slice(-4)}`,
        email: partnerEmail,
        phone: `98711${rand.toString().slice(-5)}`,
        address: '100 Compliance Road, Indiranagar, Bengaluru',
        service_id: 1,
        vehicle: 'Two-Wheeler',
        password: 'Password@123',
      },
    });
    assert.equal(regRes.status, 201, 'Partner registration failed');
    const partnerToken = regRes.data.token;
    const partnerId = regRes.data.user.id;

    // Upload mock KYC document via FormData
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="govt_id_type"\r\n\r\nAadhaar Card\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="id_number"\r\n\r\n1234-5678-9012\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="document"; filename="aadhaar_card.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n%PDF-1.4 mock pdf content\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="passport_photo.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\nmock jpeg content\r\n` +
      `--${boundary}--\r\n`;

    const uploadRes = await fetch(`${BASE_URL}/partner/kyc`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${partnerToken}`,
      },
      body: multipartBody,
    });
    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 200, `Upload failed: ${JSON.stringify(uploadData)}`);
    console.log(`✓ Created test partner #${partnerId} with KYC documents uploaded.`);

    // Refresh list
    const refreshed = await request('/admin/kyc', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    targetDossier = refreshed.data.data.find((d) => String(d.partner_id) === String(partnerId));
    assert.ok(targetDossier, 'New partner dossier must be in admin KYC list');
    docId = targetDossier.documents[0].id;
  }

  // Step 3: Test document/image viewing via query token
  console.log(`\nStep 3: Admin viewing KYC document #${docId} via GET /api/partner/kyc/document/${docId}?token=...`);
  const viewUrl = `${BASE_URL}/partner/kyc/document/${docId}?token=${encodeURIComponent(adminToken)}`;
  const viewRes = await fetch(viewUrl, { method: 'GET' });

  console.log(`Status: ${viewRes.status}`);
  console.log(`Content-Type: ${viewRes.headers.get('content-type')}`);
  console.log(`Content-Disposition: ${viewRes.headers.get('content-disposition')}`);
  assert.equal(viewRes.status, 200, `Failed to view document with admin query token: HTTP ${viewRes.status}`);
  const contentType = viewRes.headers.get('content-type') || '';
  assert.ok(
    contentType.includes('image/') || contentType.includes('pdf') || contentType.includes('application/octet-stream'),
    `Unexpected content-type: ${contentType}`
  );
  console.log('✓ VERIFIED: Admin can securely view KYC document/image in browser!\n');

  // Step 4: Admin updates KYC status to 'verified' (Approve)
  console.log(`Step 4: Admin updating partner #${targetDossier.partner_id} KYC status to 'verified'...`);
  const approveRes = await request(`/admin/kyc/${targetDossier.partner_id}/decision`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      decision: 'verified',
      reviewer_notes: 'Government ID and trade credentials fully verified by Admin.',
    },
  });
  assert.equal(approveRes.status, 200, `Approve failed: ${JSON.stringify(approveRes.data)}`);
  assert.equal(approveRes.data.status, 'success');
  console.log(`✓ Status updated to 'verified': ${approveRes.data.message}`);

  // Verify status reflects in API
  const checkVerified = await request('/admin/kyc', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const updatedDossier1 = checkVerified.data.data.find(
    (d) => String(d.partner_id) === String(targetDossier.partner_id)
  );
  assert.equal(updatedDossier1.status, 'verified', 'Partner status must be verified');
  console.log(`✓ VERIFIED: Admin KYC list reflects partner status = 'verified'.\n`);

  // Step 5: Admin updates KYC status to 'rejected' with mandatory reason
  console.log(`Step 5: Admin updating partner #${targetDossier.partner_id} KYC status to 'rejected'...`);
  const rejectRes = await request(`/admin/kyc/${targetDossier.partner_id}/decision`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      decision: 'rejected',
      rejection_reason: 'Passport photograph is blurry; please re-upload clear photo.',
      reviewer_notes: 'Decline for re-submission of clear photograph.',
    },
  });
  assert.equal(rejectRes.status, 200, `Reject failed: ${JSON.stringify(rejectRes.data)}`);
  assert.equal(rejectRes.data.status, 'success');
  console.log(`✓ Status updated to 'rejected': ${rejectRes.data.message}`);

  // Verify status and rejection reason reflect in API
  const checkRejected = await request('/admin/kyc', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const updatedDossier2 = checkRejected.data.data.find(
    (d) => String(d.partner_id) === String(targetDossier.partner_id)
  );
  assert.equal(updatedDossier2.status, 'rejected', 'Partner status must be rejected');
  assert.ok(
    updatedDossier2.rejection_reason.includes('blurry'),
    `Rejection reason mismatch: ${updatedDossier2.rejection_reason}`
  );
  console.log(`✓ VERIFIED: Admin KYC list reflects partner status = 'rejected' with reason: "${updatedDossier2.rejection_reason}".\n`);

  // Step 6: Verify Admin Activity Log contains the actions
  console.log('Step 6: Checking Activity Log for audit compliance...');
  const actRes = await request('/admin/activity-log', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(actRes.status, 200);
  const kycLogs = actRes.data.data.filter((l) => l.action === 'KYC_APPROVED' || l.action === 'KYC_REJECTED');
  assert.ok(kycLogs.length >= 2, 'Activity log should contain KYC_APPROVED and KYC_REJECTED events');
  console.log(`✓ VERIFIED: Admin activity log registered ${kycLogs.length} KYC decision audit entries.\n`);

  // Step 7: Cleanly restore partner to verified
  await request(`/admin/kyc/${targetDossier.partner_id}/decision`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      decision: 'verified',
      reviewer_notes: 'Verified after compliance audit.',
    },
  });

  console.log('===============================================================');
  console.log('ALL TESTS PASSED: Admin KYC Document Viewing & Status Update OK');
  console.log('===============================================================');
}

runAdminKycTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
