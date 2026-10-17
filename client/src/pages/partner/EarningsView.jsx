/**
 * FixIt Now - Partner Earnings & Payouts Screen
 * 100% direct customer settlements with itemized ledger and 0% commission savings comparison.
 * Conforms to SRS FR-P11, FR-P12, BR-7 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getPartnerEarnings } from '../../services/partnerService';

export default function EarningsView({ partner }) {
  const [earningsData, setEarningsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'CASH' | 'UPI'

  useEffect(() => {
    let isMounted = true;
    const loadEarnings = async () => {
      const data = await getPartnerEarnings(partner?.id || 101);
      if (!isMounted) return;

      // Merge newly completed jobs from localStorage
      const extraEntries = [];
      try {
        const rawJobs = localStorage.getItem('fixit_partner_recent_jobs');
        if (rawJobs) {
          const parsed = JSON.parse(rawJobs);
          if (Array.isArray(parsed)) {
            for (const j of parsed) {
              if (j.status === 'completed' || j.status === 'paid' || j.amount > 0) {
                extraEntries.push({
                  id: j.id,
                  order_number: j.order_number,
                  customer_name: j.customer_name,
                  service_name: j.service_name,
                  problem: j.problem,
                  amount: j.amount || 450.0,
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

      const existingLedger = data.ledger || [];
      const seen = new Set();
      const combinedLedger = [];
      for (const item of [...extraEntries, ...existingLedger]) {
        const key = item.order_number || String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          combinedLedger.push(item);
        }
      }

      setEarningsData({
        ...data,
        ledger: combinedLedger,
      });
      setLoading(false);
    };

    loadEarnings();
    window.addEventListener('storage', loadEarnings);
    window.addEventListener('fixit_partner_ratings_updated', loadEarnings);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', loadEarnings);
      window.removeEventListener('fixit_partner_ratings_updated', loadEarnings);
    };
  }, [partner?.id]);

  if (loading || !earningsData) {
    return (
      <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-soft)] border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
        CALCULATING SETTLEMENT LEDGER...
      </div>
    );
  }

  const totalEarnings = earningsData.total_earnings ?? 0.0;
  const todayEarnings = earningsData.today_earnings ?? 0.0;
  const totalJobs = earningsData.total_jobs ?? 0;
  const thisWeekEarnings = earningsData.this_week_earnings ?? 0.0;

  const ledger = earningsData.ledger || [];
  const filteredLedger = ledger.filter((entry) => {
    if (filterMode === 'CASH') return entry.payment_mode?.toLowerCase().includes('cash');
    if (filterMode === 'UPI') return entry.payment_mode?.toLowerCase().includes('upi');
    return true;
  });

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
                CUSTOMER PAYOUTS &amp; RECEIPTS
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Customer Payouts &amp; Settlements
            </h1>
          </div>

          <div className="border-2 border-done bg-done text-paper px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm self-start sm:self-auto">
            DIRECT CUSTOMER SETTLEMENTS
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Payouts for service work are received directly from customers upon job completion via customer cash or direct UPI. FixIt Now takes 0% cut.
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
            {earningsData.today_jobs ?? 0}
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
              className={`px-3 py-1 border text-[11px] font-bold ${
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
              className={`px-3 py-1 border text-[11px] font-bold ${
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
              className={`px-3 py-1 border text-[11px] font-bold ${
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
              key={entry.id}
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
