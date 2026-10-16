/**
 * FixIt Now - Admin Partners Read-Only Table View
 * Conforms to SRS FR-A2, FR-A3 and docs/DESIGN.md:
 * - Read-only monitoring of all registered partners.
 * - Strictly NO edit or delete controls (FR-A3).
 * - Desktop-first zebra table with DM Mono headers and 2px borders.
 * - Stacked ticket cards under md (< 768px).
 */

import { useState, useEffect } from 'react';
import { getAdminPartners } from '../../services/adminService';

export default function AdminPartnersView() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getAdminPartners().then((data) => {
      setPartners(data);
      setLoading(false);
    });
  }, []);

  const filtered = partners.filter((p) => {
    // Tab filter
    if (filter === 'online' && !p.online) return false;
    if (filter === 'verified' && p.kyc_status !== 'verified') return false;
    if (filter === 'pending' && p.kyc_status !== 'pending') return false;
    if (filter === 'expired' && p.subscription_status !== 'expired') return false;

    // Search term
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      p.service_name.toLowerCase().includes(term) ||
      p.phone.includes(term)
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
            Service Partners ({partners.length})
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-muted)] flex items-center gap-1.5">
          <span className="w-2 h-2 bg-done rounded-full inline-block" />
          <span>FR-A3 ENFORCED: Partner data is read-only</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'All Partners' },
            { key: 'online', label: 'Online Units' },
            { key: 'verified', label: 'KYC Verified' },
            { key: 'pending', label: 'Pending KYC' },
            { key: 'expired', label: 'Expired Plan' },
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

        <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2 shadow-hard-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search partner name, phone, trade..."
            className="bg-transparent border-none p-1 font-mono text-xs text-[var(--theme-text-main)] focus:outline-none w-full md:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [SCANNING PARTNER REGISTRY &amp; DISPATCH RADAR...]
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO PARTNERS MATCHING APPLIED FILTERS
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
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Partner Name</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Trade Category</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)]">Contact</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Status</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">KYC State</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Plan</th>
                  <th className="p-3.5 border-r border-[var(--theme-border)] text-center">Rating</th>
                  <th className="p-3.5 text-right">Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {filtered.map((partner, idx) => (
                  <tr
                    key={partner.id}
                    className={`transition-colors hover:bg-signal/5 ${
                      idx % 2 === 0 ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)]'
                    }`}
                  >
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-signal">
                      #{partner.id}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)]">
                      <div className="font-bold text-[var(--theme-text-main)]">{partner.name}</div>
                      <div className="text-[10px] text-[var(--theme-text-muted)] truncate">{partner.vehicle}</div>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] font-bold text-[var(--theme-text-main)]">
                      {partner.service_name}
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                      <div>{partner.phone}</div>
                      <div className="text-[10px] text-[var(--theme-text-muted)] truncate max-w-[150px]">{partner.email}</div>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold border ${
                          partner.online
                            ? 'bg-[#EAF8F0] dark:bg-[#0D2E1A] text-done border-done'
                            : 'bg-[var(--theme-surface-sub)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'
                        }`}
                      >
                        {partner.online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center">
                      <span
                        className={`stamp-badge text-[9px] px-1 py-0 ${
                          partner.kyc_status === 'verified'
                            ? 'border-done text-done'
                            : partner.kyc_status === 'pending'
                              ? 'border-signal text-signal'
                              : 'border-[#B83A14] text-[#B83A14]'
                        }`}
                      >
                        {partner.kyc_status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center">
                      <span
                        className={`text-[10px] font-bold ${
                          partner.subscription_status === 'active'
                            ? 'text-done'
                            : partner.subscription_status === 'warning'
                              ? 'text-signal'
                              : 'text-[#B83A14]'
                        }`}
                      >
                        {partner.subscription_status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 border-r border-[var(--theme-border)] text-center font-bold text-done">
                      {partner.rating} ★
                    </td>
                    <td className="p-3.5 text-right font-bold text-[var(--theme-text-main)]">
                      {partner.total_jobs}
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
            {filtered.map((partner) => (
              <div
                key={partner.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-4 shadow-hard text-xs font-mono space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                  <span className="font-bold text-signal">
                    PARTNER #{partner.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                        partner.online ? 'border-done text-done' : 'border-[var(--theme-border)] text-muted'
                      }`}
                    >
                      {partner.online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span
                      className={`stamp-badge text-[9px] px-1 py-0 ${
                        partner.kyc_status === 'verified'
                          ? 'border-done text-done'
                          : partner.kyc_status === 'pending'
                            ? 'border-signal text-signal'
                            : 'border-[#B83A14] text-[#B83A14]'
                      }`}
                    >
                      {partner.kyc_status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-base text-[var(--theme-text-main)]">
                    {partner.name}
                  </h3>
                  <div className="text-signal font-bold">{partner.service_name}</div>
                  <div className="text-[var(--theme-text-soft)]">{partner.phone}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] text-center">
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">RATING</span>
                    <span className="font-bold text-done">{partner.rating} ★</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">JOBS</span>
                    <span className="font-bold text-[var(--theme-text-main)]">{partner.total_jobs}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase">PLAN</span>
                    <span
                      className={`font-bold ${
                        partner.subscription_status === 'active'
                          ? 'text-done'
                          : partner.subscription_status === 'warning'
                            ? 'text-signal'
                            : 'text-[#B83A14]'
                      }`}
                    >
                      {partner.subscription_status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--theme-text-soft)]">
                  Vehicle: {partner.vehicle}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FR-A3 Rule Note */}
      <div className="p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text-muted)]">
        SRS RULE FR-A3: Partner records cannot be edited or deleted by administrative staff.
        Service categories and subscriptions are governed strictly by partner submissions and automated business rules.
      </div>
    </div>
  );
}
