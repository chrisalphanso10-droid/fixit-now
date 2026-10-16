/**
 * FixIt Now - Create Request Screen
 * Customer job order creation wizard.
 * Conforms to SRS FR-C6, FR-C9 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import { getServices } from '../../services/serviceService';
import { getSavedAddresses } from '../../services/customerService';
import { createServiceRequest } from '../../services/requestService';

export default function CreateRequestView({
  initialService,
  onNavigate,
  onRequestCreated,
}) {
  const [services, setServices] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialService ? initialService.id : null
  );
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAddressMode, setSelectedAddressMode] = useState('saved'); // 'saved' | 'custom'
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [customAddress, setCustomAddress] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadFormPrerequisites() {
      const [servs, addrs] = await Promise.all([
        getServices(),
        getSavedAddresses(),
      ]);
      setServices(servs);
      setSavedAddresses(addrs);
      if (!selectedServiceId && servs.length > 0) {
        setSelectedServiceId(initialService ? initialService.id : servs[0].id);
      }
      if (addrs.length > 0) {
        const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
        setSelectedAddressId(defaultAddr.id);
      } else {
        setSelectedAddressMode('custom');
      }
    }
    loadFormPrerequisites();
  }, [initialService, selectedServiceId]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, photo: '! Please select an image file (PNG/JPEG).' }));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result);
        setErrors((prev) => ({ ...prev, photo: null }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!selectedServiceId) {
      newErrors.service = '! Please pick a trade category.';
    }
    if (!problem.trim()) {
      newErrors.problem = '! Problem title is required (e.g. Broken pipe leak).';
    }
    if (!description.trim()) {
      newErrors.description = '! Please describe the fault in detail.';
    }

    let finalAddress = '';
    if (selectedAddressMode === 'saved') {
      const chosen = savedAddresses.find((a) => a.id === Number(selectedAddressId));
      if (!chosen) {
        newErrors.address = '! Please select a saved address.';
      } else {
        finalAddress = chosen.address;
      }
    } else {
      if (!customAddress.trim()) {
        newErrors.address = '! Please enter the service street address.';
      } else {
        finalAddress = customAddress.trim();
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const selectedService = services.find((s) => s.id === Number(selectedServiceId));
      const request = await createServiceRequest({
        service_id: selectedServiceId,
        service_name: selectedService?.name || 'Trade Service',
        problem,
        description,
        address: finalAddress,
        coordinates: { lat: 12.9784, lng: 77.6408 },
        photo_url: photoPreview,
      });

      if (onRequestCreated) {
        onRequestCreated(request);
      }
      onNavigate('searching');
    } catch (err) {
      setErrors({ form: `! ${err.message || 'Failed to dispatch request.'}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Work Order Ticket Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block mb-1">
            WORK ORDER INTAKE · IMMEDIATE DISPATCH
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--theme-text-main)]">
            Create Service Request
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="font-mono text-xs font-bold uppercase underline hover:text-signal text-[var(--theme-text-muted)]"
        >
          Cancel
        </button>
      </div>

      {errors.form && (
        <div className="p-4 bg-ink text-paper border-2 border-signal shadow-hard-signal font-mono text-xs font-bold">
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ============================================================ */}
        {/* 1. SELECT TRADE CATEGORY                                     */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
            1. Select Trade Category <span className="text-signal">*</span>
          </label>
          {errors.service && (
            <p className="font-mono text-xs font-bold text-signal">{errors.service}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {services.map((svc) => {
              const isSelected = Number(selectedServiceId) === svc.id;
              return (
                <button
                  type="button"
                  key={svc.id}
                  onClick={() => {
                    setSelectedServiceId(svc.id);
                    setErrors((prev) => ({ ...prev, service: null }));
                  }}
                  className={`p-3 border-2 text-left font-mono text-xs font-bold uppercase tracking-wider flex flex-col justify-between min-h-[76px] transition-all ${
                    isSelected
                      ? 'bg-signal text-ink border-[var(--theme-border)] shadow-hard-sm'
                      : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-[var(--theme-surface-sub)]'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="font-display font-extrabold text-sm normal-case">
                    {svc.name}
                  </span>
                  <span className="text-[10px] opacity-75 mt-2">
                    {isSelected ? '✓ SELECTED' : 'CHOOSE'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. PROBLEM & DESCRIPTION                                     */}
        {/* ============================================================ */}
        <div className="space-y-4 p-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            2. Describe the Fault
          </span>

          <div className="space-y-1.5">
            <label
              htmlFor="req-problem"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Problem Summary <span className="text-signal">*</span>
            </label>
            <input
              id="req-problem"
              type="text"
              placeholder="e.g. Kitchen sink drain leaking profusely under basin"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value);
                setErrors((prev) => ({ ...prev, problem: null }));
              }}
              className="w-full"
            />
            {errors.problem && (
              <p className="font-mono text-xs font-bold text-signal">{errors.problem}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="req-desc"
              className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
            >
              Detailed Symptoms / Notes <span className="text-signal">*</span>
            </label>
            <textarea
              id="req-desc"
              rows={3}
              placeholder="Explain where the fault is, when it started, and if you have isolated power or water..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: null }));
              }}
              className="w-full"
            />
            {errors.description && (
              <p className="font-mono text-xs font-bold text-signal">{errors.description}</p>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. SERVICE ADDRESS SELECTION                                 */}
        {/* ============================================================ */}
        <div className="space-y-4 p-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            3. Service Address (Matched within 2 km)
          </span>

          {errors.address && (
            <p className="font-mono text-xs font-bold text-signal">{errors.address}</p>
          )}

          {/* Mode Switcher */}
          <div className="flex gap-4 border-b-2 border-dashed border-[var(--theme-border)] pb-4">
            <label className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold uppercase">
              <input
                type="radio"
                name="addressMode"
                value="saved"
                checked={selectedAddressMode === 'saved'}
                onChange={() => setSelectedAddressMode('saved')}
                className="accent-signal w-4 h-4"
              />
              <span>Use Saved Address</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold uppercase">
              <input
                type="radio"
                name="addressMode"
                value="custom"
                checked={selectedAddressMode === 'custom'}
                onChange={() => setSelectedAddressMode('custom')}
                className="accent-signal w-4 h-4"
              />
              <span>Enter New Street Address</span>
            </label>
          </div>

          {selectedAddressMode === 'saved' ? (
            <div className="space-y-2">
              {savedAddresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-colors ${
                    Number(selectedAddressId) === addr.id
                      ? 'bg-signal/15 border-signal'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-sub)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="savedAddressChoice"
                    value={addr.id}
                    checked={Number(selectedAddressId) === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="accent-signal mt-1"
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase text-[var(--theme-text-main)]">
                        {addr.label}
                      </span>
                      {addr.is_default && (
                        <span className="font-mono text-[10px] uppercase bg-ink text-paper px-1.5 py-0.2">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--theme-text-soft)] mt-0.5">{addr.address}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="req-custom-addr"
                className="block font-sans font-bold text-sm text-[var(--theme-text-main)]"
              >
                Full Street &amp; Building Address <span className="text-signal">*</span>
              </label>
              <textarea
                id="req-custom-addr"
                rows={2}
                placeholder="Flat / Floor, House No., Street Name, Landmark, Bengaluru"
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value);
                  setErrors((prev) => ({ ...prev, address: null }));
                }}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 4. OPTIONAL PHOTO UPLOAD (Square Bordered Frame)             */}
        {/* ============================================================ */}
        <div className="space-y-3 p-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
              4. Issue Photo (Optional)
            </span>
            <span className="font-mono text-xs text-[var(--theme-text-muted)]">PNG / JPEG</span>
          </div>

          <p className="text-xs text-[var(--theme-text-soft)] font-sans">
            Snap a quick photo of the fault (e.g. switchboard, pipe, broken latch) to help the fixer
            arrive prepared.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
            {/* Square Bordered Photo Preview Frame per DESIGN.md Section 7 */}
            <div className="w-28 h-28 border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] flex items-center justify-center shrink-0 overflow-hidden relative">
              {photoPreview ? (
                <>
                  <img
                    src={photoPreview}
                    alt="Fault preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-1 right-1 bg-ink text-paper text-xs px-1 font-bold border border-ink"
                    title="Remove Photo"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div className="text-center font-mono text-[10px] text-[var(--theme-text-muted)] p-2 uppercase">
                  NO PHOTO ATTACHED
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                <span>UPLOAD PHOTO</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              {errors.photo && (
                <p className="font-mono text-xs font-bold text-signal">{errors.photo}</p>
              )}
              <span className="block font-mono text-[11px] text-[var(--theme-text-muted)]">
                Direct file preview stored locally for this ticket.
              </span>
            </div>
          </div>
        </div>

        {/* Dispatch Button */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs text-[var(--theme-text-muted)]">
            <span className="block font-bold text-[var(--theme-text-main)] uppercase">
              IMMEDIATE BOOKING POLICY
            </span>
            <span>Nearest eligible fixer within 2 km will be pinged instantly.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full sm:w-auto min-h-[50px] px-8 text-sm tracking-wider"
          >
            {loading ? 'DISPATCHING...' : 'DISPATCH NEAREST PARTNER (2 KM) →'}
          </button>
        </div>
      </form>
    </div>
  );
}
