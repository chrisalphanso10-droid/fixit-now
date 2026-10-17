/**
 * FixIt Now - Admin Subscriptions Read-Only Table View
 * Conforms to SRS FR-A2, BR-1, BR-4 and docs/DESIGN.md:
 * - Read-only monitoring of all partner subscriptions.
 * - Displays plan tier, price paid, active duration, days remaining, and status.
 * - Desktop-first zebra table with DM Mono headers; stacked ticket cards under md.
 */

import { useState, useEffect } from 'react';
import { getAdminSubscriptions } from '../../services/adminService';

export default function AdminSubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSubscriptions = () => {
    setLoading(true);
    setError(null);
    getAdminSubscriptions()
      .then((data) => {
        setSubscriptions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load subscription ledger.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const filtered = subscriptions.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const totalRevenue = subscriptions.reduce((acc, s) => acc + (s.price_paid || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            REVENUE STREAM AUDIT · FR-A2
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Partner Subscriptions ({subscriptions.length})
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-soft)] text-left sm:text-right">
          <div>TOTAL RECORDED: <strong className="text-signal">₹{totalRevenue.toLocaleString()}</strong></div>
          <div className="text-[10px] text-[var(--theme-text-muted)]">Rule BR-1: 100% of marketplace revenue</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All Subscriptions' },
          { key: 'active', label: 'Active (> 7 Days)' },
          { key: 'warning', label: 'Expiring Soon (≤ 7 Days)' },
          { key: 'expired', label: 'Expired (Locked Out)' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 min-h-[38px] ${
              statusFilter === tab.key
                ? 'bg-signal text-paper border-signal font-bold shadow-hard-sm'
                : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-[var(--theme-surface-sub)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-signal font-bold uppercase">
            <span>[!]</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchSubscriptions}
            className="px-3 py-1.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [LOADING SUBSCRIPTION LEDGER &amp; EXPIRY TIMERS...]
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO SUBSCRIPTIONS FOUND FOR FILTER [{statusFilter.toUpperCase()}]
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* DESKTOP VIEW (>= 768px): ZEBRA TABLE                           */}
          {/* ============================================================== */}
          <div className="hidden md:block bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] text-[var(--theme-text-main)] font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Partner</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Trade Category</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Subscribed Tier</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-right">Fee Paid</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Valid From</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Valid Until</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Remaining</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {filtered.map((sub, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)]">
                      {sub.partner_name}
                      <span className="block text-[10px] text-[var(--theme-text-muted)] font-normal">
                        ID #{sub.partner_id}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                      {sub.service_name}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      {sub.plan_name} ({sub.duration_months}M)
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-right font-bold text-[var(--theme-text-main)]">
                      ₹{sub.price_paid?.toLocaleString()}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                      {new Date(sub.start_date).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                      {new Date(sub.end_date).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center font-bold">
                      <span className={(sub.days_remaining ?? Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / 86400000))) > 0 ? 'text-[var(--theme-text-main)]' : 'text-[#B83A14]'}>
                        {sub.days_remaining !== undefined && sub.days_remaining !== null
                          ? sub.days_remaining
                          : Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / 86400000))} Days
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`stamp-badge text-[9px] px-1 py-0 ${
                          sub.status === 'active'
                            ? 'border-done text-done'
                            : sub.status === 'warning'
                              ? 'border-signal text-signal'
                              : 'border-[#B83A14] text-[#B83A14]'
                        }`}
                      >
                        {sub.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* MOBILE VIEW (< 768px): STACKED TICKET CARDS                    */}
          {/* ============================================================== */}
          <div className="md:hidden space-y-4">
            {filtered.map((sub, idx) => (
              <div
                key={idx}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">
                    PARTNER #{sub.partner_id}
                  </span>
                  <span
                    className={`stamp-badge text-[9px] px-1 py-0 ${
                      sub.status === 'active'
                        ? 'border-done text-done'
                        : sub.status === 'warning'
                          ? 'border-signal text-signal'
                          : 'border-[#B83A14] text-[#B83A14]'
                    }`}
                  >
                    {sub.status?.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-base text-[var(--theme-text-main)]">
                    {sub.partner_name}
                  </h3>
                  <div className="text-[var(--theme-text-soft)]">{sub.service_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">PLAN TIER:</span>
                    <strong className="text-signal">{sub.plan_name} ({sub.duration_months}M)</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">FEE PAID:</span>
                    <strong className="text-[var(--theme-text-main)]">₹{sub.price_paid}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[var(--theme-text-muted)]">
                    Days Remaining: <strong className={(sub.days_remaining ?? Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / 86400000))) > 0 ? 'text-[var(--theme-text-main)]' : 'text-[#B83A14]'}>
                      {sub.days_remaining !== undefined && sub.days_remaining !== null
                        ? sub.days_remaining
                        : Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / 86400000))}d
                    </strong>
                  </span>
                  <span className="text-[var(--theme-text-muted)]">
                    Expires: {new Date(sub.end_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expiry Rule Note */}
      <div className="p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)]">
        SRS RULE BR-4: When a partner subscription lapses (0 days remaining), the partner portal automatically
        locks out job features until renewed. Upgrades may be paid in advance to take effect upon current plan expiry (BR-3).
      </div>
    </div>
  );
}
