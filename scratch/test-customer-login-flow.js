/**
 * FixIt Now - Customer Login Verification Test
 * Tests customer login HTTP API, demo credentials, and client route mapping.
 */

const API_BASE = 'http://localhost:5001/api';

async function testCustomerLogin() {
  console.log('====================================================');
  console.log('FixIt Now: Customer Login & Route Mapping Test');
  console.log('====================================================\n');

  // Test 1: API - Customer Login with demo credentials
  console.log('Suite 1: Customer Login API Endpoints');
  const demoEmail = 'ananya@example.com';
  const demoPass = 'FixIt@2026';

  const res = await fetch(`${API_BASE}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: demoEmail, password: demoPass }),
  });

  const data = await res.json();
  if (!res.ok || !data.token || data.user?.role !== 'customer') {
    throw new Error(`Customer login failed: status ${res.status}, body: ${JSON.stringify(data)}`);
  }
  console.log('  ✓ Customer login successful for', demoEmail);
  console.log('    Role:', data.user.role, '| Token received:', data.token.slice(0, 20) + '...');

  // Test 2: Token verification via /api/auth/me
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  const meData = await meRes.json();
  if (!meRes.ok || meData.user?.email !== demoEmail) {
    throw new Error(`Session verification failed: ${JSON.stringify(meData)}`);
  }
  console.log('  ✓ GET /api/auth/me verified customer session:', meData.user.name, `(${meData.user.email})`);

  // Test 3: Invalid credentials test
  const badRes = await fetch(`${API_BASE}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: demoEmail, password: 'WrongPassword' }),
  });
  if (badRes.status !== 401) {
    throw new Error(`Expected 401 for bad password, got ${badRes.status}`);
  }
  console.log('  ✓ Invalid credentials correctly returned HTTP 401');

  // Test 4: Route Mapping & Hash Parsing Verification
  console.log('\nSuite 2: Customer Login Route Mapping Logic');
  
  function resolveView(hashStr) {
    const hash = hashStr.replace('#/', '').replace('#', '');
    if (hash === 'admin/login') return 'admin-login';
    if (hash.startsWith('admin')) return 'admin';
    if (
      hash === 'customer/login' ||
      hash === 'customer/auth' ||
      hash === 'customer-auth' ||
      hash === 'customer-login' ||
      hash === 'customer/signin' ||
      hash === 'customer-signin' ||
      hash === 'login' ||
      hash === 'signin' ||
      hash.startsWith('customer/login') ||
      hash.startsWith('customer/register') ||
      hash.startsWith('customer/forgot') ||
      hash === 'customer/signup'
    ) {
      return 'customer-auth';
    }
    if (hash.startsWith('customer')) return 'customer';
    if (hash.startsWith('partner/login') || hash.startsWith('partner/register') || hash.startsWith('partner/forgot')) return 'partner-auth';
    if (hash.startsWith('partner')) return 'partner';
    return 'landing';
  }

  const testHashes = [
    { hash: '#/customer/login', expected: 'customer-auth' },
    { hash: '#/login', expected: 'customer-auth' },
    { hash: '#/customer/auth', expected: 'customer-auth' },
    { hash: '#/customer-login', expected: 'customer-auth' },
    { hash: '#/customer/signin', expected: 'customer-auth' },
    { hash: '#/customer/register', expected: 'customer-auth' },
    { hash: '#/customer/dashboard', expected: 'customer' },
    { hash: '#/partner/login', expected: 'partner-auth' },
    { hash: '#/admin/login', expected: 'admin-login' },
    { hash: '#/', expected: 'landing' },
  ];

  for (const { hash, expected } of testHashes) {
    const resolved = resolveView(hash);
    if (resolved !== expected) {
      throw new Error(`Hash "${hash}" resolved to "${resolved}", expected "${expected}"`);
    }
    console.log(`  ✓ Route "${hash}" -> view: "${resolved}"`);
  }

  console.log('\n====================================================');
  console.log('✓ All Customer Login & Route Tests Passed Successfully!');
  console.log('====================================================');
}

testCustomerLogin().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
