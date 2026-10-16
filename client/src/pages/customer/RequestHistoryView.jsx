/**
 * FixIt Now - Request History Screen
 * Stacked ticket cards for completed and cancelled requests.
 * Conforms to SRS FR-C7 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getRequestHistory } from '../../services/requestService';

export default function RequestHistoryView({ onNavigate }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'completed' | 'cancelled'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const data = await getRequestHistory(filter);
        setRequests(data);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [filter]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block mb-1">
            ARCHIVED WORK ORDERS
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
            Request History
          </h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-2 border-[var(--theme-border)] p-1 bg-[var(--theme-surface)]">
          {['all', 'completed', 'cancelled'].map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 font-mono text-xs font-bold uppercase transition-colors ${
                filter === tab
                  ? 'bg-signal text-ink'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4">
          <div className="ruler-strip animate-ruler-sweep my-4" />
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-32 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse"
            />
          ))}
        </div>
      ) : requests.length === 0 ? (
        /* Empty State */
        <div className="p-12 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center space-y-4">
          <span className="stamp-badge bg-concrete text-ink border-ink mx-auto block w-max">
            NO {filter.toUpperCase()} REQUESTS
          </span>
          <p className="font-mono text-sm text-[var(--theme-text-soft)] max-w-md mx-auto">
            {filter === 'cancelled'
              ? 'You have not cancelled any bookings.'
              : filter === 'completed'
              ? 'You have no completed service records yet.'
              : 'You have not placed any service requests yet.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('new-request')}
            className="btn-primary min-h-[44px] text-xs"
          >
            Create Your First Request →
          </button>
        </div>
      ) : (
        /* Requests Ticket Stack */
        <div className="space-y-4">
          {requests.map((req) => {
            const isCompleted = req.status === 'completed' || req.status === 'payment_completed';
            const isCancelled = req.status === 'cancelled';

            return (
              <div
                key={req.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 shadow-hard-sm space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-dashed border-[var(--theme-border)] pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-signal uppercase tracking-wider">
                      {req.order_number}
                    </span>
                    <span className="font-mono text-xs text-[var(--theme-text-muted)]">
                      {new Date(req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-xs font-bold uppercase px-2.5 py-0.5 border ${
                      isCompleted
                        ? 'bg-done text-paper border-done'
                        : isCancelled
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-signal text-ink border-ink'
                    }`}
                  >
                    {isCancelled ? '! CANCELLED' : '✓ COMPLETED'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <h3 className="font-display font-extrabold text-2xl text-[var(--theme-text-main)]">
                      {req.service_name}
                    </h3>
                    <p className="text-sm font-bold text-[var(--theme-text-soft)]">{req.problem}</p>
                    <p className="text-xs text-[var(--theme-text-muted)] font-mono">{req.description}</p>
                    <div className="pt-2 font-mono text-xs text-[var(--theme-text-muted)]">
                      <span className="uppercase">LOCATION: </span>
                      <span>{req.address}</span>
                    </div>

                    {isCancelled && req.cancel_reason && (
                      <div className="p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-xs text-signal mt-2">
                        <span>REASON: {req.cancel_reason}</span>
                      </div>
                    )}

                    {isCompleted && req.rating && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="font-mono text-xs font-bold text-signal">
                          ★ {req.rating.stars}/5
                        </span>
                        <span className="text-xs text-[var(--theme-text-soft)] italic">
                          &quot;{req.rating.comment}&quot;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Partner Snapshot & Actions */}
                  <div className="shrink-0 space-y-3 sm:text-right font-mono text-xs">
                    {req.partner ? (
                      <div>
                        <span className="text-[var(--theme-text-muted)] block uppercase">
                          FIXER ASSIGNED:
                        </span>
                        <span className="font-bold text-[var(--theme-text-main)] block text-sm">
                          {req.partner.name}
                        </span>
                        <span className="text-[var(--theme-text-muted)] block">
                          {req.partner.badge || req.partner.phone}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--theme-text-muted)] block">
                        NO FIXER ASSIGNED
                      </span>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(req)}
                        className="btn-secondary py-1.5 px-3 text-xs min-h-[38px] w-full sm:w-auto"
                      >
                        View Receipt 📄
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* RECEIPT MODAL                                                  */}
      {/* ============================================================== */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink p-6 max-w-lg w-full shadow-hard text-ink space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <span className="font-mono text-xs font-bold uppercase text-signal">
                DIGITAL WORK ORDER RECEIPT
              </span>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-ink/20 pb-2">
                <span className="text-muted">ORDER NUMBER:</span>
                <span className="font-bold text-ink">{selectedReceipt.order_number}</span>
              </div>
              <div className="flex justify-between border-b border-ink/20 pb-2">
                <span className="text-muted">TRADE SERVICE:</span>
                <span className="font-bold text-ink">{selectedReceipt.service_name}</span>
              </div>
              <div className="flex justify-between border-b border-ink/20 pb-2">
                <span className="text-muted">FIXER:</span>
                <span className="font-bold text-ink">
                  {selectedReceipt.partner?.name || 'Assigned Partner'}
                </span>
              </div>
              <div className="flex justify-between border-b border-ink/20 pb-2">
                <span className="text-muted">STATUS:</span>
                <span className="font-bold text-done uppercase">COMPLETED &amp; CONFIRMED</span>
              </div>
              <div className="flex justify-between border-b border-ink/20 pb-2">
                <span className="text-muted">PAYMENT:</span>
                <span className="font-bold text-ink uppercase">SETTLED DIRECTLY ON-SITE</span>
              </div>
              <div className="p-3 bg-concrete border border-ink text-[11px] text-soft">
                {selectedReceipt.problem}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="btn-primary w-full min-h-[44px]"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
