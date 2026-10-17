/**
 * FixIt Now - Partner Earnings & Payouts Screen
 * 100% direct customer settlements with itemized ledger and breakdown by day and service.
 * Conforms to SRS FR-P11, FR-P12, BR-7 and docs/DESIGN.md.
 * Note: Raw monetary amounts are intentionally excluded per direct customer settlement policy.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPartnerEarnings } from '../../services/partnerService';

export default function EarningsView({ partner }) {
  const [earningsData, setEarningsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'CASH' | 'UPI'

  const loadEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPartnerEarnings(partner?.id || 101);

      // Merge newly completed jobs from localStorage audit if not yet synced
      const extraEntries = [];
      try {
        const rawJobs = localStorage.getItem('fixit_partner_recent_jobs');
        if (rawJobs) {
          const parsed = JSON.parse(rawJobs);
          if (Array.isArray(parsed)) {
            for (const j of parsed) {
              if (j.status === 'completed' || j.status === 'paid' || j.status === 'payment_completed') {
                extraEntries.push({
                  id: j.id,
                  order_number: j.order_number,
                  customer_name: j.customer_name,
                  service_name: j.service_name,
                  problem: j.problem,
                  payment_mode: j.payment_mode || 'Direct Cash / UPI (On-site)',
                  date: j.completed_at || new Date().toISOString(),
                  status: 'settled',
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const existingLedger = data?.ledger || [];
      const seen = new Set();
      const combinedLedger = [];
      for (const item of [...existingLedger, ...extraEntries]) {
        const key = item.order_number || String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          combinedLedger.push(item);
        }
      }

      // Build breakdown by day and service dynamically if missing or incomplete
      const dayMap = {};
      const serviceMap = {};
      for (const entry of combinedLedger) {
        const d = new Date(entry.date);
        const dayKey = isNaN(d)
          ? 'Recent'
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
        const sKey = entry.service_name || 'Home Service';
        serviceMap[sKey] = (serviceMap[sKey] || 0) + 1;
      }

      const breakdownByDay =
        data?.breakdown_by_day?.length > 0
          ? data.breakdown_by_day
          : Object.entries(dayMap).map(([date, count]) => ({
              date,
              count,
              label: `${count} job${count > 1 ? 's' : ''}`,
            }));

      const breakdownByService =
        data?.breakdown_by_service?.length > 0
          ? data.breakdown_by_service
          : Object.entries(serviceMap).map(([service, count]) => ({
              service,
              count,
              label: `${count} job${count > 1 ? 's' : ''}`,
            }));

      setEarningsData({
        ...data,
        total_jobs: combinedLedger.length,
        today_jobs: data?.today_jobs ?? combinedLedger.length,
        breakdown_by_day: breakdownByDay,
        breakdown_by_service: breakdownByService,
        ledger: combinedLedger,
      });
    } catch (err) {
      console.error('[EarningsView] Failed to load earnings data:', err);
      setError(err.message || 'Failed to calculate payouts ledger.');
    } finally {
      setLoading(false);
    }
  }, [partner?.id]);

  useEffect(() => {
    loadEarnings();
    window.addEventListener('storage', loadEarnings);
    window.addEventListener('fixit_partner_history_updated', loadEarnings);
    window.addEventListener('fixit_partner_ratings_updated', loadEarnings);
    return () => {
      window.removeEventListener('storage', loadEarnings);
      window.removeEventListener('fixit_partner_history_updated', loadEarnings);
      window.removeEventListener('fixit_partner_ratings_updated', loadEarnings);
    };
  }, [loadEarnings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="p-8 text-center border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
          <div className="inline-block w-6 h-6 border-2 border-signal border-t-transparent animate-spin mb-2" />
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--theme-text-soft)]">
            CALCULATING SETTLEMENT LEDGER &amp; BREAKDOWNS...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-3">
        <div className="flex items-center gap-2 text-signal font-mono text-xs font-bold uppercase">
          <span>[!]</span>
          <span>Failed to load settlement data</span>
        </div>
        <p className="font-sans text-sm text-[var(--theme-text-main)]">{error}</p>
        <button
          type="button"
          onClick={loadEarnings}
          className="px-4 py-1.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const ledger = earningsData?.ledger || [];
  const totalJobs = ledger.length;
  const filteredLedger = ledger.filter((entry) => {
    if (filterMode === 'CASH') return entry.payment_mode?.toLowerCase().includes('cash');
    if (filterMode === 'UPI') return entry.payment_mode?.toLowerCase().includes('upi');
    return true;
  });

  const breakdownByDay = earningsData?.breakdown_by_day || [];
  const breakdownByService = earningsData?.breakdown_by_service || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-signal inline-block" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                CUSTOMER PAYOUTS &amp; SETTLEMENTS
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Customer Payouts &amp; Settlements
            </h1>
          </div>

          <div className="border-2 border-done bg-done text-paper px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm self-start sm:self-auto">
            100% DIRECT SETTLEMENTS
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Payouts for service work are settled directly between customer and partner upon job completion via on-site cash or direct UPI. FixIt Now takes 0% commission.
        </p>
      </div>

      {/* 4 Payout Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm"
          style={{ borderRadius: 0 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--theme-text-soft)] block">
            TODAY&apos;S STATUS
          </span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-signal mt-1">
            {earningsData?.today_jobs ?? totalJobs}
          </div>
          <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block mt-1">
            Jobs Completed · Payment Received
          </span>
        </div>

        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm"
          style={{ borderRadius: 0 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--theme-text-soft)] block">
            SETTLEMENT METHOD
          </span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)] mt-1">
            DIRECT
          </div>
          <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block mt-1">
            Payment received on-site
          </span>
        </div>

        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard-sm"
          style={{ borderRadius: 0 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--theme-text-soft)] block">
            COMPLETED WORK ORDERS
          </span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)] mt-1">
            {totalJobs}
          </div>
          <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block mt-1">
            Jobs Completed · Payment Received
          </span>
        </div>

        <div
          className="bg-[var(--theme-surface)] border-2 border-done p-4 shadow-hard-sm"
          style={{ borderRadius: 0 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-done block font-bold">
            PAYOUT STATUS
          </span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-done mt-1">
            100% SETTLED
          </div>
          <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block mt-1">
            Payment received · Job completed
          </span>
        </div>
      </div>

      {/* Breakdown by Day and Service (SRS FR-P11, FR-P12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Breakdown by Day */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard p-4 sm:p-5"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              BREAKDOWN BY DAY
            </span>
            <span className="font-mono text-[11px] text-[var(--theme-text-soft)]">
              {breakdownByDay.length} day{breakdownByDay.length === 1 ? '' : 's'} recorded
            </span>
          </div>

          <div className="divide-y divide-[var(--theme-border)]">
            {breakdownByDay.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="font-bold text-[var(--theme-text-main)]">{item.date}</div>
                  <div className="text-[10px] text-done font-bold uppercase">Payment Received</div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 border border-[var(--theme-border)] bg-[var(--theme-bg)] font-bold text-[var(--theme-text-main)]">
                    {item.count} {item.count === 1 ? 'Job' : 'Jobs'} Completed
                  </span>
                </div>
              </div>
            ))}

            {breakdownByDay.length === 0 && (
              <div className="py-6 text-center font-mono text-xs text-[var(--theme-text-soft)]">
                No daily breakdowns available yet.
              </div>
            )}
          </div>
        </div>

        {/* Breakdown by Service */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard p-4 sm:p-5"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              BREAKDOWN BY SERVICE
            </span>
            <span className="font-mono text-[11px] text-[var(--theme-text-soft)]">
              {breakdownByService.length} trade{breakdownByService.length === 1 ? '' : 's'} active
            </span>
          </div>

          <div className="divide-y divide-[var(--theme-border)]">
            {breakdownByService.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="font-bold text-[var(--theme-text-main)]">{item.service}</div>
                  <div className="text-[10px] text-done font-bold uppercase">Payment Received</div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 border border-[var(--theme-border)] bg-[var(--theme-bg)] font-bold text-[var(--theme-text-main)]">
                    {item.count} {item.count === 1 ? 'Job' : 'Jobs'} Completed
                  </span>
                </div>
              </div>
            ))}

            {breakdownByService.length === 0 && (
              <div className="py-6 text-center font-mono text-xs text-[var(--theme-text-soft)]">
                No service breakdowns available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Itemized Settlement Ledger */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="border-b-2 border-[var(--theme-border)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--theme-bg)]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              CUSTOMER PAYOUT LOG ({filteredLedger.length})
            </span>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 border text-[11px] font-bold cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              All ({ledger.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('UPI')}
              className={`px-3 py-1 border text-[11px] font-bold cursor-pointer ${
                filterMode === 'UPI'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              UPI
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('CASH')}
              className={`px-3 py-1 border text-[11px] font-bold cursor-pointer ${
                filterMode === 'CASH'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              Cash
            </button>
          </div>
        </div>

        {/* Ledger Rows */}
        <div className="divide-y-2 divide-[var(--theme-border)] font-mono text-xs">
          {filteredLedger.map((entry) => (
            <div
              key={entry.id || entry.order_number}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--theme-bg)] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--theme-text-main)]">{entry.order_number}</span>
                  <span className="text-[var(--theme-text-soft)]">·</span>
                  <span className="text-[var(--theme-text-soft)]">{entry.customer_name}</span>
                </div>
                <div className="font-sans text-xs text-[var(--theme-text-main)] font-medium">
                  {entry.service_name} &mdash; &ldquo;{entry.problem}&rdquo;
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  {new Date(entry.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })} · {entry.payment_mode}
                </div>
              </div>

              <div className="text-right self-end sm:self-center space-y-1">
                <div className="inline-block px-2.5 py-0.5 border border-done bg-done text-paper font-mono text-[11px] font-bold uppercase tracking-wider">
                  ✓ Payment Received
                </div>
                <div className="text-[10px] font-bold uppercase text-[var(--theme-text-soft)]">
                  Job Completed
                </div>
              </div>
            </div>
          ))}

          {filteredLedger.length === 0 && (
            <div className="p-8 text-center text-[var(--theme-text-soft)]">
              No customer payouts found for selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
