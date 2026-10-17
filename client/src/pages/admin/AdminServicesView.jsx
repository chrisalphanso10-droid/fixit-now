/**
 * FixIt Now - Admin Service Categories Management View
 * Conforms to SRS FR-A6:
 * - Manage 8 service categories
 * - Active / disabled toggles
 * - Manage 8 service categories
 * - Active / disabled toggles
 * - Edit category name and description
 * - Add new category modal with input validation
 * - Desktop-first layout; stacked cards under md
 */

import { useState, useEffect } from 'react';
import {
  getAdminServices,
  toggleServiceStatus,
  updateServiceCategory,
  createServiceCategory,
} from '../../services/adminService';

export default function AdminServicesView() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit category modal state
  const [editingCategory, setEditingCategory] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', description: '' });

  // Add category modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCatData, setNewCatData] = useState({ name: '', description: '' });

  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const loadServices = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminServices();
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message || 'Failed to load service categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleToggleActive = async (id, name, currentActive) => {
    try {
      await toggleServiceStatus(id);
      setSuccessToast(`Service "${name}" is now ${!currentActive ? 'ACTIVE' : 'DISABLED'}.`);
      setTimeout(() => setSuccessToast(null), 3500);
      await loadServices();
    } catch (err) {
      alert(err.message || 'Failed to toggle service status.');
    }
  };

  const openEditModal = (service) => {
    setEditingCategory(service);
    setEditFormData({
      name: service.name,
      description: service.description,
    });
    setModalError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setActionLoading(true);

    try {
      await updateServiceCategory(editingCategory.id, {
        name: editFormData.name,
        description: editFormData.description,
        base_price_estimate: editingCategory.base_price_estimate || 0,
      });
      setEditingCategory(null);
      setSuccessToast(`Service category updated successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadServices();
    } catch (err) {
      setModalError(err.message || 'Failed to update category.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setModalError(null);
    setActionLoading(true);

    try {
      await createServiceCategory({
        ...newCatData,
        base_price_estimate: 0,
      });
      setAddModalOpen(false);
      setNewCatData({ name: '', description: '' });
      setSuccessToast(`New category "${newCatData.name}" created!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadServices();
    } catch (err) {
      setModalError(err.message || 'Failed to create category.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            MARKETPLACE CATALOG · FR-A6
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Service Categories
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddModalOpen(true);
            setModalError(null);
          }}
          className="btn-primary px-4 py-2 text-xs font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto min-h-[44px]"
        >
          <span>+</span> ADD CATEGORY
        </button>
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

      {loadError && (
        <div className="p-4 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-signal font-bold uppercase">
            <span>[!]</span>
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadServices}
            className="px-3 py-1.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Categories Grid */}
      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [LOADING REGISTERED SERVICE CATEGORIES...]
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {services.map((service) => (
            <div
              key={service.id}
              className={`border-2 border-[var(--theme-border)] p-5 shadow-hard flex flex-col justify-between transition-colors ${
                service.active ? 'bg-[var(--theme-surface)]' : 'bg-[var(--theme-surface-sub)] opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-3">
                  <span className="font-mono text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest">
                    ID #{service.id} · {service.slug}
                  </span>
                  <span
                    className={`stamp-badge text-[9px] px-1.5 py-0 border ${
                      service.active
                        ? 'border-done text-done bg-[#EAF8F0] dark:bg-[#0D2E1A]'
                        : 'border-[#B83A14] text-[#B83A14] bg-[#FFEBEB] dark:bg-[#3D1414]'
                    }`}
                  >
                    {service.active ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <h3 className="text-xl font-display font-extrabold text-[var(--theme-text-main)] mb-1">
                  {service.name}
                </h3>
                <p className="text-xs text-[var(--theme-text-soft)] leading-relaxed mb-4 line-clamp-3">
                  {service.description}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[var(--theme-border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(service)}
                  className="font-mono text-xs font-bold text-signal hover:underline py-2"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(service.id, service.name, service.active)}
                  className={`px-3 py-1.5 border font-mono text-xs font-bold transition-colors min-h-[36px] ${
                    service.active
                      ? 'border-[#B83A14] text-[#B83A14] hover:bg-[#B83A14] hover:text-paper'
                      : 'border-done text-done hover:bg-done hover:text-paper'
                  }`}
                >
                  {service.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT CATEGORY MODAL                                            */}
      {/* ============================================================== */}
      {editingCategory && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 max-w-md w-full shadow-hard relative">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                MODIFY CATEGORY · #{editingCategory.id}
              </span>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="w-7 h-7 border border-[var(--theme-border)] font-mono font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#FFEBEB] dark:bg-[#3D1414] border-2 border-[#B83A14] text-[#B83A14] text-xs font-mono font-bold mb-4">
                ! {modalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1">
                  Category Title
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2.5 text-xs font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1">
                  Scope &amp; Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2.5 text-xs font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary flex-1 py-2.5 text-xs font-mono font-bold min-h-[44px]"
                >
                  {actionLoading ? 'Saving...' : 'Save Category Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="btn-secondary sm:w-auto px-5 py-2.5 text-xs font-mono font-bold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ADD CATEGORY MODAL                                             */}
      {/* ============================================================== */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 max-w-md w-full shadow-hard relative">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                CREATE SERVICE CATEGORY · FR-A6
              </span>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="w-7 h-7 border border-[var(--theme-border)] font-mono font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#FFEBEB] dark:bg-[#3D1414] border-2 border-[#B83A14] text-[#B83A14] text-xs font-mono font-bold mb-4">
                ! {modalError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1">
                  Category Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solar Panel Maintenance"
                  value={newCatData.name}
                  onChange={(e) => setNewCatData({ ...newCatData, name: e.target.value })}
                  className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2.5 text-xs font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1">
                  Scope &amp; Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Rooftop panel cleaning, inverter troubleshooting, wiring inspection."
                  value={newCatData.description}
                  onChange={(e) => setNewCatData({ ...newCatData, description: e.target.value })}
                  className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-2.5 text-xs font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary flex-1 py-2.5 text-xs font-mono font-bold min-h-[44px]"
                >
                  {actionLoading ? 'Creating...' : 'Create & Publish Category'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn-secondary sm:w-auto px-5 py-2.5 text-xs font-mono font-bold min-h-[44px]"
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
