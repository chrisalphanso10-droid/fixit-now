/**
 * End-to-End Test for Phase 5 Exit Criterion:
 * "Stop when I can approve a partner's KYC as admin and the partner's dashboard unlocks."
 */

import { query } from '../src/config/db.js';

const PORT = process.env.PORT || 5001;
const API_BASE = `http://localhost:${PORT}/api`;

async function runE2ETest() {
  console.log('====================================================');
  console.log('PHASE 5 END-TO-END VERIFICATION: KYC APPROVAL & UNLOCK');
  console.log('====================================================\n');

  try {
    // Step 1: Admin logs in
    console.log('1. Admin logs in with credentials...');
    const adminLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fixitnow.com',
        password: 'admin@123',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || !adminLoginData.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }
    const adminToken = adminLoginData.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };
    console.log('✓ Admin authenticated successfully.');

    // Step 2: Register a new test partner with pending KYC
    const unique = Date.now();
    const partnerEmail = `test.partner.${unique}@fixitnow.local`;
    console.log(`\n2. Registering new partner (${partnerEmail})...`);
    
    // Fetch a service category id
    const serviceRes = await query('SELECT id FROM services WHERE active = true LIMIT 1');
    const serviceId = serviceRes.rows[0].id;

    const partnerRegRes = await fetch(`${API_BASE}/auth/partner/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'partner',
        name: `Kavita Electrician ${unique}`,
        email: partnerEmail,
        password: 'Password@123',
        phone: '9876543210',
        address: '12th Main Road, Indiranagar, Bengaluru',
        service_id: serviceId,
        vehicle: 'Hero Electric Scooter',
      }),
    });
    const partnerRegData = await partnerRegRes.json();
    if (partnerRegRes.status !== 201) {
      throw new Error(`Partner registration failed: ${JSON.stringify(partnerRegData)}`);
    }
    const partnerId = partnerRegData.user.id;
    const partnerToken = partnerRegData.token;
    const partnerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${partnerToken}`,
    };
    console.log(`✓ Partner registered with ID: ${partnerId}`);

    // Step 3: Partner subscribes to a plan (Quarterly)
    console.log('\n3. Partner subscribes to Quarterly plan...');
    const planRes = await query("SELECT id FROM plans WHERE name = 'quarterly' LIMIT 1");
    const planId = planRes.rows[0].id;

    const subRes = await fetch(`${API_BASE}/partner/subscribe`, {
      method: 'POST',
      headers: partnerHeaders,
      body: JSON.stringify({ plan_id: planId }),
    });
    const subData = await subRes.json();
    if (subRes.status !== 201) {
      throw new Error(`Subscription failed: ${JSON.stringify(subData)}`);
    }
    console.log('✓ Partner subscribed successfully.');

    // Step 4: Partner submits KYC documents
    console.log('\n4. Partner submits KYC documents...');
    // Create mock kyc_documents in DB for this test partner
    await query(
      `INSERT INTO kyc_documents (partner_id, document_type, file_path, file_name, original_name, file_type, file_size, status)
       VALUES ($1, 'aadhaar', '/uploads/test_aadhaar.pdf', 'test_aadhaar.pdf', 'National_Aadhaar_ID.pdf', 'application/pdf', 102400, 'pending'),
              ($1, 'passport_photo', '/uploads/test_photo.jpg', 'test_photo.jpg', 'Passport_Photo.jpg', 'image/jpeg', 51200, 'pending')`,
      [partnerId]
    );
    await query("UPDATE partners SET kyc_status = 'pending' WHERE id = $1", [partnerId]);
    console.log('✓ KYC documents submitted. Partner KYC status is now PENDING.');

    // Step 5: Check Partner Dashboard before approval -> MUST BE LOCKED
    console.log('\n5. Verifying partner dashboard state BEFORE admin approval...');
    const dashBeforeRes = await fetch(`${API_BASE}/partner/dashboard`, { headers: partnerHeaders });
    const dashBeforeData = await dashBeforeRes.json();
    const partnerBefore = dashBeforeData.data.partner;
    console.log(`Partner KYC Status: ${partnerBefore.kyc_status}`);
    if (partnerBefore.kyc_status === 'verified') {
      throw new Error('Partner should NOT be verified yet!');
    }

    // Attempting to go online before KYC approval -> MUST BE REJECTED
    const onlineFailRes = await fetch(`${API_BASE}/partner/online`, {
      method: 'PUT',
      headers: partnerHeaders,
    });
    console.log(`Attempt to go online without verified KYC returned HTTP ${onlineFailRes.status}`);
    if (onlineFailRes.status !== 403) {
      throw new Error('Partner should be blocked from going online without verified KYC (SRS FR-P7, BR-5)!');
    }
    console.log('✓ Partner dashboard is LOCKED. Cannot go online.');

    // Step 6: Admin views KYC queue
    console.log('\n6. Admin queries KYC queue...');
    const kycQueueRes = await fetch(`${API_BASE}/admin/kyc`, { headers: adminHeaders });
    const kycQueueData = await kycQueueRes.json();
    const partnerDossier = kycQueueData.data.find((d) => d.partner_id === partnerId);
    if (!partnerDossier) {
      throw new Error('Partner dossier was not found in admin KYC queue!');
    }
    console.log(`✓ Admin found dossier for ${partnerDossier.partner_name} with ${partnerDossier.documents.length} submitted documents.`);

    // Step 7: Admin APPROVES partner KYC
    console.log('\n7. Admin approves partner KYC...');
    const approveRes = await fetch(`${API_BASE}/admin/kyc/${partnerId}/decision`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        decision: 'verified',
        reviewer_notes: 'Govt Aadhaar ID & Photo verified in audit.',
      }),
    });
    const approveData = await approveRes.json();
    if (approveRes.status !== 200 || approveData.data.kyc_status !== 'verified') {
      throw new Error(`Admin KYC approval failed: ${JSON.stringify(approveData)}`);
    }
    console.log('✓ Admin successfully verified partner KYC!');

    // Step 8: Verify Activity Log recorded the event
    console.log('\n8. Verifying event recorded in Activity Log...');
    const actRes = await fetch(`${API_BASE}/admin/activity-log`, { headers: adminHeaders });
    const actData = await actRes.json();
    const latestEvent = actData.data[0];
    if (latestEvent.action !== 'KYC_APPROVED' || latestEvent.details?.partner_id !== partnerId) {
      throw new Error(`Expected KYC_APPROVED in activity log for partner ${partnerId}, got: ${JSON.stringify(latestEvent)}`);
    }
    console.log(`✓ Activity log recorded: [${latestEvent.action}] ${latestEvent.actor} -> Partner #${partnerId}`);

    // Step 9: Verify Partner Dashboard UNLOCKS!
    console.log('\n9. Verifying partner dashboard state AFTER admin approval...');
    const dashAfterRes = await fetch(`${API_BASE}/partner/dashboard`, { headers: partnerHeaders });
    const dashAfterData = await dashAfterRes.json();
    const partnerAfter = dashAfterData.data.partner;
    console.log(`Partner KYC Status: ${partnerAfter.kyc_status}`);
    if (partnerAfter.kyc_status !== 'verified') {
      throw new Error(`Partner should now be verified, but is ${partnerAfter.kyc_status}`);
    }

    // Partner toggles online -> MUST SUCCEED NOW!
    const onlineSuccessRes = await fetch(`${API_BASE}/partner/online`, {
      method: 'PUT',
      headers: partnerHeaders,
    });
    const onlineSuccessData = await onlineSuccessRes.json();
    if (onlineSuccessRes.status !== 200 || !onlineSuccessData.online) {
      throw new Error(`Partner failed to go online after KYC verification: ${JSON.stringify(onlineSuccessData)}`);
    }
    console.log(`✓ Partner radar unlocked! Partner is now ONLINE: "${onlineSuccessData.message}"`);

    console.log('\n====================================================');
    console.log('ALL PHASE 5 EXIT CRITERIA MET AND VERIFIED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('E2E Test Failed:', err);
    process.exit(1);
  }
}

runE2ETest();
