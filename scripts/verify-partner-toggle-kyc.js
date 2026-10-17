// Mock localStorage in Node
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

const BASE_URL = 'http://localhost:5000/api';

async function runComprehensiveTest() {
  console.log('================================================================');
  console.log('   FIXIT NOW - PARTNER PORTAL TOGGLE & KYC PERSISTENCE TEST     ');
  console.log('================================================================\n');

  // 1. Partner Login (Rajesh Kumar)
  console.log('>>> TEST 1: Logging in as verified partner Rajesh Kumar...');
  const loginRes = await fetch(BASE_URL + '/auth/partner/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh@example.com', password: 'Partner@2026' })
  }).then(r => r.json());

  if (loginRes.status !== 'success') {
    throw new Error('Login failed: ' + JSON.stringify(loginRes));
  }

  const token = loginRes.token;
  localStorage.setItem('fixit_token', token);
  localStorage.setItem('fixit_user', JSON.stringify(loginRes.user));
  localStorage.setItem('fixit_partner_user', JSON.stringify(loginRes.user));
  localStorage.setItem('fixit_current_partner', JSON.stringify(loginRes.user));

  console.log('✓ Partner authenticated:', loginRes.user.name);
  console.log('  Initial KYC status:', loginRes.user.kyc_status);
  console.log('  Initial Online status:', loginRes.user.online);

  // 2. Test Reactive Online/Offline Toggling (Multiple consecutive toggles)
  console.log('\n>>> TEST 2: Testing Online/Offline toggle reactivity without page refresh...');
  let currentOnline = loginRes.user.online;

  for (let i = 1; i <= 4; i++) {
    const toggleRes = await fetch(BASE_URL + '/partner/online', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());

    if (toggleRes.status !== 'success') {
      throw new Error('Toggle ' + i + ' failed: ' + JSON.stringify(toggleRes));
    }

    const expectedOnline = !currentOnline;
    if (toggleRes.online !== expectedOnline) {
      throw new Error('Toggle ' + i + ': Expected online=' + expectedOnline + ', got ' + toggleRes.online);
    }

    if (!toggleRes.partner || toggleRes.partner.kyc_status !== 'verified') {
      throw new Error('Toggle ' + i + ': Partner payload missing or KYC not verified!');
    }

    // Sync storage as done in client
    const active = JSON.parse(localStorage.getItem('fixit_current_partner'));
    const updated = { ...active, ...toggleRes.partner, online: toggleRes.online };
    localStorage.setItem('fixit_current_partner', JSON.stringify(updated));
    localStorage.setItem('fixit_user', JSON.stringify(updated));

    // Verify dashboard reflects change immediately
    const dash = await fetch(BASE_URL + '/partner/dashboard', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());

    if (dash.data.partner.online !== toggleRes.online) {
      throw new Error('Dashboard online state mismatch after toggle ' + i + '!');
    }

    console.log('  Toggle #' + i + ' -> ' + (toggleRes.online ? '● ONLINE' : '○ OFFLINE') + ' (KYC: ' + dash.data.partner.kyc_status + ') ✓ Immediate sync');
    currentOnline = toggleRes.online;
  }

  // 3. Test KYC Status Stability across multiple simulated page reloads
  console.log('\n>>> TEST 3: Testing KYC Status Stability across 3 successive page refreshes...');
  for (let reload = 1; reload <= 3; reload++) {
    // Simulated reload:
    // a) Mount: read from localStorage
    const storedUser = JSON.parse(localStorage.getItem('fixit_user'));
    const initialKyc = storedUser.kyc_status;

    // b) Verify JWT session via GET /api/auth/me
    const meRes = await fetch(BASE_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());

    // c) Load partner dashboard data via GET /api/partner/dashboard
    const dashRes = await fetch(BASE_URL + '/partner/dashboard', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());

    // d) Load KYC documents via GET /api/partner/kyc
    const kycRes = await fetch(BASE_URL + '/partner/kyc', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());

    if (initialKyc !== 'verified') {
      throw new Error('Reload #' + reload + ': Stored KYC status regressed to ' + initialKyc);
    }
    if (meRes.user.kyc_status !== 'verified') {
      throw new Error('Reload #' + reload + ': /api/auth/me returned KYC ' + meRes.user.kyc_status);
    }
    if (dashRes.data.partner.kyc_status !== 'verified') {
      throw new Error('Reload #' + reload + ': Dashboard returned KYC ' + dashRes.data.partner.kyc_status);
    }
    if (kycRes.data.status !== 'verified') {
      throw new Error('Reload #' + reload + ': KYC endpoint returned status ' + kycRes.data.status);
    }

    console.log('  Refresh #' + reload + ': Auth Me=' + meRes.user.kyc_status + ', Dashboard=' + dashRes.data.partner.kyc_status + ', KYC Endpoint=' + kycRes.data.status + ' -> NO FLAPPING ✓');
  }

  // 4. Test Newly Registered Partner -> Admin Approval -> Partner Refresh Stability
  console.log('\n>>> TEST 4: Testing Fresh Partner Registration -> Admin Approval -> Refresh Stability...');
  const newEmail = 'test.partner.' + Date.now() + '@fixitnow.local';
  const regRes = await fetch(BASE_URL + '/auth/partner/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Tech Partner',
      email: newEmail,
      password: 'Password@123',
      phone: '+91 98888 77777',
      address: 'Indiranagar 100ft Road, Bengaluru',
      service_id: 1,
      vehicle: 'Hero Splendor (KA-01-AB-1234)'
    })
  }).then(r => r.json());

  const newPartnerId = regRes.user.id;
  const newPartnerToken = regRes.token;
  console.log('  New partner registered:', regRes.user.name, 'KYC status:', regRes.user.kyc_status);

  // Admin approves KYC
  const adminLogin = await fetch(BASE_URL + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fixitnow.com', password: 'admin@123' })
  }).then(r => r.json());

  const adminToken = adminLogin.token;
  const approveRes = await fetch(BASE_URL + '/partner/kyc/' + newPartnerId + '/decision', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + adminToken
    },
    body: JSON.stringify({ decision: 'verified' })
  }).then(r => r.json());

  console.log('  Admin approved KYC:', approveRes.data?.kyc_status);

  // Partner checks status on 3 successive reloads
  for (let r = 1; r <= 3; r++) {
    const dash = await fetch(BASE_URL + '/partner/dashboard', {
      headers: { Authorization: 'Bearer ' + newPartnerToken }
    }).then(res => res.json());

    if (dash.data.partner.kyc_status !== 'verified') {
      throw new Error('Fresh partner reload #' + r + ': KYC status was ' + dash.data.partner.kyc_status + ', expected verified!');
    }
    console.log('  Fresh Partner Refresh #' + r + ': KYC status firmly ' + dash.data.partner.kyc_status + ' ✓');
  }

  console.log('\n================================================================');
  console.log('   ALL 4 TESTS PASSED SUCCESSFULLY!                             ');
  console.log('   - Online/Offline toggles reactively without page refresh     ');
  console.log('   - KYC status remains verified across all refreshes           ');
  console.log('================================================================\n');
}

runComprehensiveTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
