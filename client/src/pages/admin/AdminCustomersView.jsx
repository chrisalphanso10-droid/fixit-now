/**
 * FixIt Now - Admin Customers Read-Only Table View
 * Conforms to SRS FR-A2, FR-A3 and docs/DESIGN.md:
 * - Read-only monitoring of registered customers.
 * - Strictly NO edit or delete controls (FR-A3).
 * - Desktop-first zebra table with 2px ink border and DM Mono headers.
 * - Automatically transforms into stacked ticket cards under md (< 768px).
 */

import { useState, useEffect } from 'react';
import { getAdminCustomers } from '../../services/adminService';

export default function AdminCustomersView() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getAdminCustomers().then((data) => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const filtered = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.address.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            READ-ONLY DIRECTORY · FR-A2 &amp; FR-A3
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Registered Customers ({customers.length})
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-muted)] flex items-center gap-1.5">
          <span className="w-2 h-2 bg-done rounded-full inline-block" />
          <span>FR-A3 ENFORCED: Modification disabled</span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-3 shadow-hard-sm">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-signal font-bold">SEARCH:</span>
          <input
            id="customer-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by customer name, phone, email, or street address..."
            className="w-full bg-transparent border-none p-1 text-[var(--theme-text-main)] focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[var(--theme-text-muted)] hover:text-signal"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [FETCHING REGISTERED CUSTOMER PROFILES...]
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO CUSTOMERS MATCHING SEARCH QUERY
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
                  <th className="p-3.5 border-r border-[var(--theme-border)]">ID</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Customer Name</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Contact Phone</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Email Address</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Registered Address</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Bookings</th>
                  <th className="p-3.5 text-right">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {filtered.map((customer, idx) => (
                  <tr
                    key={customer.id}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      #{String(customer.id).padStart(3, '0')}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)]">
                      {customer.name}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                      {customer.phone}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)] truncate max-w-[200px]">
                      {customer.email}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)] max-w-[280px]">
                      <span className="line-clamp-2">{customer.address}</span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center font-bold text-[var(--theme-text-main)]">
                      {customer.total_bookings || 1}
                    </td>
                    <td className="p-3.5 text-right text-[var(--theme-text-muted)]">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '2026-09-15'}
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
            {filtered.map((customer) => (
              <div
                key={customer.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">
                    CUSTOMER #{String(customer.id).padStart(3, '0')}
                  </span>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">
                    {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '2026-09-15'}
                  </span>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-base text-[var(--theme-text-main)]">
                    {customer.name}
                  </h3>
                  <div className="text-[var(--theme-text-soft)]">{customer.phone}</div>
                  <div className="text-[var(--theme-text-soft)] truncate">{customer.email}</div>
                </div>

                <div className="p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                  <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">PRIMARY ADDRESS:</span>
                  <span className="text-[var(--theme-text-soft)]">{customer.address}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[var(--theme-text-muted)]">TOTAL COMPLETED ORDERS:</span>
                  <span className="font-bold text-done">{customer.total_bookings || 1} JOBS</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FR-A3 Rule Note */}
      <div className="p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)]">
        SRS RULE FR-A3 &amp; BR-7: Administrators operate in strictly read-only mode for customer identities.
        No edit, profile override, or deletion controls are available to protect privacy.
      </div>
    </div>
  );
}
