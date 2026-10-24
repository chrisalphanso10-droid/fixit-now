/**
 * FixIt Now - Partner Incoming Request Popup
 * 30-second circular countdown ring, request details, large Accept / Decline buttons.
 * Conforms to docs/DESIGN.md line 88 and SRS FR-P9, FR-P10.
 */

import { useState, useEffect } from 'react';

export default function IncomingRequestPopup({
  job,
  onAccept,
  onDecline,
}) {
  const [secondsLeft, setSecondsLeft] = useState(job?.countdown || 30);
  const totalSeconds = job?.countdown || 30;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notice = job?.notice;

  useEffect(() => {
    if (notice) {
      const dismissTimer = setTimeout(() => {
        if (onDecline) onDecline('NOTICE_DISMISSED');
      }, 3000);
      return () => clearTimeout(dismissTimer);
    }
  }, [notice, onDecline]);

  useEffect(() => {
    if (notice) return;
    if (secondsLeft <= 0) {
      if (onDecline) onDecline('TIMEOUT_EXPIRED');
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onDecline, notice]);

  // SVG circular ring calculations (radius = 34, circumference = 2 * PI * 34 ≈ 213.6)
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secondsLeft / totalSeconds) * circumference;

  const orderNum = job?.order_number || 'ORD-0428';
  const customerName = job?.customer_name || 'Pooja Hegde';
  const serviceName = job?.service_name || 'Plumbing Repairs';
  const problem = job?.problem || 'Kitchen sink drainage choked and water backing up';
  const address = job?.address || '84, 10th Cross, Indiranagar, Bengaluru';
  const distance = job?.distance_km || 0.8;
  const etaMinutes = job?.eta_minutes || 14;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-paper border-2 border-ink max-w-md w-full p-5 sm:p-7 shadow-hard text-ink font-mono relative"
        style={{ borderRadius: 0 }}
      >
        {/* Urgent Header Banner */}
        <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-signal inline-block animate-ping" />
            <span className="text-xs font-bold uppercase tracking-widest text-signal">
              INCOMING DISPATCH CALL
            </span>
          </div>
          <span className="border border-ink bg-concrete text-ink px-2 py-0.5 text-[11px] font-bold">
            {orderNum}
          </span>
        </div>

        {notice ? (
          /* Notice View: e.g. "Request accepted by another partner" */
          <div className="p-5 bg-concrete border-2 border-ink space-y-2 text-center my-4">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 bg-signal inline-block" />
              <span className="text-xs font-bold uppercase tracking-wider text-signal font-mono">
                DISPATCH NOTICE
              </span>
            </div>
            <div className="font-display font-extrabold text-base text-ink">
              {notice}
            </div>
            <p className="text-xs text-muted font-mono">
              Dismissing popup... You remain online.
            </p>
          </div>
        ) : (
          <>
            {/* Center Countdown Ring & ETA */}
            <div className="flex items-center justify-between py-2 border-b border-ink/20 mb-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted block uppercase tracking-wider">
                  AUTO-RELEASE TIMER:
                </span>
                <div className="font-display font-extrabold text-2xl text-ink">
                  {secondsLeft}s <span className="font-mono text-xs text-signal font-bold">REMAINING</span>
                </div>
                <div className="text-[11px] text-muted">
                  {distance} km away · ~{etaMinutes} min ride
                </div>
              </div>

              {/* Circular Countdown Ring */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  {/* Background ring */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="#E2DCD5"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  {/* Active countdown stroke */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="#FF5B14"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="absolute font-display font-black text-xl text-ink">
                  {secondsLeft}
                </span>
              </div>
            </div>

            {/* Request Details Box */}
            <div className="space-y-3 mb-6">
              <div className="p-3 bg-concrete border border-ink space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-sm font-sans">{serviceName}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-ink text-paper">
                    ON-SITE SETTLEMENT
                  </span>
                </div>
                <p className="text-xs text-ink/90 font-sans leading-relaxed">
                  &ldquo;{problem}&rdquo;
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-1.5">
                  <span className="text-muted shrink-0">CUSTOMER:</span>
                  <span className="font-bold text-ink">{customerName}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted shrink-0">LOCATION:</span>
                  <span className="font-bold text-ink">{address}</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-muted shrink-0">CUSTOMER PAYOUT:</span>
                  <span className="font-bold text-done">Direct Cash / UPI from Customer</span>
                </div>
              </div>
            </div>

            {/* Big Action Buttons (Min 48px height per DESIGN.md Section 5) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true);
                  await onAccept(job);
                  setIsSubmitting(false);
                }}
                className="w-full sm:w-2/3 min-h-[48px] border-2 border-ink bg-signal text-ink font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm hover:opacity-95 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? 'ACCEPTING...' : '✓ ACCEPT WORK ORDER'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onDecline('PARTNER_DECLINED')}
                className="w-full sm:w-1/3 min-h-[48px] border-2 border-ink bg-concrete text-ink font-mono text-xs font-bold uppercase tracking-wider hover:bg-paper active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center disabled:opacity-50"
              >
                <span>✕ DECLINE</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
