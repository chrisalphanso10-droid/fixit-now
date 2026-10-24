/**
 * FixIt Now - Partner Plan Selection Screen
 * Flat-rate subscription models with 0% commission guarantee.
 * Includes simulated sandbox Payment Gateway (Card, Net Banking, UPI) with no real money involved.
 * Conforms to SRS FR-P2, FR-P13, FR-P14 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getSubscriptionPlans, selectOrRenewPlan } from '../../services/partnerService';
import QrPaymentModal from '../../components/partner/QrPaymentModal';

export default function PlanSelectionView({
  partner,
  onPlanSelected,
  onProceedToKyc,
  isRenewal = false,
}) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(2); // Default: Half-yearly (Popular)
  const [error, setError] = useState(null);

  // Simulated Payment Gateway state
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [gatewayPlan, setGatewayPlan] = useState(null);
  const [gatewayStep, setGatewayStep] = useState('input'); // 'input' | 'processing' | 'activated'
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'netbanking' | 'upi'
  const [gatewayError, setGatewayError] = useState(null);
  const [activatedSub, setActivatedSub] = useState(null);

  // Form inputs for simulated payment
  const [cardNumber, setCardNumber] = useState('4532 8921 4410 8821');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('821');
  const [cardHolder, setCardHolder] = useState(partner?.name || 'RAJESH KUMAR');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [bankUserId, setBankUserId] = useState('PARTNER_NET_9021');
  const [upiId, setUpiId] = useState('fixit.partner@okhdfcbank');

  useEffect(() => {
    getSubscriptionPlans().then((data) => {
      setPlans(data);
    });
  }, []);

  const handleOpenGateway = (plan) => {
    setSelectedPlanId(plan.id);
    setGatewayPlan(plan);
    setGatewayStep('input');
    setGatewayError(null);
    setCardHolder(partner?.name || 'RAJESH KUMAR');
    setGatewayOpen(true);
  };

  const handleCloseGateway = () => {
    if (gatewayStep === 'processing') return; // Do not close while processing
    setGatewayOpen(false);
    setGatewayStep('input');
    setGatewayError(null);
  };

  const handleProcessPayment = async (e) => {
    if (e) e.preventDefault();
    setGatewayError(null);

    // Form input validation
    if (paymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (!cleanCard || cleanCard.length < 12) {
        setGatewayError('Please enter a valid card number (at least 12 digits).');
        return;
      }
      if (!cardExpiry.trim()) {
        setGatewayError('Please enter card expiry date (MM/YY).');
        return;
      }
      if (!cardCvv.trim() || cardCvv.length < 3) {
        setGatewayError('Please enter a valid 3-digit CVV.');
        return;
      }
      if (!cardHolder.trim()) {
        setGatewayError('Please enter the name on the card.');
        return;
      }
    } else if (paymentMethod === 'netbanking') {
      if (!selectedBank) {
        setGatewayError('Please select a financial institution for Net Banking.');
        return;
      }
      if (!bankUserId.trim()) {
        setGatewayError('Please enter your Customer ID / Net Banking username.');
        return;
      }
    } else if (paymentMethod === 'upi') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setGatewayError('Please enter a valid Virtual Payment Address / UPI ID (e.g. partner@upi).');
        return;
      }
    }

    // Step 2: Show loading of 2-3 seconds with "processing payment pls do not refresh"
    setGatewayStep('processing');

    // Wait exactly 2.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const activePartnerId = partner?.id || 101;
      const newSub = await selectOrRenewPlan(activePartnerId, gatewayPlan.id);
      setActivatedSub(newSub);
      if (onPlanSelected) onPlanSelected(newSub);
      // Step 3: Display that the subscription pass is activated
      setGatewayStep('activated');
    } catch (err) {
      setGatewayError(`! ${err.message || 'Payment authorization failed.'}`);
      setGatewayStep('input');
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
                    <span><strong>Direct Customer Payouts:</strong> Direct payment received from customer</span>
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
                  onClick={() => handleOpenGateway(plan)}
                  className={`w-full min-h-[48px] font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'btn-primary shadow-hard'
                      : 'border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] hover:bg-signal hover:text-ink'
                  }`}
                >
                  SELECT {plan.name.toUpperCase()} (₹{plan.price.toLocaleString('en-IN')})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* PAYMENT GATEWAY MODAL (CARD, NETBANKING, UPI / QR - ZERO REAL MONEY)       */}
      {/* ========================================================================= */}
      {gatewayOpen && gatewayPlan && (
        <QrPaymentModal
          isOpen={gatewayOpen}
          onClose={() => setGatewayOpen(false)}
          plan={gatewayPlan}
          partner={partner}
          onProceedToKyc={() => {
            setGatewayOpen(false);
            if (onProceedToKyc) onProceedToKyc();
          }}
          onPaymentSuccess={(newSub) => {
            setActivatedSub(newSub);
            if (onPlanSelected) onPlanSelected(newSub);
          }}
        />
      )}
    </div>
  );
}
