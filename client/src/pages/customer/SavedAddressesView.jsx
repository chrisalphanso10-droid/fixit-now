/**
 * FixIt Now - Saved Addresses Screen
 * Manage frequently used booking locations.
 * Conforms to SRS FR-C9 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  getSavedAddresses,
  addSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
} from '../../services/customerService';

export default function SavedAddressesView() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await getSavedAddresses();
      setAddresses(data);
    } catch (err) {
      console.error('Failed to load addresses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      setModalError('! Address label is required.');
      return;
    }
    if (!newAddress.trim()) {
      setModalError('! Street address is required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      await addSavedAddress({
        label: newLabel,
        address: newAddress,
        is_default: newIsDefault,
      });
      setShowAddModal(false);
      setNewAddress('');
      setNewLabel('Home');
      setNewIsDefault(false);
      await loadAddresses();
    } catch (err) {
      setModalError(`! ${err.message || 'Failed to save address.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (addr) => {
    try {
      await updateSavedAddress(addr.id, { is_default: true });
      await loadAddresses();
    } catch (err) {
      console.error('Failed to update default address:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSavedAddress(id);
      await loadAddresses();
    } catch (err) {
      console.error('Failed to delete address:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block mb-1">
            LOCATION REGISTER
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
            Saved Addresses
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setModalError(null);
            setShowAddModal(true);
          }}
          className="btn-primary min-h-[44px] text-xs px-5"
        >
          + Add New Address
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="ruler-strip animate-ruler-sweep my-4" />
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-24 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse"
            />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-12 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center space-y-4">
          <span className="stamp-badge bg-concrete text-ink border-ink mx-auto block w-max">
            NO SAVED ADDRESSES
          </span>
          <p className="font-mono text-sm text-[var(--theme-text-soft)] max-w-sm mx-auto">
            Save your home, office or rental properties to book with one click.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-primary min-h-[44px] text-xs"
          >
            Add Your First Address →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="p-5 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
                    {addr.label}
                  </span>
                  {addr.is_default && (
                    <span className="stamp-badge bg-signal text-ink border-ink text-[10px] py-0 px-1.5">
                      DEFAULT LOCATION
                    </span>
                  )}
                </div>
                <p className="text-sm font-mono text-[var(--theme-text-soft)] max-w-xl">
                  {addr.address}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr)}
                    className="btn-secondary py-1.5 px-3 text-xs min-h-[38px]"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  className="p-2 border-2 border-[var(--theme-border)] text-signal hover:bg-signal hover:text-ink transition-colors font-bold"
                  title="Delete address"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* ADD ADDRESS MODAL                                              */}
      {/* ============================================================== */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink p-6 max-w-md w-full shadow-hard text-ink space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <span className="font-mono text-xs font-bold uppercase text-signal">
                ADD SAVED ADDRESS
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <p className="font-mono text-xs font-bold text-signal">{modalError}</p>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-sans font-bold text-sm text-ink">
                  Address Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Home, Office, Studio"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-sans font-bold text-sm text-ink">
                  Full Street Address
                </label>
                <textarea
                  rows={3}
                  placeholder="Building / Flat, Street Name, Cross Road, Area, Bengaluru"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <label className="flex items-center gap-2 font-mono text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsDefault}
                  onChange={(e) => setNewIsDefault(e.target.checked)}
                  className="accent-signal w-4 h-4"
                />
                <span>Set as primary default location</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 min-h-[44px]"
                >
                  {submitting ? 'Saving...' : 'Save Address'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
