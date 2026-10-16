/**
 * FixIt Now - Customer Profile Screen
 * Editable customer personal record.
 * Conforms to SRS FR-C8 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getCustomerProfile, updateCustomerProfile } from '../../services/customerService';

export default function CustomerProfileView({ onProfileUpdated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getCustomerProfile();
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = '! Full name is required.';
    if (!phone.trim()) newErrors.phone = '! Phone number is required.';
    if (!address.trim()) newErrors.address = '! Primary address is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const updated = await updateCustomerProfile({ name, phone, address });
      setProfile(updated);
      setSavedBanner(true);
      if (onProfileUpdated) onProfileUpdated(updated);
      setTimeout(() => setSavedBanner(false), 3000);
    } catch (err) {
      setErrors({ form: `! ${err.message || 'Failed to update profile.'}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="h-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse w-48" />
        <div className="h-64 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b-2 border-[var(--theme-border)] pb-4">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block mb-1">
          CUSTOMER RECORD
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
          Profile Settings
        </h1>
      </div>

      {savedBanner && (
        <div className="p-4 bg-done text-paper border-2 border-done font-mono text-xs font-bold flex items-center justify-between">
          <span>✓ Profile record updated successfully!</span>
          <button type="button" onClick={() => setSavedBanner(false)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {errors.form && (
        <div className="p-4 bg-ink text-paper border-2 border-signal shadow-hard-signal font-mono text-xs font-bold">
          {errors.form}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
      >
        <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-signal border border-ink inline-block" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              CUSTOMER IDENTITY TICKET
            </span>
          </div>
          <span className="stamp-badge bg-[var(--theme-surface-sub)] text-[var(--theme-text-main)]">
            ACTIVE ACCOUNT
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="prof-name"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Full Name <span className="text-signal">*</span>
            </label>
            <input
              id="prof-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: null }));
              }}
              className="w-full"
            />
            {errors.name && (
              <p className="font-mono text-xs font-bold text-signal">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="prof-email"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Email Address (Login Account)
            </label>
            <input
              id="prof-email"
              type="email"
              value={email}
              disabled
              className="w-full bg-[var(--theme-surface-sub)] opacity-75 cursor-not-allowed font-mono text-xs"
            />
            <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block">
              Primary account email cannot be changed.
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="prof-phone"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Mobile Phone Number <span className="text-signal">*</span>
            </label>
            <input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((prev) => ({ ...prev, phone: null }));
              }}
              className="w-full"
            />
            {errors.phone && (
              <p className="font-mono text-xs font-bold text-signal">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="prof-address"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Primary Street Address <span className="text-signal">*</span>
            </label>
            <textarea
              id="prof-address"
              rows={3}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setErrors((prev) => ({ ...prev, address: null }));
              }}
              className="w-full text-sm"
            />
            {errors.address && (
              <p className="font-mono text-xs font-bold text-signal">{errors.address}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t-2 border-dashed border-[var(--theme-border)] flex items-center justify-between">
          <span className="font-mono text-xs text-[var(--theme-text-muted)]">
            Used for 2 km neighbourhood fixer dispatch.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary min-h-[44px] px-6 text-xs"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
