/**
 * FixIt Now - Rate & Digital Work Order Receipt Screen
 * Conforms to SRS FR-C17, FR-C18 and explicit user direction:
 * Customer settles directly with partner on-site; only the completion confirmation reflects on the site.
 */

import { useState } from 'react';
import { submitRequestRating } from '../../services/requestService';

export default function RateAndPayView({
  activeRequest,
  onNavigate,
  onRatingSubmitted,
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('Excellent service! Arrived promptly and fixed the issue.');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const partner = activeRequest?.partner || {
    name: 'Rajesh Kumar',
    service_name: activeRequest?.service_name || 'Plumbing Repairs',
    badge: 'Certified Master Plumber',
    vehicle: 'Bajaj Pulsar (KA-03-HJ-4421)',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeRequest) {
        await submitRequestRating(activeRequest.id, { stars, comment });
      }
      setCompleted(true);
      if (onRatingSubmitted) onRatingSubmitted();
      setTimeout(() => {
        onNavigate('history');
      }, 1200);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* ============================================================== */}
      {/* 1. DIGITAL WORK ORDER RECEIPT TICKET (DESIGN.md Section 5 & 6)  */}
      {/* ============================================================== */}
      <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
        {/* Header Ticket Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-paper border-2 border-ink inline-block" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink">
              WORK ORDER RECEIPT · {activeRequest?.order_number || 'ORD-0427'}
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
            Payment has been settled directly between you and the service partner on-site. The
            FixIt Now platform does not collect commissions or process service charges online.
          </p>
        </div>

        {/* Service & Partner Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs border-b-2 border-dashed border-ink pb-6">
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
            <span className="text-muted block uppercase">COMPLETION TIMESTAMP:</span>
            <span className="text-ink font-bold block">
              {new Date().toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. PARTNER RATING FORM (SRS FR-C17)                          */}
        {/* ============================================================ */}
        {completed ? (
          <div className="p-6 bg-concrete border-2 border-done text-center space-y-2">
            <span className="font-display font-extrabold text-2xl text-done block">
              ✓ Rating Submitted!
            </span>
            <p className="font-mono text-xs text-soft">
              Work order closed and archived to your history ticket stack.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
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
                    className="w-11 h-11 border-2 border-ink flex items-center justify-center font-display font-black text-xl transition-all hover:bg-signal"
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
                Feedback &amp; Repair Notes
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
                disabled={submitting}
                className="btn-primary w-full sm:w-auto min-h-[48px] px-8 text-sm"
              >
                {submitting ? 'Archiving...' : 'Submit Rating & Close Ticket →'}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-mono font-bold uppercase underline text-soft hover:text-signal"
              >
                Skip for now
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
