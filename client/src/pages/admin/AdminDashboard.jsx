/**
 * FixIt Now - Admin Dashboard & Analytics
 * Conforms to SRS FR-A2, FR-A7 and docs/DESIGN.md:
 * - Metric summary cards: Total Requests, Subscription Revenue, Active Partners, Total Customers, Pending KYC.
 * - Live users monitor: online partners and active customer count.
 * - 7 Recharts analytics charts strictly styled with ink, signal, muted, and done.
 * - Square corners, 2px borders, hard shadows, DM Mono typography. No gradients.
 */

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getAdminDashboardData } from '../../services/adminService';

// Custom Industrial Tooltip adhering to docs/DESIGN.md
function IndustrialTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2.5 shadow-hard-sm font-mono text-xs">
        <div className="font-bold text-[var(--theme-text-main)] mb-1 pb-1 border-b border-[var(--theme-border)]">
          {label}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-[var(--theme-text-soft)]">
              <span
                className="w-2 h-2 inline-block shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              {entry.name}:
            </span>
            <span className="font-bold text-[var(--theme-text-main)]">
              {typeof entry.value === 'number' && entry.name?.toLowerCase().includes('revenue')
                ? `₹${entry.value.toLocaleString()}`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function AdminDashboard({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    getAdminDashboardData()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[AdminDashboard] Error loading dashboard data:', err);
        setError(err.message || 'Failed to initialize analytics engine');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-muted)] animate-pulse border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
        [INITIALIZING CENTRAL DISPATCH ANALYTICS ENGINE...]
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 border-2 border-ink bg-paper text-ink shadow-hard font-mono text-sm">
        <div className="text-signal font-bold mb-2 flex items-center gap-2">
          <span className="w-4 h-4 bg-signal text-paper inline-flex items-center justify-center text-xs">!</span>
          ERROR CONNECTING TO ANALYTICS ENGINE
        </div>
        <p className="text-[var(--theme-text-soft)] mb-4">{error || 'No operational telemetry data returned.'}</p>
        <button
          type="button"
          onClick={loadData}
          className="btn-primary min-h-[40px] px-4 font-mono font-bold text-xs uppercase"
        >
          Retry Connection →
        </button>
      </div>
    );
  }

  const analytics = data?.analytics || {};
  const summary = analytics?.summary || {};
  const liveUsers = data?.liveUsers || {};
  const liveOnlinePartners = liveUsers?.live_online_partners || [];
  const requestsOverTime = analytics?.requestsOverTime || [];
  const topServices = analytics?.topServices || [];
  const completionVsCancellation = analytics?.completionVsCancellation || [];
  const growthMetrics = analytics?.growthMetrics || [];
  const subscriptionRevenue = analytics?.subscriptionRevenue || [];
  const peakHours = analytics?.peakHours || [];
  const topRatedPartners = analytics?.topRatedPartners || [];

  const maxPeakRequests = Math.max(...peakHours.map((p) => p.requests || 0), 1);
  const sortedPeakHours = [...peakHours].sort((a, b) => (b.requests || 0) - (a.requests || 0));
  const topHourWindow = sortedPeakHours[0]?.hour ? `${sortedPeakHours[0].hour}` : '11:00';
  const secondaryHourWindow = sortedPeakHours[1]?.hour ? `${sortedPeakHours[1].hour}` : '18:00';

  return (
    <div className="space-y-8">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & METRIC TILES                                   */}
      {/* ============================================================== */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-4 mb-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
              OPERATIONS RADAR · SRS SEC. 3.4
            </span>
            <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
              Central Analytics Dashboard
            </h1>
          </div>
          <div className="font-mono text-xs text-[var(--theme-text-soft)] text-left sm:text-right">
            <div>CITY: <strong className="text-[var(--theme-text-main)]">Bengaluru Central (2km Radius)</strong></div>
            <div>MODEL: <strong className="text-signal">0% Cut · Subscription Only (BR-1)</strong></div>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Tile 1: Total Requests */}
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] block mb-1">
              TOTAL REQUESTS
            </span>
            <div className="text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
              {summary.total_requests}
            </div>
            <div className="mt-2 font-mono text-xs text-done flex items-center gap-1 font-bold">
              <span>✓</span> {summary.completion_rate} Fulfilled
            </div>
          </div>

          {/* Tile 2: Subscription Revenue */}
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] block mb-1">
              SUBSCRIPTION REV (BR-1)
            </span>
            <div className="text-3xl font-display font-extrabold text-signal">
              ₹{summary.subscription_revenue.toLocaleString()}
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--theme-text-soft)]">
              100% of platform earnings
            </div>
          </div>

          {/* Tile 3: Active Partners */}
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] block mb-1">
              SUBSCRIBED PARTNERS
            </span>
            <div className="text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
              {summary.active_partners}
            </div>
            <div className="mt-2 font-mono text-xs text-done font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-done animate-pulse" />
              {liveUsers.online_partners_count} Online Now
            </div>
          </div>

          {/* Tile 4: Total Customers */}
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] block mb-1">
              TOTAL CUSTOMERS
            </span>
            <div className="text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
              {summary.total_customers}
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--theme-text-soft)]">
              {liveUsers.active_customers_count} Active in city
            </div>
          </div>

          {/* Tile 5: Pending KYC */}
          <div
            onClick={() => onNavigateTab && onNavigateTab('kyc')}
            className={`border-2 border-[var(--theme-border)] p-4 shadow-hard-sm cursor-pointer transition-transform hover:-translate-y-0.5 ${
              summary.pending_kyc > 0
                ? 'bg-[#FFF5F2] dark:bg-[#2D1610] border-signal'
                : 'bg-[var(--theme-surface)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-signal font-bold">
                PENDING KYC (FR-A4)
              </span>
              <span className="stamp-badge text-[9px] bg-signal text-paper px-1 py-0 border-signal">
                ACTION
              </span>
            </div>
            <div className="text-3xl font-display font-extrabold text-signal">
              {summary.pending_kyc}
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--theme-text-main)] underline font-bold">
              Review Dossiers →
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. LIVE USERS REAL-TIME MONITOR (FR-A2)                        */}
      {/* ============================================================== */}
      <div className="bg-ink text-paper border-2 border-ink p-5 shadow-hard-signal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#2A2E35] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 bg-done rounded-full inline-block animate-ping" />
            <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-paper">
              LIVE NETWORK PULSE · REAL-TIME USERS MONITOR
            </h3>
          </div>
          <span className="font-mono text-xs text-signal font-bold">
            SOCKET.IO DISPATCH ENGINE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="border border-[#3A3F47] p-3 bg-[#111418]">
            <div className="font-mono text-[10px] uppercase text-[#9BA3AF]">ONLINE PARTNERS</div>
            <div className="text-2xl font-display font-extrabold text-done mt-1">
              {liveUsers.online_partners_count}
            </div>
            <div className="font-mono text-[10px] text-paper">Ready for 2km dispatch</div>
          </div>
          <div className="border border-[#3A3F47] p-3 bg-[#111418]">
            <div className="font-mono text-[10px] uppercase text-[#9BA3AF]">ACTIVE CUSTOMERS</div>
            <div className="text-2xl font-display font-extrabold text-paper mt-1">
              {liveUsers.active_customers_count}
            </div>
            <div className="font-mono text-[10px] text-paper">Browsing &amp; booking</div>
          </div>
          <div className="border border-[#3A3F47] p-3 bg-[#111418]">
            <div className="font-mono text-[10px] uppercase text-[#9BA3AF]">ACTIVE JOBS IN PROGRESS</div>
            <div className="text-2xl font-display font-extrabold text-signal mt-1">
              {liveUsers.active_jobs_count}
            </div>
            <div className="font-mono text-[10px] text-paper">En-route or repairing</div>
          </div>
          <div className="border border-[#3A3F47] p-3 bg-[#111418]">
            <div className="font-mono text-[10px] uppercase text-[#9BA3AF]">AVG ARRIVAL ETA</div>
            <div className="text-2xl font-display font-extrabold text-paper mt-1">
              {summary.avg_arrival_minutes || 16}m
            </div>
            <div className="font-mono text-[10px] text-paper">Strict haversine &lt; 2km</div>
          </div>
        </div>

        {/* Live Partner Status Strip */}
        <div className="border-t border-[#2A2E35] pt-3">
          <div className="font-mono text-[11px] text-[#9BA3AF] uppercase mb-2">
            FIELD UNITS BROADCASTING ON-AIR:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {liveOnlinePartners.map((partner) => (
              <div
                key={partner.id}
                className="bg-[#1A1E24] border border-[#2A2E35] p-2 flex items-center justify-between font-mono text-xs"
              >
                <div>
                  <span className="font-bold text-paper block truncate">{partner.name}</span>
                  <span className="text-[10px] text-[#9BA3AF]">{partner.service}</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                    partner.status === 'on_job'
                      ? 'bg-signal text-paper border-signal'
                      : 'bg-[#1E8C4E] text-paper border-[#1E8C4E]'
                  }`}
                >
                  {partner.status === 'on_job' ? partner.order_number : 'AVAILABLE'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. CHARTS ROW 1: REQUESTS OVER TIME & TOP SERVICES             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Requests Over Time (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
                CHART 1 · FR-A7
              </span>
              <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
                Requests Over Time
              </h3>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#111418] dark:bg-[#E5E7EB] inline-block" /> Total
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#1E8C4E] inline-block" /> Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#FF5B14] inline-block" /> Cancelled
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requestsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" opacity={0.5} />
                <XAxis
                  dataKey="period"
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}
                />
                <YAxis
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}
                />
                <Tooltip content={<IndustrialTooltip />} />
                <Bar dataKey="total" name="Total Requests" fill="#111418" radius={[0, 0, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#1E8C4E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="cancelled" name="Cancelled" fill="#FF5B14" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)] flex justify-between">
            <span>Direct labeling: {requestsOverTime.length || 6}-month progression</span>
            <span>{summary.completion_rate || '90%+'} completion rate</span>
          </div>
        </div>

        {/* Chart 2: Top Services Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
                CHART 2 · FR-A7
              </span>
              <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
                Top Services Demand
              </h3>
            </div>
            <span className="font-mono text-xs text-[var(--theme-text-muted)]">VOLUME</span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topServices.slice(0, 5)}
                margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" opacity={0.5} />
                <XAxis
                  type="number"
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--theme-text-soft)"
                  width={110}
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <Tooltip content={<IndustrialTooltip />} />
                <Bar dataKey="requests" name="Requests" fill="#FF5B14" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)] flex justify-between">
            <span>Top category: {topServices[0]?.name || 'Plumbing'} ({topServices[0]?.share || 0}%)</span>
            <span>{topServices[1] ? `Followed by ${topServices[1].name} (${topServices[1].share}%)` : 'Consistent multi-trade demand'}</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. CHARTS ROW 2: COMPLETION SPLIT, GROWTH & REVENUE            */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart 3: Completion vs Cancellation */}
        <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
              CHART 3 · FR-A7
            </span>
            <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
              Completion vs Cancellation
            </h3>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={completionVsCancellation}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  label={false}
                >
                  {completionVsCancellation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--theme-border)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<IndustrialTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 space-y-1 font-mono text-xs">
            {completionVsCancellation.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 inline-block shrink-0" style={{ backgroundColor: item.color }} />
                  {item.name}:
                </span>
                <span className="font-bold text-[var(--theme-text-main)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 4: Partner & Customer Growth */}
        <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
              CHART 4 · FR-A7
            </span>
            <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
              Network Growth
            </h3>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" opacity={0.5} />
                <XAxis
                  dataKey="month"
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <Tooltip content={<IndustrialTooltip />} />
                <Line
                  type="monotone"
                  dataKey="customers"
                  name="Customers"
                  stroke="#111418"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#111418', strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="partners"
                  name="Partners"
                  stroke="#FF5B14"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#FF5B14', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#111418] dark:bg-[#E5E7EB] inline-block" /> Customers: {summary.total_customers ?? 0}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#FF5B14] inline-block" /> Partners: {summary.active_partners ?? 0}
            </span>
          </div>
        </div>

        {/* Chart 5: Subscription Revenue (BR-1) */}
        <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
              CHART 5 · FR-A7
            </span>
            <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
              Subscription Revenue
            </h3>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriptionRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" opacity={0.5} />
                <XAxis
                  dataKey="month"
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip content={<IndustrialTooltip />} />
                <Bar dataKey="revenue" name="Revenue (₹)" fill="#FF5B14" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-xs">
            <span className="text-[var(--theme-text-muted)]">Run rate:</span>
            <span className="font-bold text-signal">₹{(summary.subscription_revenue || 0).toLocaleString()} / month</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. CHARTS ROW 3: PEAK HOURS & TOP PARTNERS LEADERBOARD          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 6: Peak Hours (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
                CHART 6 · FR-A7
              </span>
              <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
                Daily Peak Demand Hours
              </h3>
            </div>
            <span className="font-mono text-xs text-signal font-bold">24-HR CYCLE</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" opacity={0.5} />
                <XAxis
                  dataKey="hour"
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--theme-text-soft)"
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}
                />
                <Tooltip content={<IndustrialTooltip />} />
                <Bar dataKey="requests" name="Hourly Requests" fill="#6B7079" radius={[0, 0, 0, 0]}>
                  {peakHours.map((entry, index) => (
                    <Cell
                      key={`hour-cell-${index}`}
                      fill={entry.requests >= maxPeakRequests * 0.7 && entry.requests > 0 ? '#FF5B14' : '#6B7079'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)] flex justify-between">
            <span>Primary peak: {topHourWindow}</span>
            <span className="text-signal font-bold">Secondary peak: {secondaryHourWindow}</span>
          </div>
        </div>

        {/* Chart 7: Top-Rated Partners Leaderboard (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard-sm">
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold">
                CHART 7 · FR-A7
              </span>
              <h3 className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
                Top-Rated Partners Leaderboard
              </h3>
            </div>
            <span className="stamp-badge text-[10px] bg-done text-paper border-done">
              VERIFIED FIXERS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b-2 border-[var(--theme-border)] text-[var(--theme-text-muted)] uppercase text-[10px]">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-4">Partner</th>
                  <th className="py-2 pr-4">Trade</th>
                  <th className="py-2 pr-4">Rating</th>
                  <th className="py-2 pr-2 text-right">Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {topRatedPartners.map((item) => (
                  <tr key={item.rank} className="hover:bg-[var(--theme-surface-sub)]">
                    <td className="py-2.5 pr-2 font-bold text-signal">#{item.rank}</td>
                    <td className="py-2.5 pr-4 font-bold text-[var(--theme-text-main)]">{item.name}</td>
                    <td className="py-2.5 pr-4 text-[var(--theme-text-soft)]">{item.service}</td>
                    <td className="py-2.5 pr-4 text-done font-bold">{item.rating} ★</td>
                    <td className="py-2.5 pr-2 text-right text-[var(--theme-text-main)] font-bold">{item.jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)] flex justify-between">
            <span>Ranking based on verified customer ratings</span>
            <span>Total Fixers: {topRatedPartners.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
