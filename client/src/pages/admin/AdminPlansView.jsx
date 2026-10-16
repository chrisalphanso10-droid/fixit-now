/**
 * FixIt Now - Admin Plans and Prices View
 * Conforms to SRS FR-A5, BR-1, BR-2:
 * - Admin can change plan prices for Quarterly, Half-yearly, and Yearly.
 * - Prominent BR-2 rule banner: price modifications apply strictly to new subscriptions only.
 * - In-place editing with input validation and instant audit logging.
 */

import { useState, useEffect } from 'react';
import { getAdminPlans, updatePlanPrice } from '../../services/adminService';

export default function AdminPlansView() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await getAdminPlans();
      setPlans(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const startEdit = (plan) => {
    setEditingPlanId(plan.id);
    setNewPrice(String(plan.price));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingPlanId(null);
    setNewPrice('');
    setSaveError(null);
  };

  const handleSavePrice = async (planId) => {
    const val = parseFloat(newPrice);
    if (isNaN(val) || val <= 0) {
      setSaveError('Please enter a valid price in rupees (greater than 0).');
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    try {
      const updated = await updatePlanPrice(planId, val);
      setEditingPlanId(null);
      setSuccessToast(`Plan "${updated.name}" updated to ₹${updated.price}. Rule BR-2 enforced for new subscribers.`);
      setTimeout(() => setSuccessToast(null), 5000);
      await loadPlans();
    } catch (err) {
      setSaveError(err.message || 'Failed to update plan price.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            REVENUE CONFIGURATION · FR-A5
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Partner Subscription Plans &amp; Prices
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-soft)]">
          PLATFORM REVENUE: 100% SUBSCRIPTIONS (0% JOB CUT)
        </div>
      </div>

      {/* ============================================================== */}
      {/* MANDATORY BR-2 RULE BANNER                                     */}
      {/* ============================================================== */}
      <div className="bg-[#FFF5F2] dark:bg-[#2D1610] border-2 border-signal p-4 shadow-hard-sm">
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 bg-signal text-paper font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            !
          </span>
          <div className="space-y-1">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
              RULE BR-2 ENFORCEMENT PROTOCOL:
            </h3>
            <p className="font-sans text-sm text-[var(--theme-text-main)] leading-relaxed">
              Price adjustments made on this console apply <strong>strictly to new subscriptions</strong>.
              Existing subscribed partners keep the historical rate they paid until their active plan expires (BR-2).
              No retroactive charges or automatic billing modifications are permitted.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-3 bg-[#EAF8F0] dark:bg-[#0E3A20] border-2 border-done text-done text-xs font-mono font-bold flex items-center justify-between shadow-hard-sm">
          <span>✓ {successToast}</span>
          <button type="button" onClick={() => setSuccessToast(null)} className="underline">
            ✕ Close
          </button>
        </div>
      )}

      {/* Plans Pricing Grid */}
      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [FETCHING SUBSCRIPTION TIER DEFINITIONS...]
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isEditing = editingPlanId === plan.id;
            const monthlyEquivalent = Math.round(plan.price / plan.duration_months);

            return (
              <div
                key={plan.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 shadow-hard flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                      TIER #{plan.id}
                    </span>
                    <span className="stamp-badge border-[var(--theme-border)] text-xs">
                      {plan.duration_months} MONTHS
                    </span>
                  </div>

                  <h3 className="text-2xl font-display font-extrabold text-[var(--theme-text-main)] mb-1">
                    {plan.name} Pass
                  </h3>
                  <p className="font-mono text-xs text-[var(--theme-text-muted)] mb-6">
                    Duration: {plan.duration_months * 30} days of 2km radar matching
                  </p>

                  {/* Price Block / Editor */}
                  {isEditing ? (
                    <div className="p-4 bg-[var(--theme-surface-sub)] border-2 border-signal mb-6 space-y-3">
                      <label
                        htmlFor={`edit-price-${plan.id}`}
                        className="block font-mono text-xs font-bold uppercase text-signal"
                      >
                        Adjust New Subscription Price (₹)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-[var(--theme-text-main)]">₹</span>
                        <input
                          id={`edit-price-${plan.id}`}
                          type="number"
                          step="1"
                          min="1"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2 font-mono text-lg font-bold text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                        />
                      </div>

                      {saveError && (
                        <div className="text-[11px] font-mono text-[#B83A14] font-bold">
                          ! {saveError}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={saveLoading}
                          onClick={() => handleSavePrice(plan.id)}
                          className="btn-primary flex-1 py-2 text-xs font-mono font-bold min-h-[38px]"
                        >
                          {saveLoading ? 'Saving...' : 'Save & Publish (BR-2)'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="btn-secondary px-3 py-2 text-xs font-mono font-bold min-h-[38px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-lg text-[var(--theme-text-muted)]">₹</span>
                        <span className="text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
                          {plan.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-[var(--theme-text-soft)] mt-1">
                        ~₹{monthlyEquivalent} per month equivalent
                      </div>
                    </div>
                  )}

                  {/* Feature Checklist */}
                  <ul className="space-y-2 font-mono text-xs text-[var(--theme-text-soft)] border-t border-[var(--theme-border)] pt-4 mb-6">
                    <li className="flex items-center gap-2">
                      <span className="text-done font-bold">✓</span> 0% commission on all completed repairs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-done font-bold">✓</span> Full access to 2 km neighborhood job radar
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-done font-bold">✓</span> Real-time simulated navigation &amp; tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-done font-bold">✓</span> Verified profile badge on customer tickets
                    </li>
                  </ul>
                </div>

                {/* Edit Button */}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(plan)}
                    className="btn-secondary w-full py-2.5 text-xs font-mono font-bold min-h-[44px]"
                  >
                    Adjust Plan Price →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Business Model Clarification */}
      <div className="p-4 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] font-mono text-xs text-[var(--theme-text-soft)] space-y-2">
        <div className="font-bold text-[var(--theme-text-main)] uppercase tracking-wider">
          ARCHITECTURAL REVENUE NOTE (SRS SECTION 7 · BR-1, BR-3, BR-4):
        </div>
        <p>
          FixIt Now operates on zero percentage cuts from labor. Partners keep 100% of customer settlements on-site.
          Longer duration plans are priced cheaper per month to encourage long-term retention.
          Partners with an expired plan are locked out of job dispatch until renewed (BR-4).
        </p>
      </div>
    </div>
  );
}
