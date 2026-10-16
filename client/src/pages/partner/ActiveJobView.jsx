/**
 * FixIt Now - Partner Active Job Screen
 * Single next-action button sequence:
 * Start trip → Arrived at customer location → Enter service OTP & Start service → Complete service → Payment received & Close.
 * Conforms to docs/DESIGN.md line 90 and SRS FR-P9, FR-P10, FR-P12.
 */

import { useState } from 'react';
import {
  advanceJobStep,
  simulateCustomerCancel,
} from '../../services/partnerService';

export default function ActiveJobView({
  activeJob,
  onJobUpdated,
  onJobClosed,
  onNavigateToDashboard,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [settlementReceipt, setSettlementReceipt] = useState(null);
  const [cancellationAlert, setCancellationAlert] = useState(null);

  if (!activeJob) {
    return (
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-8 sm:p-12 text-center shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="w-12 h-12 bg-concrete border-2 border-[var(--theme-border)] mx-auto flex items-center justify-center font-bold text-xl mb-3 text-[var(--theme-text-main)]">
          0
        </div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--theme-text-main)]">
          No Active Work Order In Progress
        </h2>
        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] max-w-md mx-auto mt-2 mb-6">
          Your dispatch radar is active. When a customer in your 2 km zone requests a fix, an incoming work order will appear immediately.
        </p>
        <button
          type="button"
          onClick={onNavigateToDashboard}
          className="btn-primary min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
        >
          RETURN TO DISPATCH RADAR →
        </button>
      </div>
    );
  }

  const currentStatus = activeJob.status || 'accepted'; // 'accepted' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed'

  // Progression steps ladder
  const statusLadder = [
    { key: 'accepted', label: 'Accepted', num: '1' },
    { key: 'on_the_way', label: 'En Route', num: '2' },
    { key: 'arrived', label: 'Arrived', num: '3' },
    { key: 'in_progress', label: 'Working', num: '4' },
    { key: 'completed', label: 'Done', num: '5' },
  ];

  const currentStepIndex =
    currentStatus === 'accepted'
      ? 1
      : currentStatus === 'on_the_way'
      ? 2
      : currentStatus === 'arrived'
      ? 3
      : currentStatus === 'in_progress'
      ? 4
      : 5;

  // Next-action execution
  const handleNextAction = async () => {
    setError(null);

    // If at 'arrived', partner must enter service OTP provided by customer (SRS FR-P10)
    if (currentStatus === 'arrived') {
      setOtpModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      const result = await advanceJobStep(activeJob.id, currentStatus);
      if (result.status === 'paid') {
        setSettlementReceipt(result.settlement);
        if (onJobClosed) onJobClosed(result.settlement);
      } else {
        if (onJobUpdated) onJobUpdated(result);
      }
    } catch (err) {
      setError(`! ${err.message || 'Failed to update work order status.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Service OTP verification (SRS FR-P10, FR-T2)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await advanceJobStep(activeJob.id, 'arrived', otpInput);
      setOtpModalOpen(false);
      setOtpInput('');
      if (onJobUpdated) onJobUpdated(result);
    } catch (err) {
      setError(`! ${err.message || 'OTP verification failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Simulate Customer Cancellation (SRS FR-C19, FR-T3)
  const handleSimulateCancel = async () => {
    setLoading(true);
    try {
      const result = await simulateCustomerCancel(activeJob.id);
      setCancellationAlert(result);
      setTimeout(() => {
        if (onJobClosed) onJobClosed(null);
      }, 1500);
    } catch (err) {
      setError(`! ${err.message || 'Cancellation simulation failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Order Stamp */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-signal inline-block animate-pulse" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                ACTIVE WORK ORDER DISPATCH
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              {activeJob.order_number || 'ORD-0428'} · {activeJob.service_name || 'Service Call'}
            </h1>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="border-2 border-ink bg-signal text-ink px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm">
              LIVE DISPATCH
            </span>
          </div>
        </div>

        {/* 5-Step Status Ladder */}
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-cols-5 min-w-[320px] sm:min-w-0 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] p-1 gap-1 font-mono text-center">
            {statusLadder.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = stepNum < currentStepIndex;
              const isCurrent = stepNum === currentStepIndex;

              return (
                <div
                  key={step.key}
                  className={`py-1.5 sm:py-2 px-0.5 sm:px-1 text-[9px] sm:text-xs font-bold uppercase transition-colors truncate ${
                    isCurrent
                      ? 'bg-signal text-ink shadow-hard-sm'
                      : isCompleted
                      ? 'bg-done text-paper'
                      : 'text-[var(--theme-text-muted)]'
                  }`}
                  title={`${step.num}. ${step.label}`}
                >
                  <div className="block sm:inline mr-0.5 sm:mr-1">{isCompleted ? '✓' : `${step.num}.`}</div>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error or Alert Notice */}
      {error && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          {error}
        </div>
      )}

      {cancellationAlert && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-4 font-mono text-xs font-bold shadow-hard-sm space-y-1"
        >
          <div className="text-signal uppercase tracking-wider">! WORK ORDER CANCELLED</div>
          <div>{cancellationAlert.reason}</div>
          <div className="text-muted text-[11px]">{cancellationAlert.message}</div>
        </div>
      )}

      {/* Customer & Job Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Contact & Address Card */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard space-y-4"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-soft)]">
              CUSTOMER &amp; SITE ADDRESS
            </span>
            <span className="font-mono text-[11px] font-bold text-done">
              0.8 KM AWAY
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-[var(--theme-text-soft)] block text-[10px]">CUSTOMER NAME:</span>
              <span className="font-display font-bold text-lg text-[var(--theme-text-main)]">
                {activeJob.customer_name || 'Pooja Hegde'}
              </span>
            </div>

            <div>
              <span className="text-[var(--theme-text-soft)] block text-[10px]">PHONE CONTACT:</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-bold text-sm text-[var(--theme-text-main)]">
                  {activeJob.customer_phone || '+91 98860 33412'}
                </span>
                <a
                  href={`tel:${activeJob.customer_phone || '+919886033412'}`}
                  className="px-2.5 py-1 border border-ink bg-concrete hover:bg-signal font-bold text-[10px] uppercase text-ink"
                >
                  CALL CUSTOMER
                </a>
              </div>
            </div>

            <div>
              <span className="text-[var(--theme-text-soft)] block text-[10px]">SERVICE LOCATION:</span>
              <div className="p-2.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] mt-1 font-sans text-xs text-[var(--theme-text-main)] font-medium leading-relaxed">
                {activeJob.address || '84, 10th Cross, Indiranagar, Bengaluru'}
              </div>
            </div>
          </div>
        </div>

        {/* Issue Description & Payment Card */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard space-y-4"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-soft)]">
              WORK ORDER SPECIFICATION
            </span>
            <span className="border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-0.5 font-mono text-[10px] font-bold">
              100% DIRECT SETTLEMENT
            </span>
          </div>

          <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-1.5">
            <span className="font-mono text-[10px] text-[var(--theme-text-soft)] uppercase block">
              REPORTED ISSUE:
            </span>
            <p className="font-sans text-sm text-[var(--theme-text-main)] leading-relaxed font-medium">
              &ldquo;{activeJob.problem || 'Drainage pipe backing up into sink cabinet'}&rdquo;
            </p>
          </div>

          <div className="p-3 bg-concrete border border-ink font-mono text-xs text-ink space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold">SERVICE OTP:</span>
              <span className="font-bold text-signal px-2 py-0.5 bg-paper border border-ink">
                {currentStatus === 'arrived' ? 'REQUEST FROM CUSTOMER (HINT: 8392)' : 'PROTECTED UNTIL ARRIVAL'}
              </span>
            </div>
            <div className="text-[11px] text-muted leading-relaxed">
              Customer gives you the 4-digit OTP upon arrival to verify physical presence before opening tools.
            </div>
          </div>

          {/* Test Cancellation Trigger */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSimulateCancel}
              disabled={loading}
              className="text-[11px] font-mono text-[var(--theme-text-muted)] hover:text-signal underline"
            >
              Simulate Customer Cancellation (Testing SRS FR-C19)
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* THE SINGLE PRIMARY NEXT-ACTION BUTTON (DESIGN.md line 90)      */}
      {/* ============================================================== */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs text-[var(--theme-text-soft)] uppercase block mb-1">
              NEXT WORK ORDER ACTION:
            </span>
            <div className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
              {currentStatus === 'accepted' && 'Step 1: Commencing Journey to Customer Site'}
              {currentStatus === 'on_the_way' && 'Step 2: Reached Customer Doorstep'}
              {currentStatus === 'arrived' && 'Step 3: Verify 4-Digit Service OTP to Start Work'}
              {currentStatus === 'in_progress' && 'Step 4: Repair Work in Progress'}
              {currentStatus === 'completed' && 'Step 5: Direct On-Site Settlement & Payout'}
            </div>
          </div>

          {/* THE SINGLE BUTTON */}
          <div className="shrink-0 w-full sm:w-auto">
            {currentStatus === 'accepted' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextAction}
                className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm uppercase tracking-wider font-bold shadow-hard"
              >
                {loading ? 'STARTING...' : 'START TRIP →'}
              </button>
            )}

            {currentStatus === 'on_the_way' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextAction}
                className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm uppercase tracking-wider font-bold shadow-hard"
              >
                {loading ? 'RECORDING ARRIVAL...' : 'ARRIVED AT CUSTOMER LOCATION →'}
              </button>
            )}

            {currentStatus === 'arrived' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setOtpModalOpen(true)}
                className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm uppercase tracking-wider font-bold shadow-hard"
              >
                ENTER SERVICE OTP &amp; START SERVICE →
              </button>
            )}

            {currentStatus === 'in_progress' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextAction}
                className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm uppercase tracking-wider font-bold shadow-hard"
              >
                {loading ? 'RECORDING COMPLETION...' : 'COMPLETE SERVICE WORK →'}
              </button>
            )}

            {currentStatus === 'completed' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextAction}
                className="w-full sm:w-auto min-h-[48px] px-8 border-2 border-ink bg-done text-paper font-mono text-sm uppercase tracking-wider font-bold shadow-hard hover:opacity-95"
              >
                {loading ? 'CONFIRMING SETTLEMENT...' : 'PAYMENT RECEIVED & CLOSE JOB →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SERVICE OTP INPUT MODAL (Step 3: Arrived -> In Progress)        */}
      {/* ============================================================== */}
      {otpModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-7 max-w-md w-full shadow-hard relative text-ink font-mono"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-signal">
                SERVICE COMMENCEMENT VERIFICATION
              </span>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="w-7 h-7 border border-ink bg-concrete font-bold text-ink hover:bg-signal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h3 className="font-display font-extrabold text-2xl text-ink">
                  Enter 4-Digit Service OTP
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Ask customer <strong>{activeJob.customer_name}</strong> for the 4-digit code shown on their tracking screen to authenticate arrival.
                </p>
              </div>

              {/* Demo Hint Banner */}
              <div className="p-3 bg-concrete border border-ink text-xs">
                <span className="font-bold text-signal block mb-0.5">SAMPLE DATA HINT:</span>
                The service OTP for this demo work order is <span className="font-bold text-ink text-sm">8392</span>.
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="8392"
                  className="w-full min-h-[48px] px-4 border-2 border-ink bg-paper text-ink font-mono text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-signal"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider"
                >
                  {loading ? 'AUTHENTICATING CODE...' : 'START SERVICE WORK NOW →'}
                </button>
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="btn-secondary w-full sm:w-1/3 min-h-[48px] font-bold text-xs uppercase"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FINAL SETTLEMENT RECEIPT MODAL (Step 5: Paid)                   */}
      {/* ============================================================== */}
      {settlementReceipt && (
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
              <span className="text-xs font-bold uppercase tracking-widest text-done">
                JOB COMPLETED &amp; SETTLED
              </span>
              <span className="px-2 py-0.5 border border-done bg-done text-paper text-[10px] font-bold uppercase">
                DIRECT SETTLEMENT
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-display font-extrabold text-2xl text-ink">
                  Work Order Closed Successfully!
                </h3>
                <p className="text-muted mt-1">
                  Settlement ref: <span className="font-bold text-ink">{settlementReceipt.order_number}</span>
                </p>
              </div>

              <div className="p-4 bg-concrete border border-ink space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">SERVICE CATEGORY:</span>
                  <span className="font-bold text-ink">{settlementReceipt.service_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">CUSTOMER:</span>
                  <span className="font-bold text-ink">{settlementReceipt.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">PAYMENT MODE:</span>
                  <span className="font-bold text-ink">{settlementReceipt.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">PLATFORM COMMISSION:</span>
                  <span className="font-bold text-done">₹0.00 (0% Flat-Rate)</span>
                </div>
                <div className="border-t border-ink/20 pt-2 flex justify-between text-base font-bold">
                  <span>AMOUNT KEPT BY PARTNER:</span>
                  <span className="text-done">₹{settlementReceipt.amount?.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                This transaction has been added to your earnings ledger. You are now free and available on the dispatch radar for the next booking.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSettlementReceipt(null);
                  onNavigateToDashboard();
                }}
                className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider"
              >
                RETURN TO LIVE RADAR →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
