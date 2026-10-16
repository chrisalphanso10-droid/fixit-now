/**
 * FixIt Now - Live Tracking Screen
 * Highlight of the product: Custom SVG map with animated partner movement & countdown ETA,
 * Work-order ticket with the six status step ticks stamping in on timer.
 * Conforms to SRS FR-C14, FR-C15, FR-C16, FR-T1, FR-T2 and docs/DESIGN.md Section 6.
 */

import { useState, useEffect } from 'react';
import { updateTrackingStep, cancelServiceRequest } from '../../services/requestService';

export default function LiveTrackingView({
  activeRequest,
  onNavigate,
  onCancel,
}) {
  // Step index: 1 to 6
  // 1: Request accepted
  // 2: Partner on the way
  // 3: Partner arrived
  // 4: Service started
  // 5: Service completed
  // 6: Payment completed
  const [currentStep, setCurrentStep] = useState(activeRequest?.step_index || 1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x
  const [etaMinutes, setEtaMinutes] = useState(14);
  const [partnerProgress, setPartnerProgress] = useState(0); // 0 (start) to 1 (arrived)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Found another solution');

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
    const totalSegments = waypoints.length - 1;
    const scaled = Math.max(0, Math.min(1, progress)) * totalSegments;
    const segIndex = Math.min(Math.floor(scaled), totalSegments - 1);
    const segT = scaled - segIndex;

    const p1 = waypoints[segIndex];
    const p2 = waypoints[segIndex + 1];

    return {
      x: p1.x + (p2.x - p1.x) * segT,
      y: p1.y + (p2.y - p1.y) * segT,
    };
  };

  const partnerPos = getPartnerCoords(partnerProgress);

  // Timer simulation to advance steps and partner movement
  useEffect(() => {
    if (!isPlaying) return;

    const stepIntervalDuration = (6000 / speed); // base: 6s per step at 1x
    const tickIntervalMs = 100;
    const progressIncrement = 1 / (stepIntervalDuration / tickIntervalMs);

    const interval = setInterval(() => {
      // Step 2 specifically simulates travelling movement
      if (currentStep === 2) {
        setPartnerProgress((prev) => {
          const next = prev + progressIncrement;
          if (next >= 1) {
            // Arrived at customer location
            setCurrentStep(3);
            updateTrackingStep(3);
            setEtaMinutes(0);
            return 1;
          }
          const remainingMinutes = Math.max(1, Math.round(14 * (1 - next)));
          setEtaMinutes(remainingMinutes);
          return next;
        });
      } else if (currentStep === 1) {
        // Automatically transition to step 2 after brief delay
        setTimeout(() => {
          setCurrentStep(2);
          updateTrackingStep(2);
        }, 1500 / speed);
      } else if (currentStep < 6) {
        // Automatically advance remaining steps
        setCurrentStep((prev) => {
          const next = prev + 1;
          updateTrackingStep(next);
          return next;
        });
      }
    }, stepIntervalDuration);

    return () => clearInterval(interval);
  }, [currentStep, isPlaying, speed]);

  const handleStepClick = (stepId) => {
    setCurrentStep(stepId);
    updateTrackingStep(stepId);
    if (stepId <= 1) {
      setPartnerProgress(0);
      setEtaMinutes(14);
    } else if (stepId === 2) {
      setPartnerProgress(0.5);
      setEtaMinutes(7);
    } else {
      setPartnerProgress(1);
      setEtaMinutes(0);
    }
  };

  const handleCancelSubmit = async () => {
    if (activeRequest) {
      await cancelServiceRequest(activeRequest.id, cancelReason);
    }
    setShowCancelModal(false);
    if (onCancel) onCancel();
    onNavigate('dashboard');
  };

  const partner = activeRequest?.partner || {
    name: 'Rajesh Kumar',
    phone: '+91 98450 11223',
    rating: 4.9,
    service_name: activeRequest?.service_name || 'Plumbing Repairs',
    badge: 'Certified Master Plumber',
    vehicle: 'Bajaj Pulsar (KA-03-HJ-4421)',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

        {/* Map Telemetry Controls & Speed Adjustment */}
        <div className="p-3 bg-[var(--theme-surface)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2.5 py-1 border border-[var(--theme-border)] bg-[var(--theme-surface-sub)] font-bold uppercase hover:bg-signal hover:text-ink"
            >
              {isPlaying ? '⏸ Pause Timer' : '▶ Resume Timer'}
            </button>
            <div className="flex items-center gap-1 border border-[var(--theme-border)] p-0.5">
              {[1, 2, 4].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 font-bold ${
                    speed === s ? 'bg-signal text-ink' : 'text-[var(--theme-text-muted)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[var(--theme-text-muted)] text-[11px] uppercase mr-1">
              MANUAL STEP:
            </span>
            {[1, 2, 3, 4, 5, 6].map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => handleStepClick(st)}
                className={`w-6 h-6 border text-center font-bold ${
                  currentStep === st
                    ? 'bg-signal text-ink border-ink'
                    : currentStep > st
                    ? 'bg-done text-paper border-done'
                    : 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                }`}
                title={`Jump to step ${st}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CUSTOMER COPY WORK-ORDER TICKET (DESIGN.md Section 6)        */}
      {/* ============================================================== */}
      <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-paper border-2 border-ink inline-block" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink">
              CUSTOMER COPY · No. {activeRequest?.order_number?.replace('ORD-', '') || '0427'}
            </span>
          </div>

          {/* Service OTP Badge (SRS FR-C16: confirmed before service starts) */}
          <div className="flex items-center gap-2 p-1.5 px-3 bg-concrete border-2 border-ink">
            <span className="font-mono text-xs text-soft font-bold uppercase">SERVICE OTP:</span>
            <span className="font-mono text-base font-extrabold text-signal tracking-widest">
              {activeRequest?.service_otp || '8392'}
            </span>
          </div>
        </div>

        {/* Partner Details Card */}
        <div className="p-4 bg-concrete border-2 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-signal border-2 border-ink flex items-center justify-center shrink-0 font-display font-black text-xl text-ink">
              {partner.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl text-ink">{partner.name}</span>
                <span className="stamp-badge bg-paper text-ink border-ink text-[10px] py-0 px-1.5">
                  KYC VERIFIED
                </span>
              </div>
              <p className="text-xs text-soft font-mono mt-0.5">
                {partner.badge || partner.service_name} · ★ {partner.rating || '4.9'}
              </p>
              <p className="text-xs text-muted font-mono">{partner.vehicle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <a
              href={`tel:${partner.phone}`}
              className="btn-secondary py-1.5 px-3 text-xs min-h-[38px] flex items-center gap-2 bg-paper"
            >
              <span>CALL FIXER</span>
              <span className="font-bold">{partner.phone}</span>
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
                      <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center animate-stamp-in shadow-sm">
                        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                          <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                        </svg>
                      </span>
                    ) : (
                      <span className="w-[22px] h-[22px] rounded-full border-2 border-muted flex items-center justify-center bg-transparent" />
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
          {currentStep >= 5 ? (
            <button
              type="button"
              onClick={() => onNavigate('rate-receipt')}
              className="btn-primary min-h-[44px] w-full sm:w-auto"
            >
              Rate Partner &amp; View Digital Receipt →
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
    </div>
  );
}
