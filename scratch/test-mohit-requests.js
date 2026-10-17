const BASE_URL = 'http://localhost:5001/api';

async function testMohitRequests() {
  const loginRes = await fetch(`${BASE_URL}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mohit@gmail.com', password: 'mohit@123' })
  });
  const { token, user } = await loginRes.json();
  console.log('Logged in user:', user);

  const res = await fetch(`${BASE_URL}/requests?filter=all`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('GET /api/requests?filter=all status:', res.status);
  console.log('GET /api/requests?filter=all data:', JSON.stringify(data, null, 2));
}

testMohitRequests().catch(console.error);
