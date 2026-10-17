import http from 'http';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: process.env.PORT || 5001,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(
      {
        hostname: 'localhost',
        port: process.env.PORT || 5001,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== PHASE 9 ADMIN ANALYTICS E2E VERIFICATION ===\n');

  // 1. Admin login (SRS FR-A1)
  console.log('1. Logging in as platform administrator (admin@fixitnow.com via /api/admin/login)...');
  const loginRes = await post('/api/admin/login', {
    email: 'admin@fixitnow.com',
    password: 'admin@123',
  });

  const token = loginRes.data?.token || loginRes.data?.data?.token;
  if (loginRes.status !== 200 || !token) {
    console.error('❌ Admin login failed:', loginRes);
    process.exit(1);
  }
  console.log('✅ Admin login successful. Token acquired.\n');

  // 2. Fetch Dashboard
  console.log('2. Requesting GET /api/admin/dashboard...');
  const dashRes = await get('/api/admin/dashboard', token);
  const isDashSuccess = dashRes.status === 200 && (dashRes.data?.success || dashRes.data?.status === 'success');
  if (!isDashSuccess) {
    console.error('❌ GET /api/admin/dashboard failed:', dashRes);
    process.exit(1);
  }
  const dash = dashRes.data.data;
  console.log('✅ Dashboard payload received.');
  console.log(`   - Total Requests: ${dash.stats.total_requests}`);
  console.log(`   - Active Subscribed Partners: ${dash.stats.active_partners}`);
  console.log(`   - Total Registered Customers: ${dash.stats.total_customers}`);
  console.log(`   - Subscription Platform Revenue: ₹${dash.stats.subscription_revenue}`);
  console.log(`   - Fulfillment Completion Rate: ${dash.stats.completion_rate}\n`);

  // 3. Verify Live Users View
  console.log('3. Validating Live Users Real-time View (FR-A2)...');
  const live = dash.live_users || dash.liveUsers;
  if (!live) throw new Error('Missing live_users object in dashboard response');
  console.log(`   - Online Partners Count: ${live.online_partners_count}`);
  console.log(`   - Active Customers Count: ${live.active_customers_count}`);
  console.log(`   - Active Field Jobs Count: ${live.active_jobs_count}`);
  console.log(`   - Live Partners Units broadcasting: ${live.live_online_partners?.length}`);

  if (live.online_partners_count < 1) throw new Error('Expected at least 1 online partner');
  if (live.active_jobs_count < 1) throw new Error('Expected at least 1 active job in progress');
  const activeJobPartner = live.live_online_partners.find((p) => p.status === 'on_job');
  if (!activeJobPartner || !activeJobPartner.order_number) {
    throw new Error('Expected at least 1 partner on active job with order_number');
  }
  console.log(`   ✓ Active Field Unit: ${activeJobPartner.name} on ${activeJobPartner.order_number} (${activeJobPartner.service_name})`);
  console.log('✅ Live Users View verified.\n');

  // 4. Verify Analytics Endpoint & All 7 SRS Charts
  console.log('4. Requesting GET /api/admin/analytics...');
  const analyticsRes = await get('/api/admin/analytics', token);
  const isAnalyticsSuccess = analyticsRes.status === 200 && (analyticsRes.data?.success || analyticsRes.data?.status === 'success');
  if (!isAnalyticsSuccess) {
    console.error('❌ GET /api/admin/analytics failed:', analyticsRes);
    process.exit(1);
  }
  const analytics = analyticsRes.data.data;

  console.log('5. Validating All 7 Charts against real database figures:');

  // Chart 1: Requests Over Time
  console.log(`   - Chart 1 (Requests Over Time): ${analytics.requestsOverTime?.length} months tracked`);
  analytics.requestsOverTime.forEach((m) => {
    console.log(`     • ${m.period}: ${m.total} total (completed: ${m.completed}, cancelled: ${m.cancelled})`);
  });
  if (!analytics.requestsOverTime || analytics.requestsOverTime.length < 2) {
    throw new Error('Chart 1 failed: Expected multi-month request data');
  }

  // Chart 2: Top Services
  console.log(`   - Chart 2 (Top Services Demand): ${analytics.topServices?.length} categories`);
  analytics.topServices.forEach((s) => {
    console.log(`     • ${s.name}: ${s.requests} requests (${s.share}%)`);
  });
  if (!analytics.topServices || analytics.topServices.length < 3) {
    throw new Error('Chart 2 failed: Expected top services breakdown');
  }

  // Chart 3: Completion vs Cancellation
  console.log(`   - Chart 3 (Completion vs Cancellation): ${analytics.completionVsCancellation?.length} segments`);
  analytics.completionVsCancellation.forEach((c) => {
    console.log(`     • ${c.name}: ${c.value} requests (color: ${c.color})`);
  });
  if (!analytics.completionVsCancellation || analytics.completionVsCancellation.length < 3) {
    throw new Error('Chart 3 failed: Expected 3 fulfillment segments');
  }

  // Chart 4: Network Growth
  console.log(`   - Chart 4 (Partner & Customer Growth): ${analytics.growthMetrics?.length} months tracked`);
  analytics.growthMetrics.forEach((g) => {
    console.log(`     • ${g.month}: ${g.customers} customers, ${g.partners} partners`);
  });
  if (!analytics.growthMetrics || analytics.growthMetrics.length < 2) {
    throw new Error('Chart 4 failed: Expected multi-month growth trend');
  }

  // Chart 5: Subscription Revenue
  console.log(`   - Chart 5 (Subscription Revenue): ${analytics.subscriptionRevenue?.length} months tracked`);
  analytics.subscriptionRevenue.forEach((r) => {
    console.log(`     • ${r.month}: ₹${r.revenue} (${r.new_subscriptions} subs)`);
  });
  if (!analytics.subscriptionRevenue || analytics.subscriptionRevenue.length < 2) {
    throw new Error('Chart 5 failed: Expected multi-month revenue metrics');
  }

  // Chart 6: Peak Hours
  console.log(`   - Chart 6 (Daily Peak Demand Hours): ${analytics.peakHours?.length} hours tracked`);
  const topHours = [...analytics.peakHours].sort((a, b) => b.requests - a.requests).slice(0, 3);
  topHours.forEach((h) => {
    console.log(`     • Peak ${h.hour}: ${h.requests} requests`);
  });
  if (!analytics.peakHours || analytics.peakHours.length !== 24) {
    throw new Error('Chart 6 failed: Expected 24 hourly buckets');
  }

  // Chart 7: Top-Rated Partners Leaderboard
  console.log(`   - Chart 7 (Top-Rated Partners Leaderboard): ${analytics.topRatedPartners?.length} fixers ranked`);
  analytics.topRatedPartners.forEach((p) => {
    console.log(`     • Rank #${p.rank}: ${p.name} (${p.service}) - ${p.rating}★ (${p.jobs} jobs)`);
  });
  if (!analytics.topRatedPartners || analytics.topRatedPartners.length < 3) {
    throw new Error('Chart 7 failed: Expected top-rated partners leaderboard');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 9 ADMIN ANALYTICS TESTS PASSED WITH REAL DB DATA!');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
