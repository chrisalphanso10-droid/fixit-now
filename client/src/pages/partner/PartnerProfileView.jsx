/**
 * FixIt Now - Partner Profile Management Screen
 * Editable personal details and locked single certified trade category per SRS FR-P1.
 * Conforms to docs/DESIGN.md and SRS FR-P1, FR-P11.
 */

import { useState } from 'react';
import { updatePartnerProfile } from '../../services/partnerService';

export default function PartnerProfileView({ partner, onProfileUpdated }) {
  const [name, setName] = useState(partner?.name || 'Rajesh Kumar');
  const [phone, setPhone] = useState(partner?.phone || '+91 98765 43210');
  const [address, setAddress] = useState(
    partner?.address || '12, 4th Main, Domlur Layout, Bengaluru, Karnataka 560071'
  );
  const [vehicle, setVehicle] = useState(
    partner?.vehicle || 'Hero Splendor Plus (KA-01-EQ-4421)'
  );

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updated = await updatePartnerProfile(partner?.id || 101, {
        name,
        phone,
        address,
        vehicle,
      });

      setSuccessMsg('Partner profile updated successfully!');
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setErrorMsg(`! ${err.message || 'Failed to update profile.'}`);
    } finally {
      setSaving(false);
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
                PARTNER CREDENTIALS &amp; DOSSIER
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Partner Identity Profile
            </h1>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
            <span className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 font-bold">
              ID: PTR-{partner?.id || 101}
            </span>
            <span className="border-2 border-done bg-done text-paper px-2.5 py-1 font-bold uppercase">
              {partner?.kyc_status || 'VERIFIED'}
            </span>
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Maintain your verified contact information, emergency mobile line, and service vehicle details.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="border-2 border-done bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Main Profile Form */}
      <form
        onSubmit={handleSave}
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
        style={{ borderRadius: 0 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="partner-name"
              className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
            >
              Full Legal Name <span className="text-signal">*</span>
            </label>
            <input
              id="partner-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
            />
          </div>

          <div>
            <label
              htmlFor="partner-phone"
              className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
            >
              Registered Phone <span className="text-signal">*</span>
            </label>
            <input
              id="partner-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="partner-email"
              className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
            >
              Email Address (Login ID)
            </label>
            <input
              id="partner-email"
              type="email"
              disabled
              value={partner?.email || 'rajesh@example.com'}
              className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-soft)] font-mono text-sm opacity-60 cursor-not-allowed"
            />
            <span className="font-mono text-[10px] text-[var(--theme-text-muted)] mt-1 block">
              Email is permanently bound to partner KYC dossier.
            </span>
          </div>

          <div>
            <label
              htmlFor="partner-vehicle"
              className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
            >
              Vehicle / Transport Mode <span className="text-signal">*</span>
            </label>
            <input
              id="partner-vehicle"
              type="text"
              required
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g., Hero Splendor (KA-01-EQ-4421)"
              className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* SRS FR-P1: LOCKED SINGLE CERTIFIED SERVICE CATEGORY            */}
        {/* ============================================================== */}
        <div className="border-2 border-[var(--theme-border)] p-4 sm:p-5 bg-[var(--theme-bg)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              CERTIFIED TRADE CATEGORY (SRS FR-P1)
            </span>
            <span className="font-mono text-[10px] bg-ink text-paper px-2 py-0.5 font-bold uppercase">
              LOCKED &amp; VERIFIED
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-8 h-8 bg-signal border border-ink flex items-center justify-center font-bold text-ink text-sm">
              ★
            </div>
            <div>
              <div className="font-display font-extrabold text-lg text-[var(--theme-text-main)]">
                {partner?.service_name || 'Plumbing Repairs'}
              </div>
              <div className="font-mono text-xs text-[var(--theme-text-soft)]">
                Accredited via Trade Qualification Certificate on file
              </div>
            </div>
          </div>

          <p className="font-mono text-[11px] text-[var(--theme-text-muted)] leading-relaxed pt-2 border-t border-[var(--theme-border)]">
            Per FixIt Now Rule <strong>FR-P1</strong>, each partner is certified in exactly one trade category to guarantee maximum craft quality. To change your trade category or certify in another domain, an administrative re-assessment is required via compliance desk (support@fixitnow.local).
          </p>
        </div>

        <div>
          <label
            htmlFor="partner-address"
            className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
          >
            Base Operating Station &amp; Address <span className="text-signal">*</span>
          </label>
          <textarea
            id="partner-address"
            rows={2}
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary min-h-[48px] px-8 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
        >
          {saving ? 'SAVING PROFILE CHANGES...' : 'SAVE PROFILE CHANGES →'}
        </button>
      </form>
    </div>
  );
}
