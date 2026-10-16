/**
 * FixIt Now - Partner Current Plan Screen
 * Subscription details with time remaining countdown,
 * Plan-expiry warning (< 7 days), and Lockout Screen when expired (BR-4).
 * Conforms to SRS FR-P13, FR-P14, FR-P15, BR-4 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  getPartnerSubscription,
  selectOrRenewPlan,
  getSubscriptionPlans,
} from '../../services/partnerService';

export default function PlanDetailsView({
  partner,
  subscription,
  onPlanRenewed,
  onNavigateToDashboard,
}) {
  const [currentSub, setCurrentSub] = useState(subscription);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Forced preview state for testing (Active, Warning, Expired)
  const [forcedDays, setForcedDays] = useState(null);

  useEffect(() => {
    if (!subscription) {
      getPartnerSubscription(partner?.id || 101).then((s) => setCurrentSub(s));
    } else {
      setCurrentSub(subscription);
    }
    getSubscriptionPlans().then((p) => setPlans(p));
  }, [subscription, partner?.id]);

  const daysRemaining =
    forcedDays !== null ? forcedDays : currentSub?.days_remaining ?? 108;
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
  const isExpired = daysRemaining <= 0 || currentSub?.status === 'expired';

  // Handle Plan Renewal
  const handleRenew = async (planId) => {
    setLoading(true);
    setError(null);
    try {
      const activePartnerId = partner?.id || 101;
      const renewed = await selectOrRenewPlan(activePartnerId, planId);
      setCurrentSub(renewed);
      setForcedDays(null);
      setRenewSuccess(
        `Successfully renewed ${renewed.plan_name} Pass! Dispatch radar is now fully unlocked for ${renewed.days_remaining} days.`
      );
      if (onPlanRenewed) onPlanRenewed(renewed);
    } catch (err) {
      setError(`! ${err.message || 'Renewal failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-signal inline-block" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                MEMBERSHIP &amp; ACCESS CONTROL (BR-4)
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Subscription Plan &amp; Dispatch Pass
            </h1>
          </div>

          {/* Current Status Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`border-2 px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm ${
                isExpired
                  ? 'border-ink bg-ink text-paper'
                  : isExpiringSoon
                  ? 'border-signal bg-paper text-ink animate-pulse'
                  : 'border-done bg-done text-paper'
              }`}
            >
              {isExpired
                ? '✕ PLAN EXPIRED · DISPATCH LOCKED'
                : isExpiringSoon
                ? `! EXPIRING IN ${daysRemaining} DAYS`
                : '✓ PASS ACTIVE & HEALTHY'}
            </span>
          </div>
        </div>

        {/* State Preview Switcher for Testing (Prompt 3 Requirements) */}
        <div className="p-3 border border-[var(--theme-border)] bg-[var(--theme-bg)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <span className="font-bold text-[var(--theme-text-soft)] uppercase">
            Test Plan Lifecycles (BR-4):
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForcedDays(108);
                setError(null);
                setRenewSuccess(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                !isExpired && !isExpiringSoon
                  ? 'bg-done text-paper border-done'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              1. Active Plan (108 Days)
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedDays(2);
                setError(null);
                setRenewSuccess(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                isExpiringSoon
                  ? 'bg-signal text-ink border-signal'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              2. Warning State (2 Days Left)
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedDays(0);
                setError(null);
                setRenewSuccess(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                isExpired
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              3. Lockout State (Expired)
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          {error}
        </div>
      )}

      {renewSuccess && (
        <div
          role="status"
          className="border-2 border-done bg-paper text-ink p-4 font-mono text-xs font-bold shadow-hard-sm space-y-2"
        >
          <div>✓ {renewSuccess}</div>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="px-3 py-1 bg-done text-paper border border-ink text-xs uppercase"
          >
            Go to Dispatch Radar →
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. PLAN-EXPIRY WARNING BANNER (< 7 DAYS) (BR-4)                */}
      {/* ============================================================== */}
      {isExpiringSoon && (
        <div
          className="border-3 border-signal bg-paper text-ink p-5 sm:p-6 shadow-hard space-y-3"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center justify-between border-b border-ink/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-signal inline-block animate-ping" />
              <h2 className="font-display font-extrabold text-xl text-ink uppercase">
                Plan-Expiry Warning: Dispatch Lockout in {daysRemaining} Days
              </h2>
            </div>
            <span className="border border-signal bg-signal text-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
              RENEW TO PREVENT LOCK
            </span>
          </div>

          <p className="font-mono text-xs text-soft leading-relaxed">
            Per FixIt Now Rule <strong>BR-4</strong>, when your subscription hits 0 days remaining,
            your dispatch radar is automatically frozen and you cannot accept customer requests.
            Renew your pass today to ensure uninterrupted bookings.
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleRenew(p.id)}
                disabled={loading}
                className="btn-primary min-h-[44px] px-4 font-mono text-xs font-bold uppercase shadow-hard-sm"
              >
                Renew {p.name} (₹{p.price}) →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. PLAN EXPIRED LOCKOUT SCREEN (DAYS <= 0) (BR-4)              */}
      {/* ============================================================== */}
      {isExpired && (
        <div
          className="border-3 border-ink bg-ink text-paper p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-start justify-between border-b border-paper/20 pb-4">
            <div className="space-y-1">
              <span className="border border-signal bg-signal text-ink px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider inline-block">
                LOCKOUT PROTOCOL ACTIVE
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-paper">
                SUBSCRIPTION EXPIRED · DISPATCH RADAR LOCKED
              </h2>
            </div>
            <div className="w-12 h-12 border-2 border-paper flex items-center justify-center font-bold text-2xl text-signal">
              ✕
            </div>
          </div>

          <p className="font-mono text-xs sm:text-sm text-concrete leading-relaxed">
            Your subscription plan has expired. Your dispatch radar is currently <strong>LOCKED</strong>.
            You cannot toggle online or receive incoming home-repair calls until you renew.
            Select any plan below to immediately re-activate your account.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {plans.map((p) => (
              <div
                key={p.id}
                className="border-2 border-paper bg-concrete text-ink p-4 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-xs font-bold uppercase text-muted block">
                    {p.name} PASS
                  </span>
                  <div className="font-display font-extrabold text-2xl text-ink mt-1">
                    ₹{p.price}
                  </div>
                  <div className="font-mono text-[11px] text-muted mt-1">
                    {p.duration_months} Months · 0% Comm.
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleRenew(p.id)}
                  className="mt-4 btn-primary w-full min-h-[44px] font-mono text-xs font-bold uppercase"
                >
                  RENEW NOW (₹{p.price}) →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. CURRENT PLAN DETAILS & COUNTDOWN (ACTIVE)                   */}
      {/* ============================================================== */}
      {!isExpired && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="border-b-2 border-[var(--theme-border)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-[var(--theme-text-soft)] uppercase block">
                CURRENT ACTIVE SUBSCRIPTION
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
                {currentSub?.plan_name || 'Half-yearly'} Pass
              </h2>
            </div>

            <div className="text-left sm:text-right">
              <span className="font-mono text-xs text-[var(--theme-text-soft)] uppercase block">
                TIME REMAINING
              </span>
              <div className="font-display font-black text-3xl sm:text-4xl text-signal">
                {daysRemaining} <span className="font-mono text-sm text-[var(--theme-text-main)] font-bold">DAYS</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
              <span className="text-[var(--theme-text-soft)] block text-[10px]">PRICE PAID:</span>
              <span className="font-bold text-base text-[var(--theme-text-main)]">
                ₹{currentSub?.price_paid?.toFixed(2) || '1599.00'}
              </span>
            </div>

            <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
              <span className="text-[var(--theme-text-soft)] block text-[10px]">COMMISSION RATE:</span>
              <span className="font-bold text-base text-done">
                0% FLAT-RATE
              </span>
            </div>

            <div className="p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)]">
              <span className="text-[var(--theme-text-soft)] block text-[10px]">VALID UNTIL:</span>
              <span className="font-bold text-base text-[var(--theme-text-main)]">
                {new Date(currentSub?.end_date || '2027-02-01').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Extension Options */}
          <div className="border-t-2 border-[var(--theme-border)] pt-5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-3">
              EXTEND OR UPGRADE SUBSCRIPTION EARLY:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleRenew(p.id)}
                  className="p-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] hover:border-signal text-left transition-colors min-h-[54px] flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-xs font-bold text-[var(--theme-text-main)]">
                      {p.name} Pass
                    </span>
                    <span className="font-display font-extrabold text-sm text-signal">
                      ₹{p.price}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--theme-text-soft)]">
                    +{p.duration_months * 30} Days Extension →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
