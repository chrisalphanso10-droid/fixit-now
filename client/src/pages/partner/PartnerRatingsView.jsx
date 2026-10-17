/**
 * FixIt Now - Partner Ratings & Customer Reviews Screen
 * Aggregate score, star distribution breakdown, and verified customer testimonials.
 * Conforms to SRS FR-P11 and docs/DESIGN.md.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPartnerRatings } from '../../services/partnerService';

export default function PartnerRatingsView({ partner }) {
  const [ratingsData, setRatingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRatings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPartnerRatings(partner?.id || 101);
      setRatingsData(data);
    } catch (err) {
      console.error('[PartnerRatingsView] Error:', err);
      setError(err.message || 'Failed to calculate ratings scorecard.');
    } finally {
      setLoading(false);
    }
  }, [partner?.id]);

  useEffect(() => {
    loadRatings();

    const handleUpdate = () => {
      loadRatings();
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('fixit_partner_ratings_updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('fixit_partner_ratings_updated', handleUpdate);
    };
  }, [loadRatings]);

  if (loading) {
    return (
      <div className="p-8 text-center border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
        <div className="inline-block w-6 h-6 border-2 border-signal border-t-transparent animate-spin mb-2" />
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--theme-text-soft)]">
          CALCULATING REPUTATION SCORECARD...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-3 font-mono">
        <div className="flex items-center gap-2 text-signal text-xs font-bold uppercase">
          <span>[!]</span>
          <span>Failed to load reputation scorecard</span>
        </div>
        <p className="font-sans text-sm text-[var(--theme-text-main)]">{error}</p>
        <button
          type="button"
          onClick={loadRatings}
          className="px-4 py-1.5 border-2 border-ink bg-ink text-paper text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const breakdown = ratingsData?.breakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const totalReviews = ratingsData?.total_reviews ?? 0;
  const averageRating = ratingsData?.average ?? 5.0;
  const reviewsList = ratingsData?.recent_reviews || ratingsData?.reviews || [];

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
                REPUTATION &amp; QUALITY METRICS
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Customer Ratings &amp; Feedback
            </h1>
          </div>

          <div className="border-2 border-signal bg-paper text-ink px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm self-start sm:self-auto">
            {totalReviews > 0 ? `${totalReviews} VERIFIED REVIEWS` : 'PRO TRADESPERSON'}
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Ratings are collected directly from customers following service completion and OTP verification. High ratings give your profile dispatch priority.
        </p>
      </div>

      {/* Aggregate Score & Star Distribution Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Big Score Box */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 shadow-hard flex flex-col justify-between"
          style={{ borderRadius: 0 }}
        >
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-soft)] block mb-1">
              AGGREGATE SCORE
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-black text-6xl text-[var(--theme-text-main)]">
                {averageRating.toFixed(1)}
              </span>
              <span className="font-mono text-lg text-signal font-bold">/ 5.0</span>
            </div>

            <div className="flex items-center gap-1 text-signal text-xl mt-2">
              {'★'.repeat(Math.round(averageRating))}
            </div>

            <p className="font-mono text-xs text-[var(--theme-text-soft)] mt-4">
              {totalReviews > 0
                ? `Based on ${totalReviews} authenticated customer job review${totalReviews === 1 ? '' : 's'}.`
                : 'No reviews yet. Complete your first customer work order to receive reviews.'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-[var(--theme-border)] space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--theme-text-soft)]">PUNCTUALITY:</span>
              <span className="font-bold text-done">100% On-Time</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--theme-text-soft)]">WORK GUARANTEE:</span>
              <span className="font-bold text-done">100% Completed</span>
            </div>
          </div>
        </div>

        {/* Right: Star Distribution Bar Breakdown */}
        <div
          className="md:col-span-2 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 shadow-hard"
          style={{ borderRadius: 0 }}
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)] block mb-4 border-b-2 border-[var(--theme-border)] pb-2">
            RATING DISTRIBUTION BREAKDOWN
          </span>

          <div className="space-y-3 font-mono text-xs">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = breakdown[stars] || 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

              return (
                <div key={stars} className="flex items-center gap-3">
                  <span className="w-12 font-bold text-[var(--theme-text-main)] shrink-0">
                    {stars} Star
                  </span>

                  {/* Bar container */}
                  <div className="flex-1 h-4 bg-[var(--theme-bg)] border border-[var(--theme-border)] overflow-hidden">
                    <div
                      className={`h-full ${stars >= 4 ? 'bg-signal' : 'bg-[var(--theme-text-soft)]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <span className="w-16 text-right font-bold text-[var(--theme-text-soft)] shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Verified Customer Feedback Reviews List */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="border-b-2 border-[var(--theme-border)] p-4 bg-[var(--theme-bg)] flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
            RECENT VERIFIED CUSTOMER REVIEWS
          </span>
          <span className="font-mono text-[11px] text-[var(--theme-text-soft)]">
            {reviewsList.length} review{reviewsList.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <div className="divide-y-2 divide-[var(--theme-border)]">
          {reviewsList.map((review) => (
            <div key={review.id} className="p-5 sm:p-6 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-[var(--theme-text-main)]">
                    {review.customer_name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-concrete border border-ink text-ink font-bold">
                    ORDER #{review.order_number || review.order_id}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-signal font-bold tracking-widest">
                    {'★'.repeat(review.stars)}
                  </span>
                  <span className="text-[var(--theme-text-muted)] text-[11px]">
                    {new Date(review.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <p className="font-sans text-sm text-[var(--theme-text-main)] leading-relaxed italic">
                &ldquo;{review.comment}&rdquo;
              </p>
            </div>
          ))}

          {reviewsList.length === 0 && (
            <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-soft)]">
              No customer reviews received yet. Reviews will show up here after service completion.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
