/**
 * FixIt Now - Admin Activity Log Audit View
 * Conforms to SRS FR-A2, Section 5 (Auditability) and docs/DESIGN.md:
 * - Read-only chronological audit trail of all platform events.
 * - Records actor, action, target, details, and exact timestamp.
 * - Desktop-first zebra table with DM Mono headers; stacked ticket cards under md.
 */

import { useState, useEffect } from 'react';
import { getAdminActivityLog } from '../../services/adminService';

export default function AdminActivityLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAdminActivityLog();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (categoryFilter === 'all') return true;
    return log.category?.toLowerCase() === categoryFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            AUDIT TRAIL &amp; SECURITY · FR-A2
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Activity Log Stream ({logs.length})
          </h1>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="btn-secondary px-3 py-1.5 text-xs font-mono font-bold self-start sm:self-auto min-h-[38px]"
        >
          ↻ Refresh Audit Stream
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All Events' },
          { key: 'KYC', label: 'KYC Decisions' },
          { key: 'Plans', label: 'Plan Prices' },
          { key: 'Services', label: 'Services' },
          { key: 'Requests', label: 'Work Orders' },
          { key: 'Subscriptions', label: 'Subscriptions' },
          { key: 'System', label: 'System Pings' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategoryFilter(tab.key)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 min-h-[38px] ${
              categoryFilter === tab.key
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
          [QUERYING AUDIT TRAIL LOGS...]
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO ACTIVITY LOGS FOUND FOR CATEGORY [{categoryFilter.toUpperCase()}]
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
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Log ID</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Actor</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Action</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Target</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Event Audit Details</th>
                  <th className="p-3.5 text-right">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {filtered.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      {log.id}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)] truncate max-w-[180px]">
                      {log.actor}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[9px] font-bold border ${
                          log.status === 'success'
                            ? 'border-done text-done bg-[#EAF8F0] dark:bg-[#0D2E1A]'
                            : log.status === 'warning'
                              ? 'border-signal text-signal bg-[#FFF5F2] dark:bg-[#3D140C]'
                              : log.status === 'error'
                                ? 'border-[#B83A14] text-[#B83A14] bg-[#FFEBEB] dark:bg-[#3D1414]'
                                : 'border-[var(--theme-border)] text-[var(--theme-text-main)] bg-[var(--theme-surface-sub)]'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)] truncate max-w-[200px]">
                      {log.target}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)] max-w-[340px]">
                      {log.details}
                    </td>
                    <td className="p-3.5 text-right text-[var(--theme-text-muted)] whitespace-nowrap">
                      {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                      <span className="text-[10px] block">{new Date(log.time).toLocaleDateString()}</span>
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
            {filtered.map((log) => (
              <div
                key={log.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">{log.id}</span>
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[9px] font-bold border ${
                      log.status === 'success'
                        ? 'border-done text-done'
                        : log.status === 'warning'
                          ? 'border-signal text-signal'
                          : 'border-[var(--theme-border)] text-[var(--theme-text-main)]'
                    }`}
                  >
                    {log.action}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--theme-text-muted)] uppercase">ACTOR:</div>
                  <strong className="text-[var(--theme-text-main)] truncate block">{log.actor}</strong>
                </div>

                <div className="p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] space-y-1">
                  <div className="font-bold text-[var(--theme-text-main)]">{log.target}</div>
                  <div className="text-[var(--theme-text-soft)]">{log.details}</div>
                </div>

                <div className="text-right text-[10px] text-[var(--theme-text-muted)]">
                  {new Date(log.time).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Audit Guarantee Note */}
      <div className="p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)]">
        SRS SECTION 5 AUDITABILITY: Key administrative operations (including KYC approvals, rejections,
        plan price adjustments, and category toggles) are recorded sequentially for immutable auditability.
      </div>
    </div>
  );
}
