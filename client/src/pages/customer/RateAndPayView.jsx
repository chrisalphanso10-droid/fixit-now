/**
 * FixIt Now - Rate & Digital Work Order Receipt Screen
 * Simulated payment lifecycle (proceed -> waiting -> successful),
 * receipt generation, and customer rating (stars + optional comment).
 * Conforms to SRS FR-C17, FR-C18 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  submitRequestRating,
  processSimulatedPayment,
  getRequestReceipt,
} from '../../services/requestService';

export default function RateAndPayView({
  activeRequest,
  onNavigate,
  onRatingSubmitted,
}) {
  // Check if payment already completed
  const initialPaymentDone =
    activeRequest?.status === 'payment_completed' ||
    Boolean(activeRequest?.receipt_no) ||
    Boolean(activeRequest?.payment_confirmed);

  const [paymentState, setPaymentState] = useState(
    initialPaymentDone ? 'successful' : 'proceed'
  ); // 'proceed' | 'waiting' | 'successful'
  const [paymentMethod, setPaymentMethod] = useState('Direct UPI (On-site)');
  const [receiptData, setReceiptData] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('Excellent service! Arrived promptly and fixed the issue cleanly.');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const rawPartner = activeRequest?.partner || {};
  const partner = {
    name: rawPartner.name || activeRequest?.partner_name || 'Rajesh Kumar',
    service_name: rawPartner.service_name || activeRequest?.service_name || 'Plumbing Repairs',
    badge: rawPartner.badge || activeRequest?.partner_badge || 'Certified Master Plumber',
    vehicle: rawPartner.vehicle || activeRequest?.partner_vehicle || 'Service Vehicle',
    phone: rawPartner.phone || activeRequest?.partner_phone || '+91 98450 11223',
  };

  const orderNumber =
    activeRequest?.order_number ||
    `ORD-${String(activeRequest?.id || '0428').replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  // If already paid, fetch receipt
  useEffect(() => {
    let isMounted = true;
    if (activeRequest?.id && (initialPaymentDone || paymentState === 'successful')) {
      getRequestReceipt(activeRequest.id)
        .then((data) => {
          if (isMounted && data) setReceiptData(data);
        })
        .catch(() => {
          // ignore fallback
        });
    }
    return () => {
      isMounted = false;
    };
  }, [activeRequest?.id, initialPaymentDone, paymentState]);

  // Handle proceed to simulated payment
  const handleProceedPayment = async () => {
    if (!activeRequest?.id) return;
    setPaymentLoading(true);
    setPaymentError(null);

    try {
      // 1. Send 'proceed' state
      await processSimulatedPayment(activeRequest.id, {
        payment_method: paymentMethod,
        state: 'proceed',
      });
      setPaymentState('waiting');

      // 2. Send 'waiting' state
      await processSimulatedPayment(activeRequest.id, {
        payment_method: paymentMethod,
        state: 'waiting',
      });

      // 3. Simulate on-site settlement delay (1.2s)
      setTimeout(async () => {
        try {
          const res = await processSimulatedPayment(activeRequest.id, {
            payment_method: paymentMethod,
            state: 'successful',
          });
          if (res?.receipt) {
            setReceiptData(res.receipt);
          }
          setPaymentState('successful');
          setPaymentLoading(false);
        } catch (err) {
          setPaymentError(err.message || 'Payment confirmation failed.');
          setPaymentLoading(false);
          setPaymentState('proceed');
        }
      }, 1200);
    } catch (err) {
      setPaymentError(err.message || 'Failed to initialize payment.');
      setPaymentLoading(false);
      setPaymentState('proceed');
    }
  };

  // Handle rating submission
  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!activeRequest?.id) return;
    setSubmittingRating(true);

    try {
      await submitRequestRating(activeRequest.id, {
        stars,
        comment,
        requestData: activeRequest,
      });
      setRatingSubmitted(true);
      if (onRatingSubmitted) onRatingSubmitted();
      setTimeout(() => {
        onNavigate('history');
      }, 1200);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* ============================================================== */}
      {/* 1. SIMULATED PAYMENT LIFECYCLE (SRS FR-C18)                     */}
      {/* ============================================================== */}
      {paymentState === 'proceed' && (
        <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-signal inline-block border-2 border-ink" />
              <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
                DIRECT ON-SITE PAYMENT · {orderNumber}
              </span>
            </div>
            <span className="stamp-badge bg-signal text-ink border-ink text-xs">
              STEP 5: READY FOR SETTLEMENT
            </span>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-ink">
              Settle with {partner.name}
            </h2>
            <p className="text-xs sm:text-sm text-soft font-mono max-w-lg mx-auto">
              Work inspection has been completed. Settle directly with your certified partner on-site. FixIt Now takes 0% commission.
            </p>
          </div>

          {/* Work order summary */}
          <div className="p-4 bg-concrete border-2 border-ink font-mono text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted uppercase">WORK ORDER:</span>
              <span className="font-bold text-ink">{orderNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted uppercase">TRADE SERVICE:</span>
              <span className="font-bold text-ink">{activeRequest?.service_name || 'Home Repair'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted uppercase">CERTIFIED FIXER:</span>
              <span className="font-bold text-ink">{partner.name}</span>
            </div>
            <div className="flex justify-between items-center border-t border-ink/20 pt-2">
              <span className="text-muted uppercase">SETTLEMENT POLICY:</span>
              <span className="font-bold text-done uppercase">Direct Cash or UPI On-site</span>
            </div>
          </div>

          {paymentError && (
            <div className="p-3 border-2 border-signal bg-signal/10 text-ink font-mono text-xs">
              [!] {paymentError}
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="font-mono text-xs font-bold uppercase text-ink block">
              Select Settlement Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('Direct Cash (On-site)')}
                className={`p-4 border-2 font-mono text-xs font-bold uppercase flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  paymentMethod.includes('Cash')
                    ? 'bg-signal text-ink border-ink shadow-hard-sm'
                    : 'bg-paper text-ink border-ink/40 hover:border-ink'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none" strokeWidth="2" aria-hidden="true">
                  <rect x="2" y="6" width="20" height="12" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M6 12h.01M18 12h.01" />
                </svg>
                <span>Direct Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Direct UPI (On-site)')}
                className={`p-4 border-2 font-mono text-xs font-bold uppercase flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  paymentMethod.includes('UPI')
                    ? 'bg-signal text-ink border-ink shadow-hard-sm'
                    : 'bg-paper text-ink border-ink/40 hover:border-ink'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none" strokeWidth="2" aria-hidden="true">
                  <rect x="5" y="2" width="14" height="20" />
                  <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
                </svg>
                <span>Direct UPI / QR</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={paymentLoading}
            onClick={handleProceedPayment}
            className="btn-primary w-full min-h-[50px] uppercase font-mono tracking-wider text-sm font-bold shadow-hard cursor-pointer"
          >
            {paymentLoading ? 'PROCESSING...' : 'PROCEED TO SETTLEMENT →'}
          </button>
        </div>
      )}

      {/* WAITING STATE */}
      {paymentState === 'waiting' && (
        <div className="bg-paper border-2 border-ink p-8 shadow-hard text-ink text-center space-y-6">
          <div className="stamp-badge bg-signal text-ink border-ink text-xs inline-block">
            WAITING FOR SETTLEMENT HANDSHAKE
          </div>
          <div className="py-6 space-y-4">
            <div className="inline-block w-12 h-12 border-4 border-signal border-t-transparent animate-spin" />
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-ink">
              Waiting for On-Site Settlement Confirmation...
            </h2>
            <p className="font-mono text-xs text-soft max-w-md mx-auto leading-relaxed">
              Exchanging on-site confirmation with partner ({paymentMethod}). Your official digital receipt is being generated.
            </p>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SUCCESSFUL STATE & WORK ORDER RECEIPT TICKET (SRS FR-C18)    */}
      {/* ============================================================== */}
      {paymentState === 'successful' && (
        <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
          {/* Header Ticket Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 bg-paper border-2 border-ink inline-block" />
              <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink">
                WORK ORDER RECEIPT · {receiptData?.receipt_no || `REC-${orderNumber.slice(4)}-01`}
              </span>
            </div>

            {/* Prominent Payment Confirmed Stamp */}
            <span className="stamp-badge bg-done text-paper border-done">
              ✓ PAYMENT CONFIRMED
            </span>
          </div>

          {/* Confirmation banner explaining direct off-site settlement */}
          <div className="p-4 bg-concrete border border-ink space-y-1">
            <span className="font-mono text-xs font-bold uppercase text-signal block">
              SETTLEMENT POLICY VERIFIED
            </span>
            <p className="text-xs sm:text-sm text-soft font-mono">
              Payment has been settled directly between you and the service partner on-site. The FixIt Now platform takes 0% commission.
            </p>
          </div>

          {/* Service & Partner Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs border-b-2 border-dashed border-ink pb-6">
            <div>
              <span className="text-muted block uppercase">RECEIPT NUMBER:</span>
              <span className="font-bold text-sm text-ink block">
                {receiptData?.receipt_no || `REC-${orderNumber.slice(4)}-${Math.floor(1000 + Math.random() * 9000)}`}
              </span>
              <span className="text-soft block mt-0.5">Order Ref: {orderNumber}</span>
            </div>

            <div>
              <span className="text-muted block uppercase">SETTLEMENT METHOD:</span>
              <span className="font-bold text-sm text-ink block">
                {receiptData?.payment_method || paymentMethod}
              </span>
              <span className="text-done block font-bold mt-0.5">Status: Paid &amp; Settled</span>
            </div>

            <div>
              <span className="text-muted block uppercase">SERVICE RENDERED:</span>
              <span className="font-bold text-base text-ink block">
                {activeRequest?.service_name || 'Home Repair'}
              </span>
              <span className="text-soft block mt-1">{activeRequest?.problem}</span>
            </div>

            <div>
              <span className="text-muted block uppercase">CERTIFIED FIXER:</span>
              <span className="font-bold text-base text-ink block">{partner.name}</span>
              <span className="text-soft block mt-1">{partner.badge}</span>
            </div>

            <div>
              <span className="text-muted block uppercase">SERVICE ADDRESS:</span>
              <span className="text-ink font-bold block">{activeRequest?.address}</span>
            </div>

            <div>
              <span className="text-muted block uppercase">SETTLED TIMESTAMP:</span>
              <span className="text-ink font-bold block">
                {new Date().toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>

          {/* Print / Save Receipt Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 border border-ink bg-concrete text-ink font-mono text-xs font-bold uppercase hover:bg-signal cursor-pointer"
            >
              Print / Save Receipt
            </button>
          </div>

          {/* ============================================================ */}
          {/* 3. PARTNER RATING FORM (SRS FR-C17)                          */}
          {/* ============================================================ */}
          {ratingSubmitted ? (
            <div className="p-6 bg-concrete border-2 border-done text-center space-y-2">
              <span className="font-display font-extrabold text-2xl text-done block">
                ✓ Rating Submitted!
              </span>
              <p className="font-mono text-xs text-soft">
                Work order closed and archived to your request history.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitRating} className="space-y-6 pt-2">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block mb-3">
                  Rate Your Partner&apos;s Workmanship
                </span>

                {/* 5 Star Interactive Rating */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setStars(star)}
                      className="w-11 h-11 border-2 border-ink flex items-center justify-center font-display font-black text-xl transition-all hover:bg-signal cursor-pointer"
                      style={{
                        backgroundColor: star <= stars ? '#FF5B14' : '#FBFAF6',
                        color: star <= stars ? '#111418' : '#6B7079',
                      }}
                      title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="font-mono text-xs font-bold uppercase ml-3 text-ink">
                    {stars === 5
                      ? '5/5 · Excellent'
                      : stars === 4
                      ? '4/5 · Good Work'
                      : stars === 3
                      ? '3/5 · Average'
                      : stars === 2
                      ? '2/5 · Needs Improvement'
                      : '1/5 · Poor Service'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="rating-comment" className="block font-sans font-bold text-sm text-ink">
                  Feedback &amp; Repair Notes (Optional)
                </label>
                <textarea
                  id="rating-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share any comments about the partner's punctuality and work quality..."
                  className="w-full text-sm"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm cursor-pointer"
                >
                  {submittingRating ? 'Archiving...' : 'Submit Rating & Close Ticket →'}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-xs font-mono font-bold uppercase underline text-soft hover:text-signal cursor-pointer"
                >
                  View Request History →
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
