/**
 * FixIt Now - Customer Dashboard
 * Work-order themed command center for customers.
 * Conforms to SRS FR-C5, FR-C6, FR-C7 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getServices } from '../../services/serviceService';
import { getRequestHistory } from '../../services/requestService';

export default function CustomerDashboard({
  customer,
  activeRequest,
  onNavigate,
  onSelectService,
}) {
  const [services, setServices] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [servList, history] = await Promise.all([
          getServices(),
          getRequestHistory('all'),
        ]);
        setServices(servList);
        setRecentRequests(history.slice(0, 3));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse w-48" />
        <div className="ruler-strip animate-ruler-sweep my-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============================================================== */}
      {/* 1. WORK ORDER HERO HEADER TICKET                                */}
      {/* ============================================================== */}
      <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-ink pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-paper border-2 border-ink inline-block" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink">
              CUSTOMER COPY · No. 0427
            </span>
          </div>
          <span className="stamp-badge bg-signal text-ink border-ink self-start sm:self-auto">
            NEIGHBOURHOOD DISPATCH (2 KM)
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-ink">
              Welcome back, {customer?.name?.split(' ')[0] || 'Customer'}
            </h1>
            <p className="text-sm sm:text-base text-soft max-w-xl font-sans">
              Immediate home repair dispatch. Verified fixers arrive in 15–25 minutes. No
              commission, no hidden charges.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono text-xs text-soft">
              <span className="text-muted uppercase">PRIMARY LOCATION:</span>
              <span className="font-bold underline truncate max-w-sm">
                {customer?.address || 'Indiranagar, Bengaluru'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('new-request')}
            className="btn-primary shrink-0 min-h-[48px] px-6 text-sm"
          >
            + Create New Request
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. ACTIVE LIVE ORDER BANNER (if an active job exists)          */}
      {/* ============================================================== */}
      {activeRequest && (
        <div className="p-6 bg-ink text-paper border-2 border-signal shadow-hard-signal space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A3F47] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-signal animate-ping" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                ACTIVE JOB IN PROGRESS: {activeRequest.order_number}
              </span>
            </div>
            <span className="font-mono text-xs text-on-dark uppercase">
              STATUS: {activeRequest.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-extrabold text-paper">
                {activeRequest.service_name}
              </h2>
              <p className="text-sm text-on-dark mt-0.5 line-clamp-1">
                {activeRequest.problem}
              </p>
              {activeRequest.service_otp && (
                <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 bg-[#1E2229] border border-signal font-mono text-xs">
                  <span className="text-on-dark">SERVICE OTP:</span>
                  <span className="font-bold text-signal tracking-widest text-sm">
                    {activeRequest.service_otp}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate(activeRequest.status === 'searching' ? 'searching' : 'tracking')
              }
              className="btn-primary min-h-[44px] shrink-0"
            >
              Open Live Tracking Screen →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. TRADE DISPATCH BOARD (Quick Request Selector)               */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-3">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
              INSTANT DISPATCH
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
              Select your trade
            </h2>
          </div>
          <span className="font-mono text-xs text-[var(--theme-text-muted)] uppercase">
            8 VERIFIED NEIGHBOURHOOD DISCIPLINES
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <button
              type="button"
              key={service.id}
              onClick={() => {
                onSelectService(service);
                onNavigate('new-request');
              }}
              className="service-chip min-h-[110px]"
            >
              <div className="flex items-start justify-between w-full gap-2">
                <span className="font-display font-extrabold text-xl leading-snug">
                  {service.name}
                </span>
                <span className="w-3 h-3 border border-current shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between w-full font-mono text-xs mt-3 pt-2 border-t border-current/30">
                <span className="uppercase">DISPATCH</span>
                <span className="font-bold uppercase">WITHIN 2 KM</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. RECENT ACTIVITY CARDS                                       */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3">
          <h2 className="text-2xl font-display font-extrabold text-[var(--theme-text-main)]">
            Recent work orders
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="font-mono text-xs font-bold uppercase text-signal underline hover:text-[var(--theme-text-main)]"
          >
            VIEW ALL HISTORY ({recentRequests.length}) →
          </button>
        </div>

        {recentRequests.length === 0 ? (
          /* Empty State */
          <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center space-y-3">
            <span className="stamp-badge bg-concrete text-ink border-ink mx-auto block w-max">
              NO WORK ORDERS YET
            </span>
            <p className="font-mono text-sm text-[var(--theme-text-soft)]">
              You haven&apos;t placed any service requests yet. When you need repairs, pick a trade
              above!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRequests.map((req) => (
              <div
                key={req.id}
                className="p-5 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-signal uppercase">
                      {req.order_number}
                    </span>
                    <span className="font-mono text-xs text-[var(--theme-text-muted)]">
                      {new Date(req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold uppercase px-2 py-0.5 border ${
                        req.status === 'completed'
                          ? 'bg-done text-paper border-done'
                          : 'bg-[var(--theme-surface-sub)] text-signal border-signal'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
                    {req.service_name}
                  </h3>
                  <p className="text-sm text-[var(--theme-text-soft)] line-clamp-1 max-w-2xl">
                    {req.problem}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {req.partner && (
                    <div className="text-right hidden sm:block font-mono text-xs">
                      <span className="text-[var(--theme-text-muted)] block">PARTNER:</span>
                      <span className="font-bold text-[var(--theme-text-main)]">
                        {req.partner.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('history')}
                    className="btn-secondary text-xs min-h-[38px] py-2"
                  >
                    View Ticket →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
