const BASE_URL = 'http://localhost:5001/api';

async function testMohitSession() {
  console.log('Logging in as Mohit...');
  const loginRes = await fetch(`${BASE_URL}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mohit@gmail.com', password: 'mohit@123' })
  });

  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Data:', loginData);

  if (!loginRes.ok) return;

  const token = loginData.token;

  console.log('\nFetching /api/auth/me:');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('/api/auth/me:', await meRes.json());

  console.log('\nFetching /api/requests/history:');
  const histRes = await fetch(`${BASE_URL}/requests/history?status=all`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const histData = await histRes.json();
  console.log('History data:', JSON.stringify(histData, null, 2));

  console.log('\nFetching /api/customer/addresses:');
  const addrRes = await fetch(`${BASE_URL}/customer/addresses`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Addresses:', await addrRes.json());
}

testMohitSession().catch(console.error);
