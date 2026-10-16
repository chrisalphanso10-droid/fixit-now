/**
 * FixIt Now - Partner Dashboard Screen
 * Dual Modes: Verified Version (Live Dispatch Radar, Proximity Radius, Stats, Test Triggers)
 * vs Not-Verified Version (KYC Verification Warning Banner, Onboarding Checklist, Locked Radar).
 * Conforms to docs/DESIGN.md and SRS Section 3.3, FR-P7, FR-P8.
 */

import { useState } from 'react';

export default function PartnerDashboard({
  partner,
  subscription,
  dashboardData,
  online = true,
  onToggleOnline,
  onSimulateIncomingRequest,
  activeJob = null,
  onNavigate,
}) {
  const [radarZoom, setRadarZoom] = useState('2.0'); // 2.0 km standard radius per SRS FR-P8

  const isKycVerified = partner?.kyc_status === 'verified';
  const isKycRejected = partner?.kyc_status === 'rejected';
  const daysRemaining = subscription?.days_remaining ?? 108;
  const isExpired = subscription?.status === 'expired' || daysRemaining <= 0;

  const todayJobs = dashboardData?.today_jobs || 2;
  const todayEarnings = dashboardData?.today_earnings || 950.0;
  const rating = partner?.rating || 4.9;

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* TOP SUMMARY BANNER                                             */}
      {/* ============================================================== */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 inline-block ${online && isKycVerified && !isExpired ? 'bg-done animate-pulse' : 'bg-concrete border border-ink'}`} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                {isKycVerified ? 'LIVE DISPATCH RADAR STATION' : 'ONBOARDING & COMPLIANCE GATEWAY'}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Welcome back, {partner?.name || 'Partner'}
            </h1>
            <div className="font-mono text-xs text-[var(--theme-text-soft)] mt-1">
              Certified Trade: <strong className="text-[var(--theme-text-main)]">{partner?.service_name || 'Home Repairs'}</strong> · Base: <span className="text-[var(--theme-text-main)]">{partner?.address?.slice(0, 32)}...</span>
            </div>
          </div>

          {/* Quick Status Stamp */}
          <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
            <span
              className={`border-2 px-3 py-1 font-bold uppercase shadow-hard-sm ${
                !isKycVerified
                  ? isKycRejected
                    ? 'border-signal bg-paper text-ink'
                    : 'border-[var(--theme-border)] bg-concrete text-ink'
                  : isExpired
                  ? 'border-ink bg-ink text-paper'
                  : online
                  ? 'border-done bg-done text-paper'
                  : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-soft)]'
              }`}
            >
              {!isKycVerified
                ? isKycRejected
                  ? '✕ KYC REJECTED'
                  : '⏳ KYC PENDING'
                : isExpired
                ? '✕ PLAN EXPIRED'
                : online
                ? '● ONLINE · 2 KM'
                : '○ OFFLINE'}
            </span>
          </div>
        </div>

        {/* 4 Stat Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
            <span className="text-[var(--theme-text-soft)] text-[10px] block uppercase">TODAY&apos;S JOBS:</span>
            <span className="font-display font-extrabold text-xl sm:text-2xl text-[var(--theme-text-main)] mt-0.5 block">
              {todayJobs}
            </span>
          </div>

          <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
            <span className="text-[var(--theme-text-soft)] text-[10px] block uppercase">TODAY&apos;S EARNINGS:</span>
            <span className="font-display font-extrabold text-xl sm:text-2xl text-done mt-0.5 block">
              ₹{todayEarnings.toFixed(2)}
            </span>
          </div>

          <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
            <span className="text-[var(--theme-text-soft)] text-[10px] block uppercase">OVERALL RATING:</span>
            <span className="font-display font-extrabold text-xl sm:text-2xl text-signal mt-0.5 block">
              {rating.toFixed(1)} ★
            </span>
          </div>

          <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
            <span className="text-[var(--theme-text-soft)] text-[10px] block uppercase">PASS REMAINING:</span>
            <span className={`font-display font-extrabold text-xl sm:text-2xl mt-0.5 block ${isExpired ? 'text-signal' : 'text-[var(--theme-text-main)]'}`}>
              {daysRemaining}d
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VERSION A: NOT-VERIFIED DASHBOARD (KYC Warning & Checklist)    */}
      {/* ============================================================== */}
      {!isKycVerified && (
        <div className="space-y-6">
          {/* Prominent Warning Work-Order Box */}
          <div
            className={`border-3 p-6 sm:p-8 shadow-hard space-y-4 ${
              isKycRejected
                ? 'border-signal bg-paper text-ink'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)]'
            }`}
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-start justify-between border-b-2 border-current pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-signal inline-block" />
                <h2 className="font-display font-extrabold text-xl sm:text-2xl uppercase tracking-tight">
                  {isKycRejected
                    ? 'Compliance Alert: KYC Verification Rejected'
                    : 'Account Verification Pending · Dispatch Radar Locked'}
                </h2>
              </div>
              <span className="border border-current px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                SRS FR-P7 &amp; BR-5
              </span>
            </div>

            <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
              {isKycRejected
                ? `Compliance review detected an issue with your submitted documents: "${partner?.rejection_reason || 'Document scan blurred'}". Please resubmit corrected documents to unlock radar access.`
                : 'Per FixIt Now Trust & Safety rules, partner accounts must complete identity and trade qualification verification before they can toggle online and receive customer dispatches.'}
            </p>

            {/* Onboarding Checklist */}
            <div className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 font-mono text-xs space-y-3">
              <span className="font-bold uppercase tracking-wider block text-[var(--theme-text-main)] border-b border-[var(--theme-border)] pb-2">
                ONBOARDING DISPATCH CHECKLIST:
              </span>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-done font-bold">✓</span>
                  <span>1. Partner Account Registration</span>
                </div>
                <span className="text-done font-bold text-[10px] uppercase">Completed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-done font-bold">✓</span>
                  <span>2. 0% Commission Subscription Plan</span>
                </div>
                <span className="text-done font-bold text-[10px] uppercase">
                  {subscription?.plan_name || 'Half-yearly'} Pass Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={isKycRejected ? 'text-signal font-bold' : 'text-signal font-bold'}>
                    {isKycRejected ? '✕' : '⏳'}
                  </span>
                  <span>3. KYC Document Submission (Govt ID &amp; Trade License)</span>
                </div>
                <span className={`font-bold text-[10px] uppercase ${isKycRejected ? 'text-signal' : 'text-signal'}`}>
                  {isKycRejected ? 'Correction Required' : 'In Review Desk'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-text-muted)] font-bold">○</span>
                  <span>4. Platform Activation &amp; Live Radar Dispatch</span>
                </div>
                <span className="text-[var(--theme-text-muted)] font-bold text-[10px] uppercase">
                  Locked
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onNavigate('kyc')}
                className="btn-primary min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
              >
                {isKycRejected ? 'RESUBMIT CORRECTED KYC DOCUMENTS →' : 'VIEW KYC REVIEW STATUS →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VERSION B: VERIFIED DASHBOARD (Live Dispatch Radar)            */}
      {/* ============================================================== */}
      {isKycVerified && (
        <div className="space-y-6">
          {/* Active Job Alert Card (If job is in progress) */}
          {activeJob && (
            <div
              className="bg-paper border-3 border-signal p-5 sm:p-6 shadow-hard text-ink space-y-3"
              style={{ borderRadius: 0 }}
            >
              <div className="flex items-center justify-between border-b border-ink/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-signal inline-block animate-ping" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                    WORK ORDER IN PROGRESS: {activeJob.order_number}
                  </span>
                </div>
                <span className="border border-ink bg-ink text-paper px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                  STATUS: {activeJob.status?.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                <div>
                  <div className="font-sans font-bold text-base text-ink">
                    {activeJob.service_name} &mdash; &ldquo;{activeJob.problem}&rdquo;
                  </div>
                  <div className="text-muted mt-0.5">
                    Customer: <strong>{activeJob.customer_name}</strong> · {activeJob.address}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('active-job')}
                  className="btn-primary min-h-[44px] px-6 font-mono text-xs font-bold uppercase shadow-hard shrink-0"
                >
                  JUMP TO ACTIVE JOB →
                </button>
              </div>
            </div>
          )}

          {/* Live Dispatch Radar Container */}
          <div
            className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
            style={{ borderRadius: 0 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-soft)] block">
                  PROXIMITY DISPATCH RADAR
                </span>
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[var(--theme-text-main)]">
                  {online && !isExpired
                    ? 'Scanning 2.0 km Zone for Direct Fix Requests'
                    : 'Dispatch Radar is Paused (Offline)'}
                </h2>
              </div>

              {/* Online/Offline Toggle and Radius Controller */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleOnline}
                  disabled={isExpired}
                  className={`min-h-[44px] px-4 py-2 border-2 border-[var(--theme-border)] font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                    online
                      ? 'bg-done text-paper shadow-hard hover:opacity-95'
                      : 'bg-[var(--theme-bg)] text-[var(--theme-text-soft)] hover:text-[var(--theme-text-main)]'
                  } ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {online ? '● RADAR ONLINE' : '○ RADAR OFFLINE'}
                </button>
              </div>
            </div>

            {/* Graphical Concentric Radar Canvas */}
            <div className="relative border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] h-72 sm:h-80 flex items-center justify-center overflow-hidden">
              {/* Radar Grid Circles */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* 2.0 km outer ring */}
                <div
                  className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-dashed ${
                    online ? 'border-signal/40' : 'border-[var(--theme-border)]'
                  }`}
                />
                {/* 1.0 km middle ring */}
                <div
                  className={`w-44 h-44 sm:w-52 sm:h-52 rounded-full border ${
                    online ? 'border-signal/30' : 'border-[var(--theme-border)]'
                  }`}
                />
                {/* 0.5 km inner ring */}
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border ${
                    online ? 'border-signal/20' : 'border-[var(--theme-border)]'
                  }`}
                />

                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-[var(--theme-border)]/60" />
                <div className="absolute h-full w-[1px] bg-[var(--theme-border)]/60" />

                {/* Pulsing center ping */}
                <div className="relative flex items-center justify-center">
                  <span
                    className={`w-4 h-4 rounded-full ${
                      online ? 'bg-signal animate-ping' : 'bg-concrete'
                    }`}
                  />
                  <span
                    className={`absolute w-3 h-3 rounded-full border-2 border-[var(--theme-border)] ${
                      online ? 'bg-signal' : 'bg-concrete'
                    }`}
                  />
                </div>
              </div>

              {/* Proximity Information Labels */}
              <div className="absolute top-3 left-3 font-mono text-[11px] text-[var(--theme-text-soft)] bg-[var(--theme-surface)]/90 p-2 border border-[var(--theme-border)]">
                <div>ZONE: Indiranagar, Domlur &amp; HAL</div>
                <div>RADIUS: {radarZoom} km standard (SRS FR-P8)</div>
                <div>DISPATCH MATCH: Nearest Online Partner</div>
              </div>

              <div className="absolute bottom-3 right-3 font-mono text-[11px] text-[var(--theme-text-soft)] bg-[var(--theme-surface)]/90 p-2 border border-[var(--theme-border)]">
                {online ? (
                  <span className="text-done font-bold">● LISTENER ACTIVE</span>
                ) : (
                  <span className="text-[var(--theme-text-muted)] font-bold">○ PAUSED (OFFLINE)</span>
                )}
              </div>
            </div>

            {/* Test Trigger Button for User Verification */}
            <div className="p-4 border-2 border-dashed border-signal bg-[var(--theme-bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal block">
                  DEMO DISPATCH SIMULATOR (PROMPT 3 VERIFICATION):
                </span>
                <p className="font-mono text-xs text-[var(--theme-text-soft)] mt-0.5">
                  Click to simulate an incoming customer repair request with the 30-second countdown ring.
                </p>
              </div>

              <button
                type="button"
                onClick={onSimulateIncomingRequest}
                className="btn-primary min-h-[46px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard shrink-0"
              >
                ⚡ TRIGGER INCOMING REQUEST →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
