/**
 * FixIt Now - Partner Plan Selection Screen
 * Flat-rate subscription models with 0% commission guarantee.
 * Includes simulated sandbox Payment Gateway (Card, Net Banking, UPI) with no real money involved.
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
      {/* SIMULATED PAYMENT GATEWAY MODAL (ZERO REAL MONEY INVOLVED)                 */}
      {/* ========================================================================= */}
      {gatewayOpen && gatewayPlan && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-5 sm:p-7 max-w-lg w-full shadow-hard relative text-ink font-mono my-auto"
            style={{ borderRadius: 0 }}
          >
            {/* Stamp & Top Bar */}
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-signal inline-block" />
                <span className="text-xs font-bold uppercase tracking-widest text-signal">
                  FIXIT PAY · SECURE PAYMENT GATEWAY
                </span>
              </div>
              <span className="border border-ink bg-concrete text-ink px-2 py-0.5 text-[9px] font-bold uppercase">
                TEST MODE · NO REAL MONEY
              </span>
            </div>

            {/* =================================================================== */}
            {/* STEP 1: PAYMENT METHOD & INFORMATION INPUT                          */}
            {/* =================================================================== */}
            {gatewayStep === 'input' && (
              <div className="space-y-4">
                {/* Plan Summary Ticket */}
                <div className="p-3 bg-concrete border border-ink flex justify-between items-center gap-2 flex-wrap">
                  <div>
                    <span className="text-[10px] text-muted uppercase block">SUBSCRIPTION PASS:</span>
                    <strong className="text-sm font-display text-ink uppercase">
                      {gatewayPlan.name} Pass ({gatewayPlan.duration_months} Months)
                    </strong>
                    <div className="text-[10px] text-done font-bold mt-0.5">
                      ✓ 0.00% Commission · 100% Direct Partner Earnings
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted uppercase block">FEE PAYABLE:</span>
                    <span className="font-display font-extrabold text-2xl text-signal">
                      ₹{gatewayPlan.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector Tabs */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    SELECT PAYMENT METHOD:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'card', label: '💳 Card' },
                      { key: 'netbanking', label: '🏛️ Net Banking' },
                      { key: 'upi', label: '⚡ UPI / QR' },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.key);
                          setGatewayError(null);
                        }}
                        className={`p-2 text-xs font-bold uppercase border-2 transition-colors ${
                          paymentMethod === m.key
                            ? 'bg-signal text-paper border-signal font-bold shadow-hard-sm'
                            : 'bg-paper text-ink border-ink hover:bg-concrete'
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Method 1: Credit / Debit Card Form */}
                {paymentMethod === 'card' && (
                  <div className="space-y-3 p-3.5 border border-ink bg-paper">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          CARD NUMBER (SIMULATED):
                        </label>
                        <span className="text-[9px] text-muted font-bold">VISA / MASTERCARD / RUPAY</span>
                      </div>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 8921 4410 8821"
                        maxLength={19}
                        className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                        style={{ borderRadius: 0 }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                          EXPIRY (MM/YY):
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/28"
                          maxLength={5}
                          className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                          style={{ borderRadius: 0 }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                          CVV:
                        </label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="•••"
                          maxLength={4}
                          className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                          style={{ borderRadius: 0 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        CARDHOLDER NAME:
                      </label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="NAME ON CARD"
                        className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink uppercase focus:outline-none focus:border-signal"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </div>
                )}

                {/* Method 2: Net Banking Form */}
                {paymentMethod === 'netbanking' && (
                  <div className="space-y-3 p-3.5 border border-ink bg-paper">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        SELECT FINANCIAL INSTITUTION:
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          'HDFC Bank',
                          'State Bank of India',
                          'ICICI Bank',
                          'Axis Bank',
                          'Kotak Mahindra',
                          'Punjab National Bank',
                        ].map((bank) => (
                          <button
                            key={bank}
                            type="button"
                            onClick={() => setSelectedBank(bank)}
                            className={`p-2 text-left border-2 font-mono text-[11px] font-bold ${
                              selectedBank === bank
                                ? 'border-signal bg-signal text-paper'
                                : 'border-ink bg-concrete text-ink hover:bg-paper'
                            }`}
                            style={{ borderRadius: 0 }}
                          >
                            {selectedBank === bank ? '✓ ' : '○ '}
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        CUSTOMER ID / NETBANKING USERNAME:
                      </label>
                      <input
                        type="text"
                        value={bankUserId}
                        onChange={(e) => setBankUserId(e.target.value)}
                        placeholder="CUSTOMER ID"
                        className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </div>
                )}

                {/* Method 3: UPI Form */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-3 p-3.5 border border-ink bg-paper">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        VIRTUAL PAYMENT ADDRESS (UPI ID):
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="partner@okhdfcbank"
                        className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                        style={{ borderRadius: 0 }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['@okhdfcbank', '@oksbi', '@paytm', '@ybl'].map((suf) => (
                        <button
                          key={suf}
                          type="button"
                          onClick={() => {
                            const base = upiId.split('@')[0] || 'partner.fixit';
                            setUpiId(`${base}${suf}`);
                          }}
                          className="px-2 py-0.5 border border-ink bg-concrete text-[10px] font-bold hover:bg-signal hover:text-paper"
                          style={{ borderRadius: 0 }}
                        >
                          {suf}
                        </button>
                      ))}
                    </div>

                    <div className="p-2 border border-dashed border-ink bg-concrete text-[10px] text-muted text-center">
                      ⚡ Instant simulated UPI collect request will be authorized upon submission.
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {gatewayError && (
                  <div className="border-2 border-signal bg-paper text-signal p-2.5 text-xs font-bold shadow-hard-sm">
                    {gatewayError}
                  </div>
                )}

                {/* Safe Simulation Disclaimer */}
                <div className="p-2.5 bg-concrete border border-ink text-[10px] text-muted leading-relaxed">
                  ⓘ <strong>Safe Test Environment:</strong> Real money is not involved. This is a simulated checkout gateway. Entering test credentials authorizes and activates your periodic subscription pass directly in the platform registry.
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    PAY ₹{gatewayPlan.price.toLocaleString('en-IN')} (TEST GATEWAY)
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseGateway}
                    className="btn-secondary w-full sm:w-1/3 min-h-[48px] font-bold text-xs uppercase cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* STEP 2: 2-3 SECONDS LOADING ("processing payment pls do not refresh")*/}
            {/* =================================================================== */}
            {gatewayStep === 'processing' && (
              <div className="py-8 sm:py-10 text-center space-y-5">
                <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-ink bg-signal/15 shadow-hard-sm animate-bounce">
                  <span className="text-3xl">💳</span>
                </div>

                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block animate-pulse">
                    AUTHORIZATION IN PROGRESS
                  </span>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-ink mt-1">
                    Processing payment...
                  </h2>
                  <div className="border-2 border-signal bg-paper text-signal p-3 font-mono text-xs font-bold shadow-hard-sm max-w-sm mx-auto mt-4 uppercase">
                    ⚠️ Please do not refresh or close this window
                  </div>
                </div>

                <div className="p-4 bg-concrete border border-ink text-left space-y-2 max-w-md mx-auto text-xs">
                  <div className="flex items-center justify-between text-muted">
                    <span>[1/3] Securing payment channel ({paymentMethod.toUpperCase()}):</span>
                    <span className="text-done font-bold">✓ VERIFIED</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>[2/3] Authorizing subscription fee (₹{gatewayPlan.price}):</span>
                    <span className="text-done font-bold">✓ APPROVED</span>
                  </div>
                  <div className="flex items-center justify-between text-ink font-bold animate-pulse">
                    <span>[3/3] Activating subscription pass in registry:</span>
                    <span className="text-signal">FINALIZING...</span>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* STEP 3: DISPLAY THAT SUBSCRIPTION PASS IS ACTIVATED                 */}
            {/* =================================================================== */}
            {gatewayStep === 'activated' && (
              <div className="space-y-4 text-xs">
                {/* Confirmation Header */}
                <div className="flex items-center justify-between border-b border-ink/20 pb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-done">
                    ✓ PASS ACTIVATED SUCCESSFULLY
                  </span>
                  <span className="border border-done bg-done text-paper px-2 py-0.5 text-[10px] font-bold uppercase">
                    ACTIVE IN REGISTRY
                  </span>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-2xl text-ink">
                    {activatedSub?.plan_name || gatewayPlan.name} Pass Activated!
                  </h3>
                  <p className="text-muted mt-1">
                    Transaction ref: <span className="font-bold text-ink">TXN-FIXIT-{Date.now().toString().slice(-8)}</span>
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
                    <span className="text-muted">DURATION &amp; VALIDITY:</span>
                    <span className="font-bold text-ink">
                      {activatedSub?.duration_months || gatewayPlan.duration_months} Months ({activatedSub?.days_remaining || gatewayPlan.duration_months * 30} Days)
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-muted">COMMISSION RATE:</span>
                    <span className="font-bold text-done">0.00% (Guaranteed)</span>
                  </div>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-muted">PAYMENT METHOD:</span>
                    <span className="font-bold text-ink">Simulated {paymentMethod.toUpperCase()} (Test Gateway)</span>
                  </div>
                  <div className="border-t border-ink/20 pt-2 flex justify-between items-center gap-2 flex-wrap text-sm font-bold">
                    <span>AMOUNT PAID:</span>
                    <span className="text-signal">₹{(activatedSub?.price_paid ?? gatewayPlan.price).toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted leading-relaxed">
                  Your subscription pass has been recorded in the partner registry. You can now proceed to submit or review your KYC documents to activate the dispatch radar.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGatewayOpen(false);
                      if (onProceedToKyc) onProceedToKyc();
                    }}
                    className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    PROCEED TO KYC UPLOAD →
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseGateway}
                    className="btn-secondary w-full sm:w-1/3 min-h-[48px] font-bold text-xs uppercase cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
