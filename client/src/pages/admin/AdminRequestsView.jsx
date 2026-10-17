/**
 * FixIt Now - Admin Requests Read-Only Table View
 * Conforms to SRS FR-A2 and docs/DESIGN.md:
 * - Read-only monitoring of all service requests.
 * - Filterable by: in_progress, accepted, pending, completed, cancelled, all.
 * - Desktop-first zebra table with DM Mono headers; stacked ticket cards under md.
 */

import { useState, useEffect } from 'react';
import { getAdminRequests } from '../../services/adminService';

export default function AdminRequestsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchRequests = () => {
    setLoading(true);
    setError(null);
    getAdminRequests(filter)
      .then((data) => {
        setRequests(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load service requests stream.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const sortedRequests = [...requests].sort(
    (a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            WORK ORDER AUDIT · FR-A2
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Service Requests Stream ({requests.length})
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-soft)]">
          DISPATCH RULE: 2 KM HAVERSINE RADIUS · REAL-TIME SOCKET.IO
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All Requests' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'accepted', label: 'Accepted (En-route)' },
          { key: 'pending', label: 'Searching (Pending)' },
          { key: 'completed', label: 'Completed' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 min-h-[38px] ${
              filter === tab.key
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
            onClick={fetchRequests}
            className="px-3 py-1.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [SCANNING CITY-WIDE WORK ORDERS &amp; OTP LOGS...]
        </div>
      ) : requests.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO REQUESTS FOUND FOR FILTER [{filter.toUpperCase()}]
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
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Service &amp; Problem</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Assigned Partner</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Status</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Service OTP</th>
                  <th className="p-3.5 text-right">Created Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {sortedRequests.map((req, idx) => (
                  <tr
                    key={req.id}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      {req.order_number}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)]">
                      {req.customer_name || 'Customer #1'}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] max-w-[280px]">
                      <div className="font-bold text-[var(--theme-text-main)]">{req.service_name}</div>
                      <div className="text-[11px] text-[var(--theme-text-soft)] line-clamp-1">{req.problem}</div>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                      {req.partner ? (
                        <div>
                          <strong className="text-[var(--theme-text-main)]">{req.partner.name}</strong>
                          <span className="block text-[10px] text-[var(--theme-text-muted)]">
                            {req.partner.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--theme-text-muted)] italic">Searching within 2km...</span>
                      )}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center">
                      <span
                        className={`stamp-badge text-[9px] px-1.5 py-0 ${
                          req.status === 'completed'
                            ? 'border-done text-done'
                            : req.status === 'in_progress'
                              ? 'border-signal text-signal'
                              : req.status === 'accepted'
                                ? 'border-[#0055FF] text-[#0055FF]'
                                : req.status === 'pending'
                                  ? 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                                  : 'border-[#B83A14] text-[#B83A14]'
                        }`}
                      >
                        {req.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center font-bold text-[var(--theme-text-main)]">
                      {req.service_otp ? (
                        <span className="bg-[var(--theme-surface-sub)] px-1.5 py-0.5 border border-[var(--theme-border)]">
                          {req.service_otp}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3.5 text-right text-[var(--theme-text-muted)]">
                      <div>{new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-[10px] text-[var(--theme-text-muted)]">
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
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
            {sortedRequests.map((req) => (
              <div
                key={req.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">{req.order_number}</span>
                  <span
                    className={`stamp-badge text-[9px] px-1 py-0 ${
                      req.status === 'completed'
                        ? 'border-done text-done'
                        : req.status === 'in_progress'
                          ? 'border-signal text-signal'
                          : req.status === 'accepted'
                            ? 'border-[#0055FF] text-[#0055FF]'
                            : 'border-[#B83A14] text-[#B83A14]'
                    }`}
                  >
                    {req.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">SERVICE:</span>
                  <strong className="text-[var(--theme-text-main)]">{req.service_name}</strong>
                  <p className="text-[var(--theme-text-soft)] mt-0.5">{req.problem}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">CUSTOMER:</span>
                    <span className="text-[var(--theme-text-main)] font-bold">{req.customer_name || 'Customer #1'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">ASSIGNED PARTNER:</span>
                    <span className="text-[var(--theme-text-main)] font-bold">
                      {req.partner ? req.partner.name : 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-[var(--theme-text-muted)]">
                    Service OTP: <strong className="text-signal">{req.service_otp}</strong>
                  </span>
                  <span className="text-[var(--theme-text-muted)] text-right">
                    <span>{new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>{' '}
                    <span>{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
