/**
 * FixIt Now - Partner Job History Screen
 * Filterable history (All, Completed, Cancelled) with work order details and digital receipt modal.
 * Conforms to SRS FR-P11, BR-6 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getPartnerHistory } from '../../services/partnerService';

export default function PartnerHistoryView({ partner }) {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'CANCELLED'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPartnerHistory(partner?.id || 101, filter);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PartnerHistoryView] Error:', err);
      setError(err.message || 'Failed to load archive entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('fixit_partner_history_updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('fixit_partner_history_updated', handleUpdate);
    };
  }, [partner?.id, filter]);

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
                DISPATCH ARCHIVE LOG
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Partner Work Order History
            </h1>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 border text-xs font-bold ${
                filter === 'ALL'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              All Jobs
            </button>
            <button
              type="button"
              onClick={() => setFilter('COMPLETED')}
              className={`px-3 py-1.5 border text-xs font-bold ${
                filter === 'COMPLETED'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              Completed
            </button>
            <button
              type="button"
              onClick={() => setFilter('CANCELLED')}
              className={`px-3 py-1.5 border text-xs font-bold ${
                filter === 'CANCELLED'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Permanent audit log of all completed dispatches, customer ratings, cancellation reasons, and direct on-site payment receipts.
        </p>
      </div>

      {/* History Cards List */}
      {loading ? (
        <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-soft)] border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
          LOADING ARCHIVE ENTRIES...
        </div>
      ) : error ? (
        <div className="p-6 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-3 font-mono">
          <div className="flex items-center gap-2 text-signal text-xs font-bold uppercase">
            <span>[!]</span>
            <span>Failed to load archive entries</span>
          </div>
          <p className="font-sans text-sm text-[var(--theme-text-main)]">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-1.5 border-2 border-ink bg-ink text-paper text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((job) => {
            const isCompleted =
              job.status === 'completed' ||
              job.status === 'service_completed' ||
              job.status === 'payment_completed' ||
              job.status === 'paid';

            return (
              <div
                key={job.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard space-y-4"
                style={{ borderRadius: 0 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-3 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[var(--theme-text-main)]">{job.order_number}</span>
                    <span className="text-[var(--theme-text-soft)]">·</span>
                    <span className="text-[var(--theme-text-soft)]">
                      {new Date(job.completed_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 border text-[10px] font-bold uppercase self-start sm:self-auto ${
                      isCompleted
                        ? 'border-done bg-done text-paper'
                        : 'border-signal bg-paper text-ink'
                    }`}
                  >
                    {isCompleted ? '✓ COMPLETED & SETTLED' : '✕ CANCELLED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-2">
                    <div>
                      <span className="text-[var(--theme-text-soft)] block text-[10px]">CUSTOMER:</span>
                      <span className="font-display font-bold text-sm text-[var(--theme-text-main)]">
                        {job.customer_name} ({job.customer_phone})
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--theme-text-soft)] block text-[10px]">SERVICE &amp; ISSUE:</span>
                      <div className="font-sans text-xs text-[var(--theme-text-main)] font-medium">
                        {job.service_name} &mdash; &ldquo;{job.problem}&rdquo;
                      </div>
                    </div>

                    <div>
                      <span className="text-[var(--theme-text-soft)] block text-[10px]">SITE LOCATION:</span>
                      <div className="text-[var(--theme-text-soft)] leading-relaxed">
                        {job.address}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t md:border-t-0 md:border-l-2 border-[var(--theme-border)] pt-3 md:pt-0 md:pl-4 flex flex-col justify-between">
                    <div>
                      {isCompleted ? (
                        <>
                          <span className="text-[var(--theme-text-soft)] block text-[10px]">PAYMENT STATUS:</span>
                          <div className="font-display font-extrabold text-base sm:text-lg text-done mt-0.5">
                            ✓ Payment Received
                          </div>
                          <span className="text-[11px] text-[var(--theme-text-muted)] block mt-0.5">
                            Job Completed · Direct customer settlement
                          </span>

                          {job.rating && (
                            <div className="mt-3 p-2 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
                              <span className="text-signal font-bold">
                                {'★'.repeat(job.rating.stars)}
                              </span>{' '}
                              <span className="text-[var(--theme-text-soft)] italic">
                                &ldquo;{job.rating.comment}&rdquo;
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-3 bg-concrete border border-ink text-ink space-y-1">
                          <span className="font-bold text-signal block">CANCELLATION RECORD:</span>
                          <p className="text-[11px] text-ink/80 leading-relaxed">
                            {job.cancel_reason || 'Cancelled prior to arrival.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {isCompleted && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(job)}
                          className="px-3 py-1.5 border border-ink bg-concrete hover:bg-signal font-mono text-[11px] font-bold uppercase text-ink"
                        >
                          View Work Order Receipt →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {history.length === 0 && (
            <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-soft)] border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
              No historical jobs found for filter: {filter}.
            </div>
          )}
        </div>
      )}

      {/* Digital Work Order Receipt Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-lg w-full shadow-hard relative text-ink font-mono"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-signal">
                DIGITAL WORK ORDER RECEIPT
              </span>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="w-7 h-7 border border-ink bg-concrete font-bold text-ink hover:bg-signal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-display font-extrabold text-2xl text-ink">
                  {selectedReceipt.order_number}
                </h3>
                <p className="text-muted mt-0.5">
                  Closed on {new Date(selectedReceipt.completed_at).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-4 bg-concrete border border-ink space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">PARTNER:</span>
                  <span className="font-bold text-ink">{partner?.name || 'Rajesh Kumar'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">CUSTOMER:</span>
                  <span className="font-bold text-ink">{selectedReceipt.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">LOCATION:</span>
                  <span className="font-bold text-ink">{selectedReceipt.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">SERVICE:</span>
                  <span className="font-bold text-ink">{selectedReceipt.service_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">SETTLEMENT METHOD:</span>
                  <span className="font-bold text-ink">{selectedReceipt.payment_mode}</span>
                </div>
                <div className="border-t border-ink/20 pt-2 flex justify-between text-sm font-bold">
                  <span>PAYMENT STATUS:</span>
                  <span className="text-done">✓ Payment Received · Job Completed</span>
                </div>
              </div>

              {selectedReceipt.rating && (
                <div className="p-3 border border-ink bg-paper">
                  <span className="font-bold block mb-1">
                    CUSTOMER REVIEW ({selectedReceipt.rating.stars} ★):
                  </span>
                  <p className="italic text-muted">
                    &ldquo;{selectedReceipt.rating.comment}&rdquo;
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="btn-primary w-full min-h-[44px] font-bold text-xs uppercase"
              >
                CLOSE RECEIPT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
