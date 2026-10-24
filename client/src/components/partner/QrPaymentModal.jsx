/**
 * FixIt Now - Partner Subscription Payment Modal
 * Supports all 3 payment methods:
 * 1. Card payment (Card number, Expiry MM/YY, CVV, Cardholder Name)
 * 2. Net Banking (Financial institution selection, Customer ID)
 * 3. UPI:
 *    3.1 UPI ID (Virtual Payment Address input with quick handle chips)
 *    3.2 QR Code (Live QR code encoding PUBLIC_BASE_URL/pay/<token>, countdown timer,
 *                 fake UPI ID with copy button, 'New QR' refresh, real-time phone scan detection)
 * Conforms to Item 3, docs/DESIGN.md (neo-brutalism, hard shadows, sharp edges, zero pill shapes).
 */

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getSocket } from '../../services/socketService';
import {
  createPaymentAttempt,
  getActivePaymentAttempt,
  selectOrRenewPlan,
} from '../../services/partnerService';

export default function QrPaymentModal({
  isOpen,
  onClose,
  plan,
  partner,
  onPaymentSuccess,
  onProceedToKyc,
  isUpgrade = false,
}) {
  // 1. Payment method selection: 'card' | 'netbanking' | 'upi'
  const [paymentMethod, setPaymentMethod] = useState('card');
  // 3. UPI sub-mode: 'id' | 'qr'
  const [upiSubMode, setUpiSubMode] = useState('id');

  // Form Fields
  // 1. Card
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // 2. Net Banking
  const [selectedBank, setSelectedBank] = useState('');
  const [bankUserId, setBankUserId] = useState('');

  // 3.1 UPI ID
  const [upiIdInput, setUpiIdInput] = useState('');

  // 3.2 QR Code state
  const [attempt, setAttempt] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [copied, setCopied] = useState(false);

  // Common Modal lifecycle states: 'input' | 'processing' | 'success'
  const [step, setStep] = useState('input');
  const [formError, setFormError] = useState(null);
  const [activatedSub, setActivatedSub] = useState(null);

  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-format Card Number with spaces (#### #### #### ####)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  // Auto-format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  // Reset or initialize on open
  useEffect(() => {
    if (!isOpen || !plan) {
      setStep('input');
      setFormError(null);
      setAttempt(null);
      return;
    }

    setStep('input');
    setFormError(null);
  }, [isOpen, plan?.id]);

  // Load or generate QR Code attempt when UPI -> QR Code sub-mode is selected
  useEffect(() => {
    if (!isOpen || !plan || paymentMethod !== 'upi' || upiSubMode !== 'qr') {
      return;
    }

    let isMounted = true;

    async function initQrAttempt() {
      setQrLoading(true);
      setFormError(null);

      try {
        const existing = await getActivePaymentAttempt(plan.id);
        if (existing && isMounted) {
          if (existing.status === 'paid') {
            setStep('success');
            setAttempt(existing);
            if (onPaymentSuccess) onPaymentSuccess(existing);
            return;
          }

          if (existing.status === 'processing') {
            setStep('processing');
            setAttempt(existing);
            return;
          }
        }

        // Create fresh attempt with locked price and random token
        const newAttempt = await createPaymentAttempt(plan.id);
        if (isMounted) {
          setAttempt(newAttempt);
          const secs = Math.max(0, Math.floor((new Date(newAttempt.expiresAt).getTime() - Date.now()) / 1000));
          setRemainingSeconds(secs);
        }
      } catch (err) {
        if (isMounted) {
          setFormError(err.message || 'Unable to generate payment QR. Please try again.');
        }
      } finally {
        if (isMounted) setQrLoading(false);
      }
    }

    initQrAttempt();

    return () => {
      isMounted = false;
    };
  }, [isOpen, plan?.id, paymentMethod, upiSubMode]);

  // Render QR Canvas whenever attempt changes and in QR sub-mode
  useEffect(() => {
    if (!attempt?.scanUrl || paymentMethod !== 'upi' || upiSubMode !== 'qr' || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      attempt.scanUrl,
      {
        width: 200,
        margin: 1,
        color: {
          dark: '#111111',
          light: '#FFFFFF',
        },
      },
      (err) => {
        if (err) console.error('[QR Canvas Error]:', err);
      }
    );
  }, [attempt?.scanUrl, paymentMethod, upiSubMode, step]);

  // Countdown timer for QR code validity
  useEffect(() => {
    if (!attempt?.expiresAt || paymentMethod !== 'upi' || upiSubMode !== 'qr') return;

    const updateTimer = () => {
      const msLeft = new Date(attempt.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(msLeft / 1000));
      setRemainingSeconds(secs);

      if (secs <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempt?.expiresAt, paymentMethod, upiSubMode]);

  // Listen to Socket.IO for real-time mobile QR phone scan detection
  useEffect(() => {
    if (!isOpen || !attempt?.attemptId) return;

    const socket = getSocket();
    if (!socket) return;

    const onProcessing = (data) => {
      if (data?.attemptId === attempt.attemptId || String(data?.planId) === String(plan?.id)) {
        setStep('processing');
      }
    };

    const onSuccess = (data) => {
      if (data?.attemptId === attempt.attemptId || String(data?.planId) === String(plan?.id)) {
        setStep('success');
        setActivatedSub(data.subscription);
        if (onPaymentSuccess) {
          onPaymentSuccess(data.subscription);
        }
      }
    };

    socket.on('payment:processing', onProcessing);
    socket.on('payment:success', onSuccess);

    return () => {
      socket.off('payment:processing', onProcessing);
      socket.off('payment:success', onSuccess);
    };
  }, [isOpen, attempt?.attemptId, plan?.id, onPaymentSuccess, onClose]);

  // Handler for "↻ New QR" button
  const handleNewQr = async () => {
    setQrLoading(true);
    setFormError(null);
    try {
      const newAttempt = await createPaymentAttempt(plan.id);
      setAttempt(newAttempt);
      const secs = Math.max(0, Math.floor((new Date(newAttempt.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(secs);
    } catch (err) {
      setFormError(err.message || 'Failed to create new QR attempt.');
    } finally {
      setQrLoading(false);
    }
  };

  // Fake UPI ID copy button handler
  const handleCopyUpi = () => {
    const upi = attempt?.upiId || 'fixitnow@demo';
    navigator.clipboard.writeText(upi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Process Direct Simulated Payments (Card, Net Banking, or UPI ID)
  const handleProcessDirectPayment = async (e) => {
    if (e) e.preventDefault();
    setFormError(null);

    // 1. Validation for Card
    if (paymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (!cleanCard || cleanCard.length < 12) {
        setFormError('Please enter a valid card number (at least 12 digits).');
        return;
      }
      if (!cardExpiry.trim() || cardExpiry.length < 4) {
        setFormError('Please enter a valid card expiry date (MM/YY).');
        return;
      }
      if (!cardCvv.trim() || cardCvv.length < 3) {
        setFormError('Please enter a valid 3 or 4 digit CVV.');
        return;
      }
      if (!cardHolder.trim()) {
        setFormError('Please enter the cardholder name.');
        return;
      }
    }
    // 2. Validation for Net Banking
    else if (paymentMethod === 'netbanking') {
      if (!selectedBank) {
        setFormError('Please select a financial institution for Net Banking.');
        return;
      }
      if (!bankUserId.trim()) {
        setFormError('Please enter your Customer ID / Net Banking username.');
        return;
      }
    }
    // 3. Validation for UPI ID
    else if (paymentMethod === 'upi' && upiSubMode === 'id') {
      if (!upiIdInput.trim() || !upiIdInput.includes('@')) {
        setFormError('Please enter a valid Virtual Payment Address / UPI ID (e.g. partner@upi).');
        return;
      }
    }

    // Step 2: Show loading of 2.5 seconds with "Processing payment... pls do not refresh"
    setStep('processing');

    // Wait exactly 2.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const activePartnerId = partner?.id || 101;
      const newSub = await selectOrRenewPlan(activePartnerId, plan.id);
      setActivatedSub(newSub);
      setStep('success');
      if (onPaymentSuccess) {
        onPaymentSuccess(newSub);
      }
    } catch (err) {
      setFormError(err.message || 'Payment authorization failed.');
      setStep('input');
    }
  };

  if (!isOpen) return null;

  // Format mm:ss for QR countdown
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = remainingSeconds <= 0;

  const lockedAmount = attempt?.amount ?? plan?.price ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-paper border-2 border-ink p-5 sm:p-7 max-w-lg w-full shadow-hard relative text-ink font-mono my-auto max-h-[92vh] overflow-y-auto"
        style={{ borderRadius: 0 }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-signal inline-block" />
            <span className="text-xs font-bold uppercase tracking-widest text-signal">
              {isUpgrade ? 'PLAN UPGRADE · FIXIT PAY' : 'FIXIT PAY · SECURE PAYMENT GATEWAY'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="border border-ink bg-concrete text-ink px-2 py-0.5 text-[9px] font-bold uppercase">
              TEST MODE · NO REAL MONEY
            </span>
            {step !== 'processing' && (
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 border border-ink bg-concrete hover:bg-signal hover:text-ink font-bold text-xs flex items-center justify-center cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Plan Summary Banner */}
        <div className="p-3 bg-concrete border border-ink flex justify-between items-center gap-2 mb-4">
          <div>
            <span className="text-[10px] text-muted uppercase block">SUBSCRIPTION PASS:</span>
            <strong className="text-sm font-display text-ink uppercase">
              {plan?.name} Pass ({plan?.duration_months} Months)
            </strong>
            <div className="text-[10px] text-done font-bold mt-0.5">
              ✓ 0.00% Commission · 100% Direct Partner Earnings
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted uppercase block">FEE PAYABLE:</span>
            <span className="font-display font-extrabold text-2xl text-signal">
              ₹{Number(lockedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {formError && (
          <div className="mb-4 p-2.5 border-2 border-signal bg-paper text-signal text-xs font-bold shadow-hard-xs">
            ! {formError}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 1: SELECT PAYMENT METHOD & DETAILS INPUT                       */}
        {/* =================================================================== */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Primary Payment Mode Selection */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                SELECT PAYMENT METHOD:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'card', label: '1. 💳 Card' },
                  { key: 'netbanking', label: '2. 🏛️ Net Banking' },
                  { key: 'upi', label: '3. ⚡ UPI' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.key);
                      setFormError(null);
                    }}
                    className={`p-2.5 text-xs font-bold uppercase border-2 transition-colors cursor-pointer text-center ${
                      paymentMethod === m.key
                        ? 'bg-signal text-paper border-signal shadow-hard-sm'
                        : 'bg-paper text-ink border-ink hover:bg-concrete'
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* OPTION 1: CARD PAYMENT                                        */}
            {/* ------------------------------------------------------------- */}
            {paymentMethod === 'card' && (
              <div className="space-y-3 p-3.5 border border-ink bg-paper shadow-hard-xs">
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
                    onChange={handleCardNumberChange}
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
                      onChange={handleExpiryChange}
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
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    placeholder="NAME ON CARD"
                    className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink uppercase focus:outline-none focus:border-signal"
                    style={{ borderRadius: 0 }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleProcessDirectPayment}
                  className="btn-primary w-full min-h-[46px] font-bold text-xs uppercase tracking-wider cursor-pointer shadow-hard-xs mt-2"
                >
                  PAY ₹{Number(lockedAmount).toFixed(2)} VIA CARD (TEST GATEWAY)
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* OPTION 2: NET BANKING                                         */}
            {/* ------------------------------------------------------------- */}
            {paymentMethod === 'netbanking' && (
              <div className="space-y-3 p-3.5 border border-ink bg-paper shadow-hard-xs">
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
                        className={`p-2 text-left border-2 font-mono text-[11px] font-bold cursor-pointer ${
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

                <button
                  type="button"
                  onClick={handleProcessDirectPayment}
                  className="btn-primary w-full min-h-[46px] font-bold text-xs uppercase tracking-wider cursor-pointer shadow-hard-xs mt-2"
                >
                  PAY ₹{Number(lockedAmount).toFixed(2)} VIA NET BANKING (TEST GATEWAY)
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* OPTION 3: UPI (3.1 UPI ID or 3.2 QR CODE)                     */}
            {/* ------------------------------------------------------------- */}
            {paymentMethod === 'upi' && (
              <div className="space-y-3.5 p-3.5 border border-ink bg-paper shadow-hard-xs">
                {/* UPI Sub-option selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                    SELECT UPI OPTION:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUpiSubMode('id')}
                      className={`p-2 text-xs font-bold uppercase border-2 transition-colors cursor-pointer text-center ${
                        upiSubMode === 'id'
                          ? 'bg-ink text-paper border-ink shadow-hard-xs'
                          : 'bg-concrete text-ink border-ink hover:bg-paper'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      3.1 UPI ID
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpiSubMode('qr')}
                      className={`p-2 text-xs font-bold uppercase border-2 transition-colors cursor-pointer text-center ${
                        upiSubMode === 'qr'
                          ? 'bg-signal text-paper border-signal shadow-hard-xs'
                          : 'bg-concrete text-ink border-ink hover:bg-paper'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      3.2 QR Code
                    </button>
                  </div>
                </div>

                {/* Sub-mode 3.1: Enter UPI ID */}
                {upiSubMode === 'id' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        VIRTUAL PAYMENT ADDRESS (UPI ID):
                      </label>
                      <input
                        type="text"
                        value={upiIdInput}
                        onChange={(e) => setUpiIdInput(e.target.value)}
                        placeholder="partner@okhdfcbank"
                        className="w-full p-2 border-2 border-ink bg-concrete font-mono text-xs font-bold text-ink focus:outline-none focus:border-signal"
                        style={{ borderRadius: 0 }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {['@okhdfcbank', '@oksbi', '@paytm', '@ybl'].map((suf) => (
                        <button
                          key={suf}
                          type="button"
                          onClick={() => {
                            const base = upiIdInput.split('@')[0] || 'partner.fixit';
                            setUpiIdInput(`${base}${suf}`);
                          }}
                          className="px-2 py-0.5 border border-ink bg-concrete text-[10px] font-bold hover:bg-signal hover:text-paper cursor-pointer"
                          style={{ borderRadius: 0 }}
                        >
                          {suf}
                        </button>
                      ))}
                    </div>

                    <div className="p-2 border border-dashed border-ink bg-concrete text-[10px] text-muted text-center">
                      ⚡ Instant simulated UPI collect request will be authorized upon submission.
                    </div>

                    <button
                      type="button"
                      onClick={handleProcessDirectPayment}
                      className="btn-primary w-full min-h-[46px] font-bold text-xs uppercase tracking-wider cursor-pointer shadow-hard-xs"
                    >
                      PAY ₹{Number(lockedAmount).toFixed(2)} VIA UPI ID (TEST GATEWAY)
                    </button>
                  </div>
                )}

                {/* Sub-mode 3.2: QR Code Scan Flow */}
                {upiSubMode === 'qr' && (
                  <div className="space-y-3 pt-1">
                    <div className="border-2 border-ink p-3 bg-concrete flex flex-col items-center justify-center text-center shadow-hard-xs relative">
                      {qrLoading ? (
                        <div className="py-12 text-center space-y-2">
                          <div className="w-8 h-8 border-4 border-ink border-t-signal animate-spin mx-auto" />
                          <span className="text-xs font-bold uppercase text-muted block">Generating Payment QR...</span>
                        </div>
                      ) : isExpired ? (
                        <div className="py-8 px-2 space-y-2 text-center">
                          <div className="text-xs font-bold text-signal uppercase">This QR has expired</div>
                          <p className="text-[11px] text-muted leading-relaxed">
                            The 5-minute validity window for this payment attempt has ended.
                          </p>
                          <button
                            type="button"
                            onClick={handleNewQr}
                            className="btn-primary px-3 py-1.5 text-xs font-bold uppercase shadow-hard-xs"
                          >
                            Generate New QR →
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white p-2 border-2 border-ink shadow-hard-xs mb-2">
                            <canvas ref={canvasRef} />
                          </div>

                          <p className="text-xs font-bold text-ink uppercase tracking-wide">
                            Scan with phone camera to pay
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">
                            Point phone camera or open link to authorize demo payment
                          </p>

                          {/* Visible Countdown */}
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-paper border border-ink font-mono text-xs font-bold">
                            <span className="w-2 h-2 bg-signal rounded-full animate-ping" />
                            <span>QR expires in {timeFormatted}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Fake UPI ID with Copy Button */}
                    <div className="flex items-center justify-between border-2 border-ink p-2 bg-concrete text-xs">
                      <div className="overflow-hidden">
                        <span className="text-[9px] text-muted uppercase block font-bold">UPI ID:</span>
                        <span className="font-bold text-ink font-mono truncate block text-[11px]">
                          {attempt?.upiId || 'fixitnow@demo'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2.5 py-1 border border-ink text-[11px] font-bold uppercase bg-paper hover:bg-signal hover:text-ink shadow-hard-xs transition-colors shrink-0 ml-2 cursor-pointer"
                      >
                        {copied ? '✓ COPIED' : 'COPY'}
                      </button>
                    </div>

                    {/* "New QR" Button */}
                    <button
                      type="button"
                      onClick={handleNewQr}
                      disabled={qrLoading}
                      className="w-full min-h-[38px] border-2 border-ink bg-paper hover:bg-concrete text-ink font-bold text-xs uppercase tracking-wider shadow-hard-xs cursor-pointer"
                    >
                      ↻ New QR
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Safe Simulation Disclaimer */}
            <div className="p-2.5 bg-concrete border border-ink text-[10px] text-muted leading-relaxed">
              ⓘ <strong>Safe Test Environment:</strong> Real money is not involved. This is a simulated checkout gateway. Selecting your payment mode authorizes and activates your periodic subscription pass directly in the platform registry.
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: PROCESSING PAYMENT (2.5 SECONDS)                            */}
        {/* =================================================================== */}
        {step === 'processing' && (
          <div className="py-8 sm:py-10 text-center space-y-4">
            <div className="w-14 h-14 border-4 border-ink border-t-signal animate-spin mx-auto shadow-hard-sm" />
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block animate-pulse">
                AUTHORIZATION IN PROGRESS
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-ink mt-1">
                Processing payment...
              </h2>
              <div className="border-2 border-signal bg-paper text-signal p-2.5 font-mono text-xs font-bold shadow-hard-sm max-w-sm mx-auto mt-3 uppercase">
                ⚠️ Please do not refresh or close this window
              </div>
            </div>

            <div className="p-3.5 bg-concrete border border-ink text-left space-y-2 max-w-md mx-auto text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>[1/3] Securing payment channel ({paymentMethod.toUpperCase()}):</span>
                <span className="text-done font-bold">✓ VERIFIED</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>[2/3] Authorizing subscription fee (₹{Number(lockedAmount).toFixed(2)}):</span>
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
        {/* STEP 3: PAYMENT SUCCESSFUL                                          */}
        {/* =================================================================== */}
        {step === 'success' && (
          <div className="py-6 sm:py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-done text-paper border-2 border-ink flex items-center justify-center text-3xl font-bold shadow-hard-sm mx-auto">
              ✓
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-done block">
                ✓ PASS ACTIVATED SUCCESSFULLY
              </span>
              <h2 className="font-display font-extrabold text-2xl uppercase tracking-tight text-ink mt-1">
                Payment successful
              </h2>
              <p className="text-xs text-muted font-mono mt-1">
                {plan?.name} Pass is now active with 0.00% commission guarantee!
              </p>
            </div>

            <div className="p-3.5 bg-concrete border border-ink text-left space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted">SUBSCRIPTION PASS:</span>
                <span className="font-bold text-ink uppercase">{plan?.name} Pass</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">DURATION:</span>
                <span className="font-bold text-ink">{plan?.duration_months} Months</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">COMMISSION RATE:</span>
                <span className="font-bold text-done">0.00% (Guaranteed)</span>
              </div>
              <div className="border-t border-ink/20 pt-2 flex justify-between items-center font-bold text-sm">
                <span>AMOUNT PAID:</span>
                <span className="text-signal">₹{Number(lockedAmount).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onProceedToKyc) {
                  onProceedToKyc();
                } else {
                  if (onPaymentSuccess) onPaymentSuccess(activatedSub);
                  onClose();
                }
              }}
              className="btn-primary w-full min-h-[48px] font-bold text-xs uppercase tracking-wider cursor-pointer shadow-hard-xs"
            >
              {isUpgrade ? 'CONTINUE TO DASHBOARD →' : 'MOVE TO KYC VERIFICATION →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
