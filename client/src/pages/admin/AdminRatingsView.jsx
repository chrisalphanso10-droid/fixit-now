/**
 * FixIt Now - Admin Ratings & Reviews Read-Only Table View
 * Conforms to SRS FR-A2, FR-C17 and docs/DESIGN.md:
 * - Read-only monitoring of all customer ratings and feedback.
 * - Star filtering: 5 Stars, 4 Stars, All.
 * - Desktop-first zebra table with DM Mono headers; stacked ticket cards under md.
 */

import { useState, useEffect } from 'react';
import { getAdminRatings } from '../../services/adminService';

export default function AdminRatingsView() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState('all');

  useEffect(() => {
    getAdminRatings().then((data) => {
      setReviews(data);
      setLoading(false);
    });
  }, []);

  const filtered = reviews.filter((r) => {
    if (starFilter === 'all') return true;
    return r.stars === Number(starFilter);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            SERVICE QUALITY AUDIT · FR-A2
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Customer Ratings &amp; Reviews ({reviews.length})
          </h1>
        </div>
        <div className="font-mono text-xs text-done font-bold flex items-center gap-1.5">
          <span>★</span> AVERAGE SCORE: 4.90 / 5.0 (98% SATISFACTION)
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All Reviews' },
          { key: '5', label: '5 Stars ★★★★★' },
          { key: '4', label: '4 Stars ★★★★☆' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStarFilter(tab.key)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 min-h-[38px] ${
              starFilter === tab.key
                ? 'bg-signal text-paper border-signal font-bold shadow-hard-sm'
                : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-[var(--theme-surface-sub)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [AGGREGATING CUSTOMER SATISFACTION FEEDBACK...]
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO REVIEWS FOUND FOR APPLIED FILTER
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
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Order No.</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Customer</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Service Category</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Score</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Customer Feedback Comment</th>
                  <th className="p-3.5 text-right">Review Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {filtered.map((rev, idx) => (
                  <tr
                    key={rev.id}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      {rev.order_number}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)]">
                      {rev.customer_name}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                      {rev.service_name}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center font-bold text-done">
                      {'★'.repeat(rev.stars)}
                      <span className="text-[var(--theme-text-muted)]">{'☆'.repeat(5 - rev.stars)}</span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)] max-w-[340px]">
                      &ldquo;{rev.comment}&rdquo;
                    </td>
                    <td className="p-3.5 text-right text-[var(--theme-text-muted)]">
                      {rev.date}
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
            {filtered.map((rev) => (
              <div
                key={rev.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">{rev.order_number}</span>
                  <span className="font-bold text-done text-sm">
                    {'★'.repeat(rev.stars)}
                  </span>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-base text-[var(--theme-text-main)]">
                    {rev.customer_name}
                  </h3>
                  <div className="text-[var(--theme-text-soft)]">{rev.service_name}</div>
                </div>

                <div className="p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] italic text-[var(--theme-text-soft)]">
                  &ldquo;{rev.comment}&rdquo;
                </div>

                <div className="text-right text-[10px] text-[var(--theme-text-muted)]">
                  Logged on {rev.date}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
