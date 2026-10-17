/**
 * FixIt Now - Live Tracking Screen
 * Highlight of the product: Custom SVG map with animated partner movement & countdown ETA,
 * Work-order ticket with the six status step ticks stamping in on timer.
 * Conforms to SRS FR-C14, FR-C15, FR-C16, FR-T1, FR-T2 and docs/DESIGN.md Section 6.
 */

import { useState, useEffect } from 'react';
import { cancelServiceRequest } from '../../services/requestService';
import socketService from '../../services/socketService';

export default function LiveTrackingView({
  activeRequest,
  onNavigate,
  onCancel,
}) {
  // Step index: 1 to 6
  // 1: Request accepted
  // 2: Partner on the way
  // 3: Partner arrived
  // 4: Service started (OTP verified)
  // 5: Service completed
  // 6: Payment completed
  // Step index: 1 to 6
  // 1: Request accepted
  // 2: Partner on the way
  // 3: Partner arrived
  // 4: Service started (OTP verified)
  // 5: Service completed
  // 6: Payment completed
  const [currentStep, setCurrentStep] = useState(activeRequest?.step_index || 1);
  const [partnerProgress, setPartnerProgress] = useState(
    (activeRequest?.step_index || 1) <= 1 ? 0 : (activeRequest?.step_index || 1) === 2 ? 0.05 : 1.0
  );
  const [etaMinutes, setEtaMinutes] = useState(
    (activeRequest?.step_index || 1) <= 1 ? 14 : (activeRequest?.step_index || 1) === 2 ? 10 : 0
  );
  const [isCancelled, setIsCancelled] = useState(activeRequest?.status === 'cancelled');
  const [cancelledReasonText, setCancelledReasonText] = useState(activeRequest?.cancel_reason || '');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Found another solution');
  const [showOtpModal, setShowOtpModal] = useState(
    activeRequest?.step_index === 3 ||
      activeRequest?.status === 'partner_arrived' ||
      activeRequest?.status === 'arrived'
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentConfirmed, setPaymentConfirmed] = useState(
    activeRequest?.step_index >= 6 ||
      activeRequest?.status === 'paid' ||
      activeRequest?.status === 'payment_completed' ||
      false
  );

  // Sync step from activeRequest prop if provided
  useEffect(() => {
    if (activeRequest?.step_index) {
      setCurrentStep(activeRequest.step_index);
      if (activeRequest.step_index >= 3) {
        setPartnerProgress(1.0);
        setEtaMinutes(0);
      }
      if (
        activeRequest.step_index === 3 ||
        activeRequest.status === 'partner_arrived' ||
        activeRequest.status === 'arrived'
      ) {
        setShowOtpModal(true);
      }
      if (
        activeRequest.step_index >= 6 ||
        activeRequest.status === 'paid' ||
        activeRequest.status === 'payment_completed'
      ) {
        setPaymentConfirmed(true);
      }
    }
    if (activeRequest?.status === 'cancelled') {
      setIsCancelled(true);
      setCancelledReasonText(activeRequest.cancel_reason || 'Cancelled by customer');
    }
  }, [activeRequest?.step_index, activeRequest?.status, activeRequest?.cancel_reason]);

  // Real-time Socket.IO listener: updates tracking status & movement
  useEffect(() => {
    if (!activeRequest?.id) return;

    socketService.joinRequest(activeRequest.id);
    if (activeRequest.customer_id) {
      socketService.registerCustomer(activeRequest.customer_id);
    }

    const handleOtpPrompt = (data) => {
      if (
        !data ||
        !data.requestId ||
        String(data.requestId) === String(activeRequest.id)
      ) {
        setShowOtpModal(true);
      }
    };

    const handleStatusUpdate = (data) => {
      if (
        data &&
        (String(data.requestId) === String(activeRequest.id) ||
          String(data.id) === String(activeRequest.id))
      ) {
        if (data.step_index != null) {
          setCurrentStep(data.step_index);
          // If step 2 (partner on the way), initial progress
          if (data.step_index === 2) {
            setEtaMinutes(14);
          }
          // If partner arrived (step 3), partner reached destination
          if (
            data.step_index === 3 ||
            data.status === 'arrived' ||
            data.status === 'partner_arrived'
          ) {
            setPartnerProgress(1.0);
            setEtaMinutes(0);
            setShowOtpModal(true);
          }
          // If service started (step 4+), automatically close OTP modal as it is verified!
          if (
            data.step_index >= 4 ||
            data.status === 'service_started' ||
            data.status === 'in_progress'
          ) {
            setPartnerProgress(1.0);
            setEtaMinutes(0);
            setShowOtpModal(false);
          }
          // If payment completed (step 6), confirm payment on customer screen!
          if (
            data.step_index >= 6 ||
            data.status === 'paid' ||
            data.status === 'payment_completed'
          ) {
            setPaymentConfirmed(true);
            setShowPaymentModal(false);
          }
        }
      }
    };

    // Live movement position updates from server (SRS FR-T2, FR-C15)
    const handleLocationUpdate = (data) => {
      if (
        data &&
        (String(data.requestId) === String(activeRequest.id) ||
          String(data.id) === String(activeRequest.id))
      ) {
        if (typeof data.progress === 'number') {
          setPartnerProgress(Math.min(1.0, Math.max(0, data.progress)));
        }
        if (typeof data.eta_minutes === 'number') {
          setEtaMinutes(data.eta_minutes);
        }
      }
    };

    // Immediate cancellation notification
    const handleCancel = (data) => {
      if (
        data &&
        (String(data.requestId) === String(activeRequest.id) ||
          String(data.id) === String(activeRequest.id))
      ) {
        setIsCancelled(true);
        setCancelledReasonText(data.reason || 'Cancelled by customer');
      }
    };

    try {
      if (typeof socketService.on === 'function') {
        socketService.on('request_status_updated', handleStatusUpdate);
        socketService.on('partner_location', handleLocationUpdate);
        socketService.on('partner_location_update', handleLocationUpdate);
        socketService.on('otp_prompt_customer', handleOtpPrompt);
        socketService.on('request_cancelled', handleCancel);
      }
    } catch (err) {
      console.warn('[LiveTrackingView] socket subscription warning:', err);
    }

    return () => {
      try {
        if (typeof socketService.off === 'function') {
          socketService.off('request_status_updated', handleStatusUpdate);
          socketService.off('partner_location', handleLocationUpdate);
          socketService.off('partner_location_update', handleLocationUpdate);
          socketService.off('otp_prompt_customer', handleOtpPrompt);
          socketService.off('request_cancelled', handleCancel);
        }
      } catch {
        // ignore cleanup warning
      }
    };
  }, [activeRequest?.id, activeRequest?.customer_id]);

  // Steps definition matching SRS FR-C14
  const steps = [
    { id: 1, title: 'Request accepted', detail: 'Nearest partner confirmed job ticket.' },
    { id: 2, title: 'Partner on the way', detail: 'Travelling towards your street address.' },
    { id: 3, title: 'Partner arrived', detail: 'Partner is at your door. Verify service OTP.' },
    { id: 4, title: 'Service started', detail: 'Work order executed. Tools in action.' },
    { id: 5, title: 'Service completed', detail: 'Repair inspection complete and tested.' },
    { id: 6, title: 'Payment completed', detail: 'Settled directly with partner. Confirmed.' },
  ];

  // Route waypoints on SVG map (600 x 300)
  const waypoints = [
    { x: 100, y: 70 },
    { x: 220, y: 70 },
    { x: 220, y: 150 },
    { x: 380, y: 150 },
    { x: 380, y: 220 },
    { x: 490, y: 220 }, // Customer position
  ];

  // Calculate current partner position along waypoints
  const getPartnerCoords = (progress) => {
    const validProgress = typeof progress === 'number' && !isNaN(progress) ? progress : 0;
    const totalSegments = waypoints.length - 1;
    const scaled = Math.max(0, Math.min(1, validProgress)) * totalSegments;
    const segIndex = Math.min(Math.floor(scaled), totalSegments - 1);
    const segT = scaled - segIndex;

    const p1 = waypoints[segIndex] || waypoints[0];
    const p2 = waypoints[segIndex + 1] || waypoints[waypoints.length - 1];

    return {
      x: p1.x + (p2.x - p1.x) * segT,
      y: p1.y + (p2.y - p1.y) * segT,
    };
  };

  const partnerPos = getPartnerCoords(partnerProgress);

  const handleCancelSubmit = async () => {
    setShowCancelModal(false);
    setIsCancelled(true);
    setCancelledReasonText(cancelReason);
    if (activeRequest && activeRequest.id) {
      await cancelServiceRequest(activeRequest.id, cancelReason);
    }
  };

  const rawPartner = activeRequest?.partner || {};
  const partner = {
    name: rawPartner.name || activeRequest?.partner_name || 'Rajesh Kumar',
    phone: rawPartner.phone || activeRequest?.partner_phone || '+91 98450 11223',
    rating: rawPartner.rating || activeRequest?.partner_rating || 4.9,
    service_name: rawPartner.service_name || activeRequest?.service_name || 'Plumbing Repairs',
    badge: rawPartner.badge || activeRequest?.partner_badge || 'Certified Master Plumber',
    vehicle: rawPartner.vehicle || activeRequest?.partner_vehicle || 'Bajaj Pulsar (KA-03-HJ-4421)',
  };
  const partnerInitial = (partner.name && typeof partner.name === 'string')
    ? partner.name.charAt(0)
    : 'P';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ============================================================== */}
      {/* CANCELLATION NOTICE & GO TO DASHBOARD BUTTON (SRS FR-C19)       */}
      {/* ============================================================== */}
      {isCancelled && (
        <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-4">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <span className="stamp-badge bg-signal text-ink border-ink font-bold text-xs">
              ! WORK ORDER CANCELLED
            </span>
            <span className="font-mono text-xs text-soft font-bold uppercase">
              STATUS: CANCELLED
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-ink">
              Request Cancelled
            </h2>
            <p className="text-sm sm:text-base text-soft font-sans">
              Your service request ({activeRequest?.order_number || 'Work Order'}) has been cancelled.
              {cancelledReasonText ? ` Reason: "${cancelledReasonText}". ` : ' '}
              The partner has been notified instantly and released for new dispatches.
            </p>
          </div>

          <div className="p-3.5 bg-concrete border-2 border-ink font-mono text-xs space-y-1">
            <div>• ORDER NUMBER: <span className="font-bold text-ink">{activeRequest?.order_number || 'ORD-0428'}</span></div>
            <div>• SERVICE: <span className="font-bold text-ink">{activeRequest?.service_name || 'Home Service'}</span></div>
            <div>• RECORD: Archived in your permanent customer history.</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                onNavigate('dashboard');
              }}
              className="btn-primary min-h-[48px] px-8 text-sm font-mono font-bold uppercase tracking-wider shadow-hard"
            >
              Go to dashboard →
            </button>
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                onNavigate('history');
              }}
              className="btn-secondary min-h-[48px] px-6 text-xs font-mono font-bold uppercase tracking-wider"
            >
              View in history
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. CUSTOM SVG MAP (DESIGN.md Section 6 & 10)                   */}
      {/* ============================================================== */}
      <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard overflow-hidden">
        {/* Top ETA & Telemetry Bar in DM Mono */}
        <div className="bg-ink text-paper px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-signal border border-paper inline-block" />
            <span className="font-bold text-signal tracking-wider">
              {currentStep < 3
                ? `ETA: ${etaMinutes} MIN · DISTANCE: 0.8 KM`
                : currentStep === 3
                ? 'PARTNER ARRIVED AT LOCATION'
                : currentStep === 4
                ? 'SERVICE IN PROGRESS'
                : currentStep === 5
                ? 'SERVICE COMPLETED'
                : 'PAYMENT CONFIRMED'}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-on-dark">
            <span className="hidden sm:inline">DISPATCH ZONE: INDIRANAGAR (2 KM)</span>
            <span className="uppercase bg-[#242931] px-2 py-0.5 border border-[#3A3F47] text-signal font-bold">
              STEP {currentStep}/6
            </span>
          </div>
        </div>

        {/* SVG Canvas Map */}
        <div className="relative w-full aspect-[2/1] sm:aspect-[2.4/1] bg-[var(--theme-surface-sub)] border-b-2 border-[var(--theme-border)]">
          <svg
            viewBox="0 0 600 300"
            className="w-full h-full select-none"
            aria-label="Live partner transit map"
          >
            {/* Street Grid background lines */}
            <g stroke="var(--theme-border)" strokeWidth="1.5" opacity="0.35">
              {/* Horizontal Streets */}
              <line x1="0" y1="70" x2="600" y2="70" />
              <line x1="0" y1="150" x2="600" y2="150" />
              <line x1="0" y1="220" x2="600" y2="220" />
              <line x1="0" y1="280" x2="600" y2="280" />

              {/* Vertical Streets */}
              <line x1="100" y1="0" x2="100" y2="300" />
              <line x1="220" y1="0" x2="220" y2="300" />
              <line x1="380" y1="0" x2="380" y2="300" />
              <line x1="490" y1="0" x2="490" y2="300" />
            </g>

            {/* Street Names (DM Mono, uppercase) */}
            <g
              fontFamily="DM Mono, monospace"
              fontSize="9"
              fill="var(--theme-text-muted)"
              letterSpacing="0.06em"
            >
              <text x="15" y="65">
                100 FT ROAD
              </text>
              <text x="15" y="145">
                12TH MAIN STREET
              </text>
              <text x="15" y="215">
                3RD CROSS (YOUR STREET)
              </text>
              <text x="105" y="20">
                ZONE 2A
              </text>
              <text x="385" y="20">
                ZONE 2B
              </text>
            </g>

            {/* Dashed Transit Route */}
            <polyline
              points="100,70 220,70 220,150 380,150 380,220 490,220"
              fill="none"
              stroke="#FF5B14"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />

            {/* Customer Location Marker: Ink circle with house badge */}
            <g transform="translate(490, 220)">
              {/* Pulse ripple */}
              <circle r="18" fill="none" stroke="var(--theme-border)" strokeWidth="1.5" opacity="0.4" />
              {/* Solid Ink circle */}
              <circle r="12" fill="var(--theme-border)" stroke="var(--theme-surface)" strokeWidth="2" />
              {/* House shape */}
              <polygon points="0,-6 -6,0 -4,0 -4,6 4,6 4,0 6,0" fill="#FBFAF6" />
              {/* Label */}
              <text
                x="0"
                y="26"
                textAnchor="middle"
                fontFamily="DM Mono, monospace"
                fontSize="10"
                fontWeight="700"
                fill="var(--theme-text-main)"
              >
                YOU
              </text>
            </g>

            {/* Partner Location Marker: Signal square with tool */}
            <g
              transform={`translate(${partnerPos.x}, ${partnerPos.y})`}
              className="transition-transform duration-150"
            >
              {/* Outer signal square */}
              <rect
                x="-12"
                y="-12"
                width="24"
                height="24"
                fill="#FF5B14"
                stroke="#111418"
                strokeWidth="2"
              />
              {/* Inner tool icon */}
              <polygon points="-4,-4 4,-4 4,4 -4,4" fill="#111418" />
              {/* Partner Label */}
              <text
                x="0"
                y="-18"
                textAnchor="middle"
                fontFamily="DM Mono, monospace"
                fontSize="10"
                fontWeight="700"
                fill="#FF5B14"
              >
                PARTNER
              </text>
            </g>
          </svg>
        </div>

        {/* Live Status Telemetry Bar */}
        <div className="p-3 bg-[var(--theme-surface)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs border-t border-[var(--theme-border)]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-signal animate-ping" />
            <span className="font-bold text-[var(--theme-text-main)] uppercase tracking-wider">
              {currentStep === 1
                ? 'WAITING FOR PARTNER TO START TRIP'
                : currentStep === 2
                ? 'PARTNER EN ROUTE TO YOUR LOCATION'
                : currentStep === 3
                ? 'PARTNER ARRIVED · SHARE 6-DIGIT OTP'
                : currentStep === 4
                ? 'SERVICE IN PROGRESS'
                : currentStep === 5
                ? 'SERVICE COMPLETED · SETTLE ON-SITE'
                : 'WORK ORDER SETTLED DIRECTLY'}
            </span>
          </div>

          <span className="font-mono text-[11px] text-[var(--theme-text-muted)] uppercase">
            LIVE DISPATCH · STATUS UPDATED ONLY BY PARTNER
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. PROMINENT 6-DIGIT SERVICE OTP (SRS FR-C16)                   */}
      {/* ============================================================== */}
      {currentStep < 4 ? (
        <div className="p-5 sm:p-6 bg-paper border-2 border-signal shadow-hard space-y-2 text-ink">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-3">
            <span className="font-mono text-xs text-signal font-bold uppercase tracking-wider">
              YOUR 6-DIGIT SERVICE VERIFICATION OTP
            </span>
            <span className="stamp-badge bg-signal text-ink border-ink text-[11px]">
              SHARE UPON ARRIVAL
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="font-mono text-4xl sm:text-5xl font-black text-ink tracking-[0.25em]">
              {activeRequest?.service_otp || '------'}
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <p className="font-mono text-xs text-soft max-w-sm">
                When the fixer arrives at your door, share this 6-digit code. They will verify it on their screen to authenticate and commence repair work.
              </p>
              <button
                type="button"
                onClick={() => setShowOtpModal(true)}
                className="btn-primary min-h-[38px] px-4 text-xs font-mono font-bold uppercase tracking-wider self-start sm:self-auto"
              >
                POP UP OTP SCREEN ↗
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-concrete border-2 border-done flex flex-wrap items-center justify-between gap-2 text-ink">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 bg-done rounded-full flex items-center justify-center text-paper font-bold text-[10px]">
              ✓
            </span>
            <span className="font-mono text-xs text-done font-bold uppercase tracking-wider">
              SERVICE OTP VERIFIED ({activeRequest?.service_otp})
            </span>
          </div>
          <span className="font-mono text-xs text-soft uppercase">
            WORK ORDER IN PROGRESS · CANCEL LOCKED
          </span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2.5 PROCEED TO PAYMENT & SETTLEMENT ACTION (SRS FR-C18)         */}
      {/* Visible when service work is completed by partner              */}
      {/* ============================================================== */}
      {currentStep === 5 && !paymentConfirmed && (
        <div className="p-5 sm:p-6 bg-paper border-2 border-signal shadow-hard space-y-3 text-ink">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-3">
            <span className="font-mono text-xs text-signal font-bold uppercase tracking-wider">
              SERVICE COMPLETED · ACTION REQUIRED
            </span>
            <span className="stamp-badge bg-signal text-ink border-ink text-[11px]">
              STEP 5 OF 6
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h3 className="font-display font-extrabold text-xl text-ink">
                Work Finished by {partner.name || 'Partner'}
              </h3>
              <p className="font-mono text-xs text-soft mt-1 max-w-lg">
                The partner has completed all repair work and inspections. Please proceed to payment to settle directly on-site (Cash or UPI).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="btn-primary min-h-[46px] px-8 text-sm uppercase font-mono font-bold tracking-wider shadow-hard shrink-0"
            >
              PROCEED TO PAYMENT →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2.6 PAYMENT CONFIRMATION BANNER                                 */}
      {/* Visible once customer or partner confirms payment settlement   */}
      {/* ============================================================== */}
      {(currentStep >= 6 || paymentConfirmed) && (
        <div className="p-5 sm:p-6 bg-paper border-2 border-done shadow-hard space-y-3 text-ink">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-3">
            <span className="font-mono text-xs text-done font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-done inline-block" />
              PAYMENT CONFIRMATION
            </span>
            <span className="stamp-badge bg-done text-paper border-done text-[11px]">
              ✓ STEP 6 COMPLETE
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-done text-paper font-bold text-xs flex items-center justify-center rounded-full">✓</span>
                <h3 className="font-display font-extrabold text-xl text-ink">
                  Payment Confirmed
                </h3>
              </div>
              <p className="font-mono text-xs text-soft mt-1 max-w-lg">
                Your direct payment with {partner.name || 'Partner'} has been confirmed. Work order is successfully closed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('rate-receipt')}
              className="btn-primary min-h-[46px] px-6 text-xs uppercase font-mono font-bold tracking-wider shadow-hard shrink-0"
            >
              RATE PARTNER &amp; VIEW RECEIPT →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. CUSTOMER COPY WORK-ORDER TICKET (DESIGN.md Section 6)        */}
      {/* ============================================================== */}
      <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-paper border-2 border-ink inline-block" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink">
              CUSTOMER COPY · No. {String(activeRequest?.order_number || '0427').replace('ORD-', '')}
            </span>
          </div>

          <span className="stamp-badge bg-concrete text-ink border-ink text-[10px]">
            DIRECT ON-SITE SETTLEMENT
          </span>
        </div>

        {/* Partner Details Card */}
        <div className="p-4 bg-concrete border-2 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-signal border-2 border-ink flex items-center justify-center shrink-0 font-display font-black text-xl text-ink">
              {partnerInitial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl text-ink">{partner.name || 'Partner'}</span>
                <span className="stamp-badge bg-paper text-ink border-ink text-[10px] py-0 px-1.5">
                  KYC VERIFIED
                </span>
              </div>
              <p className="text-xs text-soft font-mono mt-0.5">
                {partner.badge || partner.service_name || 'Certified Fixer'} · ★ {partner.rating || '4.9'}
              </p>
              <p className="text-xs text-muted font-mono">{partner.vehicle || 'Service Vehicle'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <a
              href={partner.phone ? `tel:${partner.phone}` : '#'}
              className="btn-secondary py-1.5 px-3 text-xs min-h-[38px] flex items-center gap-2 bg-paper"
            >
              <span>CALL FIXER</span>
              <span className="font-bold">{partner.phone || '+91 98450 11223'}</span>
            </a>
          </div>
        </div>

        {/* Dashed Tear Line */}
        <div className="tear-line my-4" />

        {/* ============================================================ */}
        {/* THE SIX STATUS STEP TICKS (SRS FR-C14 & DESIGN.md Section 6)  */}
        {/* ============================================================ */}
        <div className="space-y-4" aria-live="polite">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-soft block">
            LIVE JOB PROGRESSION (6 STEPS)
          </span>

          <div className="space-y-3">
            {steps.map((st) => {
              const isCompleted = currentStep >= st.id;
              const isCurrent = currentStep === st.id;

              return (
                <div
                  key={st.id}
                  className={`flex items-start gap-4 p-3 border-2 transition-all ${
                    isCurrent
                      ? 'bg-paper border-ink shadow-hard-sm'
                      : isCompleted
                      ? 'bg-concrete/60 border-ink/40'
                      : 'bg-transparent border-dashed border-ink/30 opacity-60'
                  }`}
                >
                  {/* 22px circle tick mark with stamp-in animation */}
                  <div className="shrink-0 mt-0.5">
                    {isCompleted ? (
                      <span
                        key={`tick-${st.id}-${isCompleted}`}
                        className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center animate-stamp-in shadow-sm"
                      >
                        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                          <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                        </svg>
                      </span>
                    ) : (
                      <span
                        key={`untick-${st.id}`}
                        className="w-[22px] h-[22px] rounded-full border-2 border-muted flex items-center justify-center bg-transparent"
                      />
                    )}
                  </div>

                  {/* Step Title & Detail */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-display font-extrabold text-base sm:text-lg leading-tight ${
                          isCompleted ? 'text-ink' : 'text-muted'
                        }`}
                      >
                        {st.title}
                      </span>
                      {isCurrent && (
                        <span className="font-mono text-[10px] font-bold uppercase bg-signal text-ink px-1.5 py-0.2 shrink-0">
                          NOW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-soft font-mono mt-0.5">{st.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ticket Bottom Actions */}
        <div className="pt-4 border-t-2 border-dashed border-ink flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Cancel button (allowed before service starts, per FR-C19) */}
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="text-xs font-mono font-bold uppercase underline text-soft hover:text-signal"
            >
              ✕ Cancel Request
            </button>
          ) : (
            <span className="font-mono text-xs text-muted uppercase">
              JOB IN PROGRESS · CANCEL LOCKED
            </span>
          )}

          {/* Action to proceed when work is complete */}
          {currentStep === 5 && !paymentConfirmed ? (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="btn-primary min-h-[44px] w-full sm:w-auto px-6 font-mono text-xs font-bold uppercase tracking-wider"
            >
              PROCEED TO PAYMENT →
            </button>
          ) : currentStep >= 6 || paymentConfirmed ? (
            <button
              type="button"
              onClick={() => onNavigate('rate-receipt')}
              className="btn-primary min-h-[44px] w-full sm:w-auto px-6 font-mono text-xs font-bold uppercase tracking-wider"
            >
              RATE PARTNER &amp; VIEW DIGITAL RECEIPT →
            </button>
          ) : (
            <span className="font-mono text-xs font-bold text-soft uppercase">
              WAITING FOR PARTNER STATUS UPDATES...
            </span>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* CANCELLATION MODAL (SRS FR-C19)                                */}
      {/* ============================================================== */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink p-6 max-w-md w-full shadow-hard text-ink space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <span className="font-mono text-xs font-bold uppercase text-signal">
                CANCEL WORK ORDER
              </span>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-soft">
              Are you sure you want to cancel this booking? The nearest partner has already been
              dispatched.
            </p>

            <div className="space-y-1.5">
              <label className="block font-mono text-xs font-bold uppercase">
                Select Reason for Cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-sm"
              >
                <option value="Found another solution">Found another solution</option>
                <option value="Partner taking too long">Partner taking too long to arrive</option>
                <option value="Booked by mistake">Booked by mistake</option>
                <option value="Issue resolved itself">Issue resolved itself</option>
                <option value="Other emergency">Other emergency</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="btn-primary flex-1 min-h-[44px]"
              >
                Confirm Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="btn-secondary flex-1 min-h-[44px]"
              >
                Keep Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SERVICE VERIFICATION OTP POPUP MODAL (SRS FR-C16)           */}
      {/* Pops up when partner arrives or clicks verify & start service  */}
      {/* ============================================================== */}
      {showOtpModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-lg w-full shadow-hard text-ink space-y-6 relative">
            <div className="flex items-center justify-between border-b-2 border-ink pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-signal inline-block border-2 border-ink" />
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
                  DOORSTEP VERIFICATION · FIXIT NOW
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="font-bold text-lg hover:text-signal transition-colors p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-2">
              <div className="stamp-badge bg-signal text-ink border-ink text-xs inline-block">
                PARTNER ARRIVED · ACTION REQUIRED
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-ink">
                Share this OTP with {partner.name || 'Partner'}
              </h2>
              <p className="text-sm text-soft font-sans max-w-md mx-auto">
                Your partner has arrived at your doorstep to begin service. Please provide this 6-digit verification code to start the repair work.
              </p>
            </div>

            {/* Giant Monospace 6-Digit OTP Box */}
            <div className="bg-ink text-signal border-2 border-ink p-6 shadow-hard-signal text-center space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-on-dark block">
                6-DIGIT VERIFICATION CODE
              </span>
              <div className="font-mono text-4xl sm:text-6xl font-black tracking-[0.25em] sm:tracking-[0.35em] text-signal select-all py-1">
                {activeRequest?.service_otp || '256132'}
              </div>
              <span className="font-mono text-[11px] text-on-dark block">
                The partner enters this code on their terminal to verify and start work
              </span>
            </div>

            <div className="p-3.5 bg-concrete border-2 border-ink text-xs text-soft font-mono space-y-1">
              <div>• ORDER REF: <span className="font-bold text-ink">{activeRequest?.order_number || 'ORD-0428'}</span></div>
              <div>• PARTNER: <span className="font-bold text-ink">{partner.name || 'Partner'}</span> ({partner.vehicle || 'Service Vehicle'})</div>
              <div>• DIRECT PAYMENT: Cash or UPI settled directly between you and partner after work is complete.</div>
            </div>

            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="btn-primary w-full min-h-[48px] uppercase font-mono tracking-wider text-sm font-bold shadow-hard"
            >
              I have shared the code with partner →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. PROCEED TO PAYMENT MODAL (SRS FR-C18)                       */}
      {/* Allows customer to select payment method and confirm settlement */}
      {/* ============================================================== */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-lg w-full shadow-hard text-ink space-y-6 relative">
            <div className="flex items-center justify-between border-b-2 border-ink pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-signal inline-block border-2 border-ink" />
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
                  DIRECT ON-SITE PAYMENT · FIXIT NOW
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="font-bold text-lg hover:text-signal transition-colors p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-2">
              <div className="stamp-badge bg-signal text-ink border-ink text-xs inline-block">
                STEP 5: SERVICE COMPLETED
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-ink">
                Settle with {partner.name || 'Partner'}
              </h2>
              <p className="text-sm text-soft font-sans max-w-md mx-auto">
                Payment is settled directly between you and your service partner. FixIt Now does not deduct commission or hold your funds.
              </p>
            </div>

            {/* Work order summary */}
            <div className="p-4 bg-concrete border-2 border-ink font-mono text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted uppercase">WORK ORDER:</span>
                <span className="font-bold text-ink">{activeRequest?.order_number || 'ORD-0428'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted uppercase">SERVICE:</span>
                <span className="font-bold text-ink">{activeRequest?.service_name || 'Home Repair'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted uppercase">FIXER:</span>
                <span className="font-bold text-ink">{partner.name || 'Partner'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-ink/20 pt-2">
                <span className="text-muted uppercase">SETTLEMENT:</span>
                <span className="font-bold text-signal uppercase">Direct On-Site Settle</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold uppercase text-ink block">
                Select Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3.5 border-2 font-mono text-xs font-bold uppercase flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-signal text-ink border-ink shadow-hard-sm'
                      : 'bg-paper text-ink border-ink/40 hover:border-ink'
                  }`}
                >
                  <span className="text-xl">💵</span>
                  <span>Cash on Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3.5 border-2 font-mono text-xs font-bold uppercase flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'upi'
                      ? 'bg-signal text-ink border-ink shadow-hard-sm'
                      : 'bg-paper text-ink border-ink/40 hover:border-ink'
                  }`}
                >
                  <span className="text-xl">📱</span>
                  <span>UPI / QR Code</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPaymentConfirmed(true);
                setCurrentStep(6);
                setShowPaymentModal(false);
              }}
              className="btn-primary w-full min-h-[50px] uppercase font-mono tracking-wider text-sm font-bold shadow-hard"
            >
              Confirm Payment Completed ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
