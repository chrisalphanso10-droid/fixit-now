import { pool } from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING PHASE 3 AUTH & RBAC VERIFICATION ---');

  // Test 1: Fetch active services
  const servRes = await fetch(`${BASE_URL}/services`);
  const servData = await servRes.json();
  console.log('✓ 1. Active Services fetched:', servData.data.length, 'services');

  // Test 2: Admin Login
  const adminRes = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fixitnow.com', password: 'admin@123' })
  });
  const adminData = await adminRes.json();
  if (!adminRes.ok || adminData.user.role !== 'admin') {
    throw new Error('Admin login failed: ' + JSON.stringify(adminData));
  }
  const adminToken = adminData.token;
  console.log('✓ 2. Admin Login successful. Role:', adminData.user.role, 'Token received.');

  // Test 3: Customer Registration & Password Policy
  // Weak password test (too short)
  const weakShortRes = await fetch(`${BASE_URL}/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Weak User',
      email: 'weak@example.com',
      password: '123',
      phone: '9876543210',
      address: 'Indiranagar, Bengaluru'
    })
  });
  if (weakShortRes.status === 400) {
    console.log('✓ 3a. Weak password (<6 chars) properly rejected with 400');
  } else {
    throw new Error('Weak password was not rejected!');
  }

  // Weak password test (missing special char)
  const weakNoSpecialRes = await fetch(`${BASE_URL}/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'No Special',
      email: 'nospecial@example.com',
      password: 'password123',
      phone: '9876543210',
      address: 'Indiranagar, Bengaluru'
    })
  });
  if (weakNoSpecialRes.status === 400) {
    console.log('✓ 3b. Weak password (no special char) properly rejected with 400');
  } else {
    throw new Error('Weak password without special char was not rejected!');
  }

  // Valid registration
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const custEmail = `verify_cust_${rand}@example.com`;
  const custPass = 'Test@FixIt2026';
  const custRegRes = await fetch(`${BASE_URL}/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Test Customer ${rand}`,
      email: custEmail,
      password: custPass,
      phone: `9810${rand}`,
      address: '100 Feet Road, Indiranagar, Bengaluru'
    })
  });
  const custRegData = await custRegRes.json();
  if (!custRegRes.ok || custRegData.user.role !== 'customer') {
    throw new Error('Customer registration failed: ' + JSON.stringify(custRegData));
  }
  const custToken = custRegData.token;
  console.log('✓ 3c. Customer registered with geocoded coordinates:', custRegData.user.latitude, custRegData.user.longitude);

  // Test 4: Customer Login
  const custLoginRes = await fetch(`${BASE_URL}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail, password: custPass })
  });
  const custLoginData = await custLoginRes.json();
  if (!custLoginRes.ok || custLoginData.user.role !== 'customer') {
    throw new Error('Customer login failed: ' + JSON.stringify(custLoginData));
  }
  console.log('✓ 4. Customer Login successful. User ID:', custLoginData.user.id);

  // Test 5: Partner Registration (Exactly 1 service required)
  const partEmail = `verify_partner_${rand}@example.com`;
  const partPass = 'Partner@2026!';
  const partRegRes = await fetch(`${BASE_URL}/auth/partner/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Partner Tech ${rand}`,
      email: partEmail,
      password: partPass,
      phone: `9920${rand}`,
      address: 'HAL 2nd Stage, Indiranagar, Bengaluru',
      service_id: servData.data[0].id
    })
  });
  const partRegData = await partRegRes.json();
  if (!partRegRes.ok || partRegData.user.role !== 'partner') {
    throw new Error('Partner registration failed: ' + JSON.stringify(partRegData));
  }
  const partToken = partRegData.token;
  console.log('✓ 5. Partner registered. Service:', partRegData.user.service_name, 'KYC status:', partRegData.user.kyc_status);

  // Test 6: Partner Login
  const partLoginRes = await fetch(`${BASE_URL}/auth/partner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: partEmail, password: partPass })
  });
  const partLoginData = await partLoginRes.json();
  if (!partLoginRes.ok || partLoginData.user.role !== 'partner') {
    throw new Error('Partner login failed: ' + JSON.stringify(partLoginData));
  }
  console.log('✓ 6. Partner login successful.');

  // Test 7: Verify Session via /api/auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${partToken}` }
  });
  const meData = await meRes.json();
  if (!meRes.ok || meData.user.role !== 'partner') {
    throw new Error('/api/auth/me failed: ' + JSON.stringify(meData));
  }
  console.log('✓ 7. /api/auth/me verified active token for role:', meData.user.role);

  // Test 8: Forgot Password with OTP Flow
  const forgotRes = await fetch(`${BASE_URL}/auth/customer/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail })
  });
  const forgotData = await forgotRes.json();
  if (!forgotRes.ok) throw new Error('Forgot password request failed: ' + JSON.stringify(forgotData));
  console.log('✓ 8a. Forgot password request initiated for:', custEmail);

  // Fetch the OTP from the database
  const otpQuery = await pool.query(
    'SELECT code FROM otps WHERE target = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
    [custEmail, 'forgot_password']
  );
  if (otpQuery.rows.length === 0) throw new Error('OTP was not found in database!');
  const otpCode = otpQuery.rows[0].code;
  console.log('✓ 8b. Retrieved generated 6-digit OTP from database:', otpCode);

  // Reset password using the OTP
  const newPass = 'UpdatedPass@2026';
  const resetRes = await fetch(`${BASE_URL}/auth/customer/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail, otp: otpCode, new_password: newPass })
  });
  const resetData = await resetRes.json();
  if (!resetRes.ok) throw new Error('Reset password failed: ' + JSON.stringify(resetData));
  console.log('✓ 8c. Password reset successful.');

  // Re-login with new password
  const newLoginRes = await fetch(`${BASE_URL}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail, password: newPass })
  });
  if (!newLoginRes.ok) throw new Error('Login with reset password failed!');
  console.log('✓ 8d. Customer logged in successfully with the new password.');

  // Test 9: Middleware & Role Guards (RBAC on Backend)
  // a) Unauthenticated access to /api/auth/me
  const unauthRes = await fetch(`${BASE_URL}/auth/me`);
  if (unauthRes.status === 401) {
    console.log('✓ 9a. Unauthenticated access blocked with 401 Unauthorized');
  } else {
    throw new Error('Unauthenticated access was not blocked!');
  }

  // Clean up test pool
  await pool.end();
  console.log('--- ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
