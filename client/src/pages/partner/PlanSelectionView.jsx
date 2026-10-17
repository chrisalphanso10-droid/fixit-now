/**
 * FixIt Now - Partner Plan Selection Screen
 * Flat-rate subscription models with 0% commission guarantee.
 * Conforms to SRS FR-P2, FR-P13, FR-P14 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getSubscriptionPlans, selectOrRenewPlan } from '../../services/partnerService';

export default function PlanSelectionView({
  partner,
  onPlanSelected,
  onProceedToKyc,
  isRenewal = false,
}) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(2); // Default: Half-yearly (Popular)
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSubscriptionPlans().then((data) => {
      setPlans(data);
    });
  }, []);

  const handleSubscribe = async (planId) => {
    setLoading(true);
    setError(null);
    try {
      const activePartnerId = partner?.id || 101;
      const newSub = await selectOrRenewPlan(activePartnerId, planId);
      setReceiptModal(newSub);
      if (onPlanSelected) onPlanSelected(newSub);
    } catch (err) {
      setError(`! ${err.message || 'Plan subscription failed.'}`);
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
                {isRenewal ? 'PLAN RENEWAL & EXTENSION' : 'STEP 2 OF 3: SELECT SUBSCRIPTION PLAN'}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Flat-Rate Subscription. <span className="text-signal">0% Commission.</span>
            </h1>
          </div>

          <div className="border-2 border-signal bg-paper text-ink p-2 px-3 font-mono text-xs font-bold shadow-hard-sm self-start sm:self-auto">
            100% SETTLEMENTS KEPT BY YOU
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] max-w-3xl leading-relaxed">
          FixIt Now never takes a percentage of your labor or diagnostic charges.
          You pay a flat periodic subscription, receive immediate dispatch orders within 2 km,
          and collect payments directly from customers on-site via Cash or personal UPI.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          {error}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isPopular = plan.id === 2;
          const isBestValue = plan.id === 3;

          return (
            <div
              key={plan.id}
              className={`border-2 flex flex-col justify-between transition-all duration-150 ${
                isSelected
                  ? 'border-signal bg-[var(--theme-surface)] shadow-hard'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-hard-sm hover:border-[var(--theme-text-main)]'
              }`}
              style={{ borderRadius: 0 }}
            >
              <div>
                {/* Header Badge */}
                <div className="border-b-2 border-[var(--theme-border)] p-4 flex items-center justify-between bg-[var(--theme-bg)]">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
                    {plan.name} PASS
                  </span>
                  {isPopular && (
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-signal text-ink">
                      MOST POPULAR
                    </span>
                  )}
                  {isBestValue && (
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-ink text-paper">
                      BEST VALUE
                    </span>
                  )}
                </div>

                {/* Price Display */}
                <div className="p-6 border-b-2 border-[var(--theme-border)]">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-lg font-bold text-signal">₹</span>
                    <span className="font-display font-extrabold text-4xl text-[var(--theme-text-main)]">
                      {plan.price.toLocaleString('en-IN')}
                    </span>
                    <span className="font-mono text-xs text-[var(--theme-text-soft)]">
                      / {plan.duration_months} months
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-xs text-[var(--theme-text-soft)]">
                    ≈ ₹{Math.round(plan.price / plan.duration_months)} / month · 0% commission
                  </div>
                </div>

                {/* Benefits List */}
                <div className="p-6 space-y-3 font-mono text-xs">
                  <div className="flex items-start gap-2 text-[var(--theme-text-main)]">
                    <span className="text-signal font-bold">✓</span>
                    <span><strong>100% Earnings Retention:</strong> Zero commission deducted</span>
                  </div>
                  <div className="flex items-start gap-2 text-[var(--theme-text-main)]">
                    <span className="text-signal font-bold">✓</span>
                    <span><strong>Instant Radar Dispatches:</strong> 2 km proximity routing</span>
                  </div>
                  <div className="flex items-start gap-2 text-[var(--theme-text-main)]">
                    <span className="text-signal font-bold">✓</span>
                    <span><strong>Direct On-Site Payments:</strong> Customer Cash &amp; personal UPI</span>
                  </div>
                  <div className="flex items-start gap-2 text-[var(--theme-text-main)]">
                    <span className="text-signal font-bold">✓</span>
                    <span><strong>Unlimited Jobs:</strong> No cap on accepted work orders</span>
                  </div>
                  <div className="flex items-start gap-2 text-[var(--theme-text-main)]">
                    <span className="text-signal font-bold">✓</span>
                    <span><strong>Verified Trade Badge:</strong> Boosts acceptance credibility</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-4 border-t-2 border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    handleSubscribe(plan.id);
                  }}
                  className={`w-full min-h-[48px] font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'btn-primary shadow-hard'
                      : 'border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] hover:bg-signal hover:text-ink'
                  }`}
                >
                  {loading && selectedPlanId === plan.id
                    ? 'PROCESSING ACTIVATION...'
                    : `SELECT ${plan.name.toUpperCase()} (₹${plan.price})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Instant Receipt / Payment Confirmation Modal */}
      {receiptModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-lg w-full shadow-hard relative text-ink font-mono"
            style={{ borderRadius: 0 }}
          >
            {/* Stamp */}
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-signal">
                PLAN SUBSCRIPTION INVOICE &amp; RECEIPT
              </span>
              <span className="border border-done bg-done text-paper px-2 py-0.5 text-[10px] font-bold uppercase">
                PAYMENT CONFIRMED
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-display font-extrabold text-2xl text-ink">
                  {receiptModal.plan_name} Pass Activated!
                </h3>
                <p className="text-muted mt-1">
                  Transaction ref: <span className="font-bold text-ink">TXN-{receiptModal.partner_id}-{Date.now().toString().slice(-6)}</span>
                </p>
              </div>

              <div className="p-4 bg-concrete border border-ink space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-muted">PARTNER:</span>
                  <span className="font-bold text-ink">{partner?.name || 'Registered Partner'}</span>
                </div>
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-muted">SERVICE CATEGORY:</span>
                  <span className="font-bold text-ink">{partner?.service_name || 'Certified Trade'}</span>
                </div>
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-muted">DURATION:</span>
                  <span className="font-bold text-ink">{receiptModal.duration_months} Months ({receiptModal.days_remaining} Days)</span>
                </div>
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-muted">COMMISSION RATE:</span>
                  <span className="font-bold text-done">0.00% (Guaranteed)</span>
                </div>
                <div className="border-t border-ink/20 pt-2 flex justify-between items-center gap-2 flex-wrap text-sm font-bold">
                  <span>AMOUNT PAID:</span>
                  <span className="text-signal">₹{receiptModal.price_paid.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                Your subscription has been recorded in the partner registry. You can now proceed to submit or check your KYC documents to activate the dispatch radar.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptModal(null);
                    if (onProceedToKyc) onProceedToKyc();
                  }}
                  className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider"
                >
                  PROCEED TO KYC UPLOAD →
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModal(null)}
                  className="btn-secondary w-full sm:w-1/3 min-h-[48px] font-bold text-xs uppercase"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
