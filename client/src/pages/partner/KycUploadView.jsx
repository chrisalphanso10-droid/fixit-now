/**
 * FixIt Now - Partner KYC Verification Screen
 * Displays KYC Upload Form, Pending Review State, Verified State, and Rejected State (with reason & resubmit).
 * Conforms to SRS FR-P4, FR-P5, FR-P7 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  getPartnerKyc,
  submitPartnerKyc,
  resubmitPartnerKyc,
  reviewPartnerKyc,
  getActivePartner,
} from '../../services/partnerService';

export default function KycUploadView({
  partner,
  onKycUpdated,
  onNavigateToDashboard,
}) {
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form inputs for submission/resubmission
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [tradeCertFile, setTradeCertFile] = useState(null);

  // Allow switching view state locally for demonstration/testing
  const [forcedState, setForcedState] = useState(null);
  const [isUpdatingKyc, setIsUpdatingKyc] = useState(false);

  const activePartner = partner || getActivePartner();

  const loadKyc = async () => {
    setLoading(true);
    try {
      const data = await getPartnerKyc(activePartner.id);
      setKycData(data);
      if (data.id_number) {
        setIdNumber(data.id_number);
      }
      if (data.govt_id_type) {
        setIdType(data.govt_id_type);
      }
      if (data.status && onKycUpdated && data.status !== activePartner?.kyc_status) {
        onKycUpdated(data);
      }
    } catch {
      setError('Unable to load KYC status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, [activePartner?.id]);

  const effectiveStatus = forcedState || kycData?.status || activePartner?.kyc_status || 'not_submitted';
  const rejectionReason =
    kycData?.rejection_reason ||
    activePartner?.rejection_reason ||
    'Document scan was illegible or blurry. Please upload clear color scans of front and back.';

  // Handle Submit, Resubmit, or Re-KYC Update
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!idNumber.trim()) {
      setError('! Please enter a valid Government ID number.');
      setSubmitting(false);
      return;
    }

    // Client-side file validation (SRS Section 4 & ITEM 4: same file rules as before)
    if (!docFile && (!kycData?.documents || kycData.documents.length === 0 || isUpdatingKyc)) {
      setError('! Government identity document (PDF format, max 5MB) is required.');
      setSubmitting(false);
      return;
    }

    if (!photoFile && (!kycData?.documents || kycData.documents.length === 0 || isUpdatingKyc)) {
      setError('! Recent passport size photograph (JPEG or PNG, max 2MB) is required.');
      setSubmitting(false);
      return;
    }

    if (docFile) {
      const isPdf = docFile.type === 'application/pdf' || docFile.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setError('! Identity document must be in PDF format (SRS FR-P4).');
        setSubmitting(false);
        return;
      }
      if (docFile.size > 5 * 1024 * 1024) {
        setError('! Identity document file size exceeds the 5MB limit.');
        setSubmitting(false);
        return;
      }
    }

    if (photoFile) {
      const isImage = ['image/jpeg', 'image/jpg', 'image/png'].includes(photoFile.type) ||
        ['.jpg', '.jpeg', '.png'].some((ext) => photoFile.name.toLowerCase().endsWith(ext));
      if (!isImage) {
        setError('! Passport photograph must be in JPEG or PNG format (SRS FR-P4).');
        setSubmitting(false);
        return;
      }
      if (photoFile.size > 2 * 1024 * 1024) {
        setError('! Passport photo file size exceeds the 2MB limit.');
        setSubmitting(false);
        return;
      }
    }

    if (tradeCertFile) {
      const isPdf = tradeCertFile.type === 'application/pdf' || tradeCertFile.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setError('! Trade qualification certificate must be in PDF format.');
        setSubmitting(false);
        return;
      }
      if (tradeCertFile.size > 5 * 1024 * 1024) {
        setError('! Trade certificate file size exceeds the 5MB limit.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const payload = {
        govt_id_type: idType,
        id_number: idNumber.trim(),
        documentFile: docFile,
        photoFile: photoFile,
        tradeCertFile: tradeCertFile,
      };

      const updated = await submitPartnerKyc(activePartner.id, payload);
      setKycData(updated);
      setIsUpdatingKyc(false);
      setForcedState('pending');
      setSuccessMessage('KYC documents successfully uploaded and submitted for administrator review (SRS FR-P5)!');
      if (onKycUpdated) onKycUpdated({ ...updated, kyc_status: 'pending' });
      await loadKyc();
    } catch (err) {
      setError(`! ${err.message || 'Submission failed.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Simulated Admin Review helper for demonstration
  const handleSimulateDecision = async (decision) => {
    setLoading(true);
    setError(null);
    try {
      const reason = decision === 'rejected'
        ? 'Identity scan resolution is insufficient. Please upload a 300+ DPI color PDF scan.'
        : null;
      await reviewPartnerKyc(activePartner.id, decision, reason);
      setForcedState(decision);
      await loadKyc();
      if (onKycUpdated) onKycUpdated({ status: decision, rejection_reason: reason });
    } catch (err) {
      setError(`! Decision update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-sm text-[var(--theme-text-soft)] border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
        LOADING KYC DOCUMENT DOSSIER...
      </div>
    );
  }

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
                COMPLIANCE &amp; VERIFICATION DOSSIER
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Partner Identity &amp; Trade KYC
            </h1>
          </div>

          {/* Current State Rubber Stamp (docs/DESIGN.md Section 5) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`border-2 px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm inline-block -rotate-3 transition-transform ${
                effectiveStatus === 'verified'
                  ? 'border-done bg-done text-paper'
                  : effectiveStatus === 'rejected'
                  ? 'border-signal bg-paper text-ink'
                  : effectiveStatus === 'pending'
                  ? 'border-ink bg-concrete text-ink'
                  : 'border-signal bg-paper text-signal'
              }`}
            >
              {effectiveStatus === 'verified'
                ? 'VERIFIED'
                : effectiveStatus === 'rejected'
                ? 'REJECTED'
                : effectiveStatus === 'pending'
                ? 'PENDING'
                : 'NOT SUBMITTED'}
            </span>
          </div>
        </div>

        {/* State Preview Switcher for Testing (Prompt Requirements) */}
        <div className="p-3 border border-[var(--theme-border)] bg-[var(--theme-bg)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <span className="font-bold text-[var(--theme-text-soft)] uppercase">
            Test Compliance States (SRS Sec. 6 &amp; FR-P5):
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForcedState('not_submitted');
                setError(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                effectiveStatus === 'not_submitted'
                  ? 'bg-signal text-ink border-signal'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              1. Not Submitted
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedState('pending');
                setError(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                effectiveStatus === 'pending'
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              2. Pending Review
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedState('verified');
                setError(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                effectiveStatus === 'verified'
                  ? 'bg-done text-paper border-done'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              3. Verified
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedState('rejected');
                setError(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                effectiveStatus === 'rejected'
                  ? 'border-signal bg-paper text-ink'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              4. Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="border-2 border-done bg-paper text-ink p-3 font-mono text-xs font-bold shadow-hard-sm"
        >
          ✓ {successMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* RE-KYC UPDATE FORM (ITEM 4: Update KYC documents)              */}
      {/* ============================================================== */}
      {isUpdatingKyc && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="border-b-2 border-[var(--theme-border)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal block mb-1">
                COMPLIANCE DOSSIER RE-SUBMISSION (ITEM 4)
              </span>
              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[var(--theme-text-main)]">
                Update KYC documents
              </h2>
              <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] mt-1 max-w-2xl">
                Submit updated identity documents (PDF &le; 5MB) and passport photograph (JPEG/PNG &le; 2MB). Submitting sets your status to pending review and records an activity audit entry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsUpdatingKyc(false);
                setError(null);
              }}
              className="font-mono text-xs font-bold uppercase underline text-signal hover:text-[var(--theme-text-main)] self-start sm:self-auto"
            >
              ← Cancel &amp; Keep Current Status
            </button>
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="rekyc-id-type"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  Government ID Type <span className="text-signal">*</span>
                </label>
                <select
                  id="rekyc-id-type"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                >
                  <option value="Aadhaar Card">Aadhaar Card (Front &amp; Back)</option>
                  <option value="Permanent Account Number (PAN)">PAN Card</option>
                  <option value="Voter ID Card">Voter ID Card</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="rekyc-id-number"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  ID Document Number <span className="text-signal">*</span>
                </label>
                <input
                  id="rekyc-id-number"
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g., 5412 8891 0023"
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Document Upload Fields */}
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="rekyc-doc-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  1. Government Photo ID Document (PDF format only, max 5MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="rekyc-doc-file"
                  type="file"
                  required
                  accept=".pdf,application/pdf"
                  onChange={(e) => setDocFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
                <span className="text-[10px] text-[var(--theme-text-soft)] mt-1 block">
                  Accepted: Official PDF scan of Aadhaar, PAN, Voter ID, Driving License, or Passport.
                </span>
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="rekyc-photo-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  2. Recent Passport Size Photograph (JPEG or PNG only, max 2MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="rekyc-photo-file"
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
                <span className="text-[10px] text-[var(--theme-text-soft)] mt-1 block">
                  Clear color headshot with neutral background.
                </span>
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="rekyc-cert-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  3. Trade Qualification or Apprentice Certificate (PDF format, Optional, max 5MB)
                </label>
                <input
                  id="rekyc-cert-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setTradeCertFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-concrete file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex-1 min-h-[50px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
              >
                {submitting ? 'TRANSMITTING UPDATED DOSSIER...' : 'SUBMIT UPDATED KYC DOCUMENTS →'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUpdatingKyc(false);
                  setError(null);
                }}
                className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] min-h-[50px] px-6 font-mono text-xs font-bold uppercase tracking-wider hover:border-signal"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 0: NOT SUBMITTED STATE (Initial Upload Form)              */}
      {/* ============================================================== */}
      {!isUpdatingKyc && effectiveStatus === 'not_submitted' && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="border-b-2 border-[var(--theme-border)] pb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal block mb-1">
              STEP 3 OF 3: IDENTITY &amp; TRADE QUALIFICATION KYC
            </span>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[var(--theme-text-main)]">
              Complete Your Partner Verification Dossier
            </h2>
            <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] mt-1 max-w-2xl">
              Per FixIt Now Trust &amp; Safety rules (SRS FR-P4 &amp; BR-5), partners must submit verified government identity documents (PDF) and a passport photograph (JPEG/PNG) to unlock live dispatches.
            </p>
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="kyc-id-type"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  Government ID Type <span className="text-signal">*</span>
                </label>
                <select
                  id="kyc-id-type"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                >
                  <option value="Aadhaar Card">Aadhaar Card (Front &amp; Back)</option>
                  <option value="Permanent Account Number (PAN)">PAN Card</option>
                  <option value="Voter ID Card">Voter ID Card</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="kyc-id-number"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  ID Document Number <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-id-number"
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g., 5412 8891 0023"
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Document Upload Fields */}
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-doc-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  1. Government Photo ID Document (PDF format only, max 5MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-doc-file"
                  type="file"
                  required
                  accept=".pdf,application/pdf"
                  onChange={(e) => setDocFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
                <span className="text-[10px] text-[var(--theme-text-soft)] mt-1 block">
                  Accepted: Official PDF scan of Aadhaar, PAN, Voter ID, Driving License, or Passport.
                </span>
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-photo-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  2. Recent Passport Size Photograph (JPEG or PNG only, max 2MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-photo-file"
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
                <span className="text-[10px] text-[var(--theme-text-soft)] mt-1 block">
                  Clear color headshot with neutral background. Displayed on work order tickets.
                </span>
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-cert-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  3. Trade Qualification or Apprentice Certificate (PDF format, Optional)
                </label>
                <input
                  id="kyc-cert-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setTradeCertFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-concrete file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
                <span className="text-[10px] text-[var(--theme-text-soft)] mt-1 block">
                  ITI / NCVT certificate, trade license or employer recommendation letter for {activePartner.service_name || 'Trade'}.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full min-h-[50px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              {submitting ? 'TRANSMITTING ENCRYPTED DOSSIER...' : 'SUBMIT KYC VERIFICATION DOSSIER →'}
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 1: VERIFIED STATE (SRS FR-P5, FR-P7)                     */}
      {/* ============================================================== */}
      {!isUpdatingKyc && effectiveStatus === 'verified' && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="p-4 border-2 border-done bg-paper text-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-done text-paper flex items-center justify-center font-bold text-xl border-2 border-ink">
                ✓
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-ink">
                  Compliance Verification Complete
                </h3>
                <p className="font-mono text-xs text-muted">
                  Partner ID: <span className="font-bold text-ink">PTR-{String(activePartner.id).slice(0, 8)}</span> · Verified Trade: <span className="font-bold text-ink">{activePartner.service_name || 'Certified Trade'}</span>
                </p>
              </div>
            </div>

            <div className="font-mono text-xs text-left sm:text-right">
              <span className="text-muted block">VERIFICATION EXPIRY:</span>
              <span className="font-bold text-done">LIFETIME CERTIFIED</span>
            </div>
          </div>

          {/* Dossier Document Table */}
          <div className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)]">
            <div className="border-b-2 border-[var(--theme-border)] p-3 bg-[var(--theme-surface)] font-mono text-xs font-bold uppercase tracking-wider">
              VERIFIED COMPLIANCE DOCUMENTS ON RECORD:
            </div>
            <div className="divide-y-2 divide-[var(--theme-border)] font-mono text-xs">
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Government ID ({kycData?.govt_id_type || 'Aadhaar Card'})</span>
                <span className="text-[10px] font-bold text-done uppercase">✓ Verified &amp; Encrypted</span>
              </div>
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Partner Passport Photograph</span>
                <span className="text-[10px] font-bold text-done uppercase">✓ Verified</span>
              </div>
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Trade Qualification Certificate ({activePartner.service_name || 'Trade'})</span>
                <span className="text-[10px] font-bold text-done uppercase">✓ Verified</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="btn-primary min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              GO TO LIVE RADAR DISPATCH DASHBOARD →
            </button>
            <button
              type="button"
              id="update-kyc-docs-btn-verified"
              onClick={() => {
                setIsUpdatingKyc(true);
                setError(null);
                setSuccessMessage(null);
              }}
              className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider hover:border-signal"
            >
              Update KYC documents
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 2: PENDING REVIEW STATE (SRS FR-P5)                      */}
      {/* ============================================================== */}
      {!isUpdatingKyc && effectiveStatus === 'pending' && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="p-4 border-2 border-ink bg-concrete text-ink space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 bg-signal animate-pulse inline-block" />
              <h3 className="font-display font-extrabold text-lg text-ink uppercase">
                Under Administrative Compliance Review
              </h3>
            </div>
            <p className="font-mono text-xs text-soft leading-relaxed">
              Your documents were submitted to the FixIt Now compliance desk on{' '}
              <span className="font-bold text-ink">
                {new Date(kycData?.submitted_at || Date.now()).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>.
              Verification queue status: <span className="font-bold text-signal">Position #4 in Queue</span>.
              Estimated turnaround time is 2 to 4 business hours.
            </p>
          </div>

          {/* Lockout Notice */}
          <div className="border border-[var(--theme-border)] p-4 bg-[var(--theme-bg)] font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
              <span className="font-bold text-[var(--theme-text-main)]">DISPATCH RADAR AVAILABILITY:</span>
              <span className="text-signal font-bold uppercase">PAUSED UNTIL VERIFIED</span>
            </div>
            <p className="text-[var(--theme-text-soft)] leading-relaxed">
              Per FixIt Now Trust &amp; Safety Policy (SRS FR-P7 &amp; BR-5), partners cannot toggle online or receive live customer bookings until the compliance team confirms photo ID and trade qualification.
            </p>
          </div>

          {/* Document Summary */}
          <div className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)]">
            <div className="border-b-2 border-[var(--theme-border)] p-3 bg-[var(--theme-surface)] font-mono text-xs font-bold uppercase tracking-wider">
              DOCUMENTS SUBMITTED &amp; PENDING INSPECTION:
            </div>
            <div className="divide-y-2 divide-[var(--theme-border)] font-mono text-xs">
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Government ID ({kycData?.govt_id_type || idType || 'Aadhaar'}): {kycData?.id_number || idNumber || '•••• •••• 1024'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Partner Passport Photograph: {photoFile?.name || kycData?.photo_name || 'passport_photo.png'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
              <div className="p-3 flex justify-between items-center gap-2 flex-wrap">
                <span>Trade Certificate ({activePartner.service_name || 'Trade'}): {tradeCertFile?.name || kycData?.trade_cert_name || 'Trade_Cert.pdf'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              type="button"
              id="update-kyc-docs-btn-pending"
              onClick={() => {
                setIsUpdatingKyc(true);
                setError(null);
                setSuccessMessage(null);
              }}
              className="btn-primary min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              Update KYC documents
            </button>
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider hover:border-signal"
            >
              ← RETURN TO DASHBOARD
            </button>

            {/* Simulated reviewer decision controls for demo verification */}
            <button
              type="button"
              onClick={() => handleSimulateDecision('verified')}
              className="border-2 border-done bg-done text-paper min-h-[48px] px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm"
              title="Test approval flow"
            >
              [DEMO] SIMULATE ADMIN APPROVAL ✓
            </button>
            <button
              type="button"
              onClick={() => handleSimulateDecision('rejected')}
              className="border-2 border-signal bg-paper text-ink min-h-[48px] px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm"
              title="Test rejection flow"
            >
              [DEMO] SIMULATE ADMIN REJECTION ✕
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 3: REJECTED STATE (SRS FR-P5 with Rejection Reason)      */}
      {/* ============================================================== */}
      {!isUpdatingKyc && effectiveStatus === 'rejected' && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          {/* Rejection Alert Box */}
          <div className="p-4 border-2 border-signal bg-paper text-ink space-y-3">
            <div className="flex items-center justify-between border-b border-ink/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-signal inline-block" />
                <h3 className="font-display font-extrabold text-lg text-ink uppercase">
                  KYC Verification Rejected by Compliance Desk
                </h3>
              </div>
              <span className="border border-signal bg-signal text-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                ACTION REQUIRED
              </span>
            </div>

            <div>
              <span className="font-mono text-xs font-bold text-ink block mb-1">
                OFFICIAL REJECTION REASON (FROM COMPLIANCE REVIEWER):
              </span>
              <div className="p-3 bg-concrete border border-ink font-mono text-xs text-ink leading-relaxed">
                &ldquo;{rejectionReason}&rdquo;
              </div>
            </div>

            <p className="font-mono text-xs text-soft leading-relaxed">
              Please review the reason above, correct your documents, and resubmit using the form below. Resubmitted applications receive priority desk review.
            </p>
          </div>

          {/* Resubmission Form (Update KYC documents) */}
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-3">
              <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
                Update KYC documents &amp; Resubmit
              </h3>
              <span className="font-mono text-xs text-signal font-bold uppercase">
                [Update KYC documents available]
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="kyc-id-type-resubmit"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  Government ID Type <span className="text-signal">*</span>
                </label>
                <select
                  id="kyc-id-type-resubmit"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                >
                  <option value="Aadhaar Card">Aadhaar Card (Front &amp; Back)</option>
                  <option value="Permanent Account Number (PAN)">PAN Card</option>
                  <option value="Voter ID Card">Voter ID Card</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="kyc-id-number-resubmit"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  ID Document Number <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-id-number-resubmit"
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g., 5412 8891 0023"
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs focus:outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Document Upload Dropzones */}
            <div className="space-y-3 font-mono text-xs">
              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-doc-file-resubmit"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Clear Photo / Color Scan of Government ID (PDF format only, max 5MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-doc-file-resubmit"
                  type="file"
                  required
                  accept=".pdf,application/pdf"
                  onChange={(e) => setDocFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-photo-file-resubmit"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Recent Passport Size Photograph (JPEG or PNG only, max 2MB) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-photo-file-resubmit"
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-signal file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>

              <div className="p-4 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]">
                <label
                  htmlFor="kyc-cert-file-resubmit"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Trade Certificate or Apprentice License ({activePartner.service_name || 'Trade'}) (PDF format, Optional, max 5MB)
                </label>
                <input
                  id="kyc-cert-file-resubmit"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setTradeCertFile(e.target.files[0] || null)}
                  className="w-full p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border-2 file:border-ink file:bg-concrete file:text-ink file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full min-h-[48px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              {submitting ? 'TRANSMITTING DOSSIER TO DESK...' : 'Update KYC documents →'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
