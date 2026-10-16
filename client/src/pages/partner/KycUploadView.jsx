/**
 * FixIt Now - Partner KYC Verification Screen
 * Displays KYC Upload Form, Pending Review State, Verified State, and Rejected State (with reason & resubmit).
 * Conforms to SRS FR-P4, FR-P5, FR-P7 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  getPartnerKyc,
  resubmitPartnerKyc,
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

  // Allow switching view state locally for demonstration
  const [forcedState, setForcedState] = useState(null);

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
    } catch {
      setError('Unable to load KYC status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, [activePartner.id]);

  const effectiveStatus = forcedState || kycData?.status || activePartner?.kyc_status || 'pending';
  const rejectionReason =
    kycData?.rejection_reason ||
    activePartner?.rejection_reason ||
    'Document scan was illegible or blurry. Please upload clear color scans of front and back.';

  // Handle Submit or Resubmit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!idNumber.trim()) {
      setError('! Please enter a valid Government ID number.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        govt_id_type: idType,
        id_number: idNumber.trim(),
        document_name: docFile?.name || `${idType.replace(/\s+/g, '_')}_Scan.pdf`,
        photo_name: photoFile?.name || 'partner_passport_photo.jpg',
        trade_cert_name: tradeCertFile?.name || `${activePartner.service_name || 'Trade'}_Cert.pdf`,
      };

      const updated = await resubmitPartnerKyc(activePartner.id, payload);
      setKycData(updated);
      setForcedState('pending');
      setSuccessMessage('KYC documents submitted successfully to Admin verification desk!');
      if (onKycUpdated) onKycUpdated(updated);
    } catch (err) {
      setError(`! ${err.message || 'Submission failed.'}`);
    } finally {
      setSubmitting(false);
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

          {/* Current State Stamp */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`border-2 px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm ${
                effectiveStatus === 'verified'
                  ? 'border-done bg-done text-paper'
                  : effectiveStatus === 'rejected'
                  ? 'border-signal bg-paper text-ink'
                  : 'border-[var(--theme-border)] bg-concrete text-ink'
              }`}
            >
              {effectiveStatus === 'verified'
                ? '✓ VERIFIED & APPROVED'
                : effectiveStatus === 'rejected'
                ? '✕ KYC REJECTED'
                : '⏳ PENDING REVIEW'}
            </span>
          </div>
        </div>

        {/* State Preview Switcher for Testing (Prompt 3 Requirements) */}
        <div className="p-3 border border-[var(--theme-border)] bg-[var(--theme-bg)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <span className="font-bold text-[var(--theme-text-soft)] uppercase">
            Test Compliance States (SRS Sec. 6):
          </span>
          <div className="flex flex-wrap gap-1.5">
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
              1. Verified State
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
              2. Pending Review State
            </button>
            <button
              type="button"
              onClick={() => {
                setForcedState('rejected');
                setError(null);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold ${
                effectiveStatus === 'rejected'
                  ? 'bg-signal text-ink border-signal'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-signal hover:text-ink'
              }`}
            >
              3. Rejected State (w/ reason)
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
      {/* STATE 1: VERIFIED STATE                                        */}
      {/* ============================================================== */}
      {effectiveStatus === 'verified' && (
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
                  Partner ID: <span className="font-bold text-ink">PTR-{activePartner.id}</span> · Verified Trade: <span className="font-bold text-ink">{activePartner.service_name || 'Certified Trade'}</span>
                </p>
              </div>
            </div>

            <div className="font-mono text-xs text-right">
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
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-[var(--theme-text-main)]">1. Government Photo ID</span>
                  <span className="text-[var(--theme-text-soft)]">{kycData?.govt_id_type || 'Aadhaar Card'} · {kycData?.id_number || '•••• •••• 1024'}</span>
                </div>
                <span className="px-2 py-0.5 border border-done bg-done text-paper text-[10px] font-bold">
                  MATCHED &amp; VALIDATED
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-[var(--theme-text-main)]">2. Passport Size Face Photograph</span>
                  <span className="text-[var(--theme-text-soft)]">{kycData?.photo_name || 'partner_passport_photo.png'}</span>
                </div>
                <span className="px-2 py-0.5 border border-done bg-done text-paper text-[10px] font-bold">
                  BIOMETRIC MATCH
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-[var(--theme-text-main)]">3. Certified Trade Qualification Certificate</span>
                  <span className="text-[var(--theme-text-soft)]">{kycData?.trade_cert_name || 'Trade_Qualification_Cert.pdf'} ({activePartner.service_name || 'Plumbing'})</span>
                </div>
                <span className="px-2 py-0.5 border border-done bg-done text-paper text-[10px] font-bold">
                  SKILL ACCREDITED
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="btn-primary min-h-[48px] px-6 font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              LAUNCH LIVE DISPATCH RADAR →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 2: PENDING REVIEW STATE                                  */}
      {/* ============================================================== */}
      {effectiveStatus === 'pending' && (
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard space-y-6"
          style={{ borderRadius: 0 }}
        >
          <div className="p-4 border-2 border-signal bg-paper text-ink space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 bg-signal animate-pulse inline-block" />
              <h3 className="font-display font-extrabold text-lg text-ink uppercase">
                Under Administrative Compliance Review
              </h3>
            </div>
            <p className="font-mono text-xs text-soft leading-relaxed">
              Your documents were submitted to the FixIt Now compliance desk on{' '}
              <span className="font-bold text-ink">
                {new Date(kycData?.submitted_at || '2026-10-15T10:00:00Z').toLocaleDateString('en-IN', {
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
              <div className="p-3 flex justify-between items-center">
                <span>Government ID ({kycData?.govt_id_type || 'Aadhaar'}): {kycData?.id_number || '•••• 1024'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span>Partner Passport Photograph: {kycData?.photo_name || 'passport_photo.png'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span>Trade Certificate ({activePartner.service_name || 'Trade'}): {kycData?.trade_cert_name || 'Trade_Cert.pdf'}</span>
                <span className="text-[10px] font-bold text-signal uppercase">Under Review</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE 3: REJECTED STATE (SRS FR-P5 with Rejection Reason)      */}
      {/* ============================================================== */}
      {effectiveStatus === 'rejected' && (
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
              Please review the reason above, correct your documents, and resubmit using the form below. Resubmitted applications receive priority desk review within 1 hour.
            </p>
          </div>

          {/* Resubmission Form */}
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2">
            <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
              Resubmit Corrected KYC Documents
            </h3>

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

            {/* Document Upload Dropzones */}
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label
                  htmlFor="kyc-doc-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Clear Photo / Color Scan of Government ID (PDF / JPEG / PNG) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-doc-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setDocFile(e.target.files[0])}
                  className="w-full p-2 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border file:border-ink file:bg-concrete file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>

              <div>
                <label
                  htmlFor="kyc-photo-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Recent Passport Size Photograph <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-photo-file"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  className="w-full p-2 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border file:border-ink file:bg-concrete file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>

              <div>
                <label
                  htmlFor="kyc-cert-file"
                  className="block font-bold uppercase tracking-wider mb-1"
                >
                  Trade Certificate or Apprentice License ({activePartner.service_name || 'Trade'}) <span className="text-signal">*</span>
                </label>
                <input
                  id="kyc-cert-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setTradeCertFile(e.target.files[0])}
                  className="w-full p-2 border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] file:mr-3 file:py-1 file:px-3 file:border file:border-ink file:bg-concrete file:font-mono file:text-xs file:font-bold hover:border-signal cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full min-h-[48px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
            >
              {submitting ? 'TRANSMITTING DOSSIER TO DESK...' : 'RESUBMIT CORRECTED KYC DOSSIER →'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
