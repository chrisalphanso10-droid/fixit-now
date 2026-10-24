/**
 * FixIt Now - Searching Screen
 * Searching state with sweeping ruler strip, real-time WebSocket status updates,
 * cancel option, and "All partners busy" failure state.
 * Conforms to SRS FR-C11, FR-C12, FR-M5 and docs/DESIGN.md Section 6.
 */

import { useState, useEffect } from 'react';
import { assignMatchedPartner, cancelServiceRequest } from '../../services/requestService';
import socketService from '../../services/socketService';

export default function SearchingView({
  activeRequest,
  onPartnerMatched,
  onNavigate,
}) {
  const [busyState, setBusyState] = useState(
    activeRequest?.dispatch_status === 'busy' || activeRequest?.status === 'cancelled'
  );
  const [cancelling, setCancelling] = useState(false);
  const [partnerAttempt, setPartnerAttempt] = useState(1);
  const [totalPartners, setTotalPartners] = useState(activeRequest?.eligible_partners_count || 1);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    if (!activeRequest) return;

    if (activeRequest.dispatch_status === 'busy' || activeRequest.status === 'cancelled') {
      setBusyState(true);
      return;
    }

    // Register with WebSocket rooms
    if (activeRequest.customer_id) {
      socketService.registerCustomer(activeRequest.customer_id);
    }
    if (activeRequest.id) {
      socketService.joinRequest(activeRequest.id);
    }

    // 1. Listen for partner acceptance
    const unsubAccepted = socketService.onRequestAccepted(async (data) => {
      if (!activeRequest?.id || String(data.requestId) === String(activeRequest.id)) {
        const updated = await assignMatchedPartner(data.requestId, data.partner, data);
        if (onPartnerMatched) onPartnerMatched(updated);
        onNavigate('tracking');
      }
    });

    // 2. Listen for "All partners busy" failure state (SRS FR-C12, FR-M5)
    const unsubBusy = socketService.onAllPartnersBusy((data) => {
      if (String(data.requestId) === String(activeRequest.id)) {
        setBusyState(true);
      }
    });

    // 3. Listen for search progression updates across eligible partners
    const unsubUpdate = socketService.onSearchingUpdate((data) => {
      if (String(data.requestId) === String(activeRequest.id)) {
        setPartnerAttempt(data.attemptingPartnerIndex || 1);
        setTotalPartners(data.totalEligible || 1);
        if (data.countdown) setSecondsRemaining(data.countdown);
      }
    });

    return () => {
      unsubAccepted();
      unsubBusy();
      unsubUpdate();
    };
  }, [activeRequest, onNavigate, onPartnerMatched]);

  // Visual countdown timer tick
  useEffect(() => {
    if (busyState) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) return 30; // reset for next partner cascade
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [busyState]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      if (activeRequest) {
        socketService.cancelJob(activeRequest.id, 'Cancelled by customer during search');
        await cancelServiceRequest(activeRequest.id, 'Cancelled during partner search');
      }
      onNavigate('dashboard');
    } catch (err) {
      console.error('Cancel failed:', err);
      onNavigate('dashboard');
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = () => {
    onNavigate('new-request');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* ============================================================== */}
      {/* 1. PULSING RULER STRIP (DESIGN.md Section 6)                   */}
      {/* ============================================================== */}
      <div className="space-y-2 text-center">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
          DISPATCH PROTOCOL ACTIVE
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
          {busyState ? 'Search Timeout' : 'Finding the nearest partner'}
        </h1>
        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-muted)] uppercase">
          Scanning online, KYC-verified fixers within a 2 km radius...
        </p>
      </div>

      {/* Sweeping tape-measure band */}
      <div className="relative">
        <div className={`ruler-strip ${!busyState ? 'animate-ruler-sweep' : ''}`} />
      </div>

      {/* ============================================================== */}
      {/* 2. ALL PARTNERS BUSY STATE (SRS FR-C12 & DESIGN.md)             */}
      {/* ============================================================== */}
      {busyState ? (
        <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
          <div className="flex items-center justify-between border-b-2 border-ink pb-4">
            <span className="stamp-badge bg-signal text-ink border-ink">
              ALL PARTNERS BUSY
            </span>
            <span className="font-mono text-xs text-soft font-bold uppercase">
              RADIUS: 2.0 KM EXHAUSTED
            </span>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-display font-extrabold text-ink">
              All partners busy, try again later
            </h2>
            <p className="text-sm sm:text-base text-soft font-sans">
              We checked all verified partners within 2 km of your location. No fixers are available
              right now or all eligible partners are occupied. Please try again in a few minutes, or adjust your request address.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              className="btn-primary w-full sm:w-auto min-h-[44px]"
            >
              Retry Request (2 km) ↺
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="btn-secondary w-full sm:w-auto min-h-[44px]"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* 3. ACTIVE SEARCHING RADAR CARD                               */
        /* ============================================================ */
        <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6">
          {/* Header Ticket Row */}
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-signal inline-block animate-ping" />
              <span className="font-bold text-signal uppercase tracking-wider">
                BROADCASTING TO {Math.max(1, totalPartners)} ELIGIBLE PARTNERS
              </span>
            </div>
            <span className="font-bold uppercase text-[var(--theme-text-muted)]">
              TIMER: {secondsRemaining}s
            </span>
          </div>

          {/* Searching Graphic / Animated Circle */}
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="relative w-28 h-28 border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] flex items-center justify-center">
              {/* Outer pulse square */}
              <div className="absolute inset-0 border-2 border-signal animate-ping opacity-40" />
              {/* Central signal dot */}
              <div className="w-5 h-5 bg-signal border border-[var(--theme-border)] rotate-45" />
            </div>

            <div className="text-center space-y-1">
              <span className="font-display font-extrabold text-xl text-[var(--theme-text-main)] block">
                {activeRequest ? activeRequest.service_name : 'Trade Service'}
              </span>
              <span className="font-mono text-xs text-[var(--theme-text-soft)] block max-w-sm">
                Target Area: {activeRequest ? activeRequest.address : 'Indiranagar, Bengaluru'}
              </span>
              <span className="font-mono text-[11px] text-[var(--theme-text-muted)] block">
                Order Ref: {activeRequest?.order_number || 'ORD-0428'}
              </span>
            </div>
          </div>

          {/* Tear Line Divider */}
          <div className="tear-line my-4" />

          {/* Always Visible Cancel Button (DESIGN.md Section 6) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancel}
              className="btn-secondary w-full sm:w-auto min-h-[44px]"
            >
              {cancelling ? 'Cancelling...' : '✕ Cancel Request'}
            </button>

            <span className="font-mono text-[11px] text-[var(--theme-text-muted)]">
              Auto-cascades to next nearest fixer if unanswered
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
