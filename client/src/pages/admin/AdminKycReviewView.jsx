/**
 * FixIt Now - Admin KYC Review View
 * Conforms to SRS FR-A4, BR-5 and docs/DESIGN.md:
 * - Filterable by Pending, Verified, Rejected, All.
 * - Inspect document dossier: Govt ID, passport photo, trade certificate.
 * - Approve action: instantly verifies partner and unlocks eligibility.
 * - Reject action: mandatory rejection reason validation before decline.
 * - Responsive: stacked cards on mobile (< md), clean ticket dossiers on desktop.
 */

import { useState, useEffect } from 'react';
import {
  getAdminKycList,
  approvePartnerKyc,
  rejectPartnerKyc,
} from '../../services/adminService';

export default function AdminKycReviewView() {
  const [kycList, setKycList] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);

  // Modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  const [loadError, setLoadError] = useState(null);

  // Document Inspection Modal State
  const [viewingDocModal, setViewingDocModal] = useState(false);
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  const getAuthToken = () => {
    try {
      return localStorage.getItem('fixit_token') || '';
    } catch {
      return '';
    }
  };

  const getSecureUrl = (baseUrl) => {
    if (!baseUrl) return '';
    const token = getAuthToken();
    if (!token) return baseUrl;
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  };

  const getDossierDocs = (dossier) => {
    if (!dossier) return [];
    const list = [];
    if (dossier.photo_url) {
      list.push({
        id: 'photo',
        title: 'Passport Photograph',
        name: dossier.photo_name || 'Passport_Photo.jpg',
        url: dossier.photo_url,
        type: 'image',
      });
    }
    if (dossier.document_url) {
      list.push({
        id: 'govt_id',
        title: dossier.govt_id_type || 'Government Identity Card',
        name: dossier.document_name || 'Government_ID.pdf',
        url: dossier.document_url,
        type: dossier.document_name?.match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'pdf',
      });
    }
    if (dossier.trade_cert_url) {
      list.push({
        id: 'trade_cert',
        title: 'Trade License / Certification',
        name: dossier.trade_cert_name || 'Trade_Certificate.pdf',
        url: dossier.trade_cert_url,
        type: dossier.trade_cert_name?.match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'pdf',
      });
    }
    if (Array.isArray(dossier.documents)) {
      dossier.documents.forEach((d) => {
        const url = d.download_url || `/api/partner/kyc/document/${d.id}`;
        if (!list.some((existing) => existing.url === url)) {
          list.push({
            id: `doc-${d.id}`,
            title: d.document_type || d.original_name,
            name: d.original_name || d.file_name,
            url,
            type: (d.file_type || '').startsWith('image/') || (d.original_name || '').match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'pdf',
          });
        }
      });
    }
    return list;
  };

  const openDocViewer = (dossier, docIndex = 0) => {
    setSelectedDossier(dossier);
    setActiveDocIndex(docIndex);
    setViewingDocModal(true);
  };

  const loadData = async (currentFilter = filter) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminKycList(currentFilter);
      setKycList(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message || 'Failed to load KYC dossiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getAdminKycList(filter)
      .then((data) => {
        if (active) {
          setKycList(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err.message || 'Failed to load KYC dossiers.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [filter]);

  const handleApprove = async (partnerId, partnerName) => {
    if (!window.confirm(`Confirm KYC Approval for Partner #${partnerId} (${partnerName})? This will immediately unlock job matching eligibility.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await approvePartnerKyc(partnerId, 'Verified Govt ID & Trade Certificate');
      setSuccessToast(`Partner #${partnerId} successfully verified!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadData();
      if (selectedDossier?.partner_id === partnerId) {
        setSelectedDossier((prev) => (prev ? { ...prev, status: 'verified' } : null));
      }
    } catch (err) {
      alert(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (dossier) => {
    setSelectedDossier(dossier);
    setRejectReason('');
    setRejectError(null);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('A specific rejection reason is mandatory before declining this KYC application.');
      return;
    }

    setActionLoading(true);
    setRejectError(null);

    try {
      await rejectPartnerKyc(selectedDossier.partner_id, rejectReason.trim());
      setRejectModalOpen(false);
      setSuccessToast(`Dossier for Partner #${selectedDossier.partner_id} rejected. Reason recorded.`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadData();
    } catch (err) {
      setRejectError(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const counts = {
    pending: kycList.filter((k) => k.status === 'pending').length,
    verified: kycList.filter((k) => k.status === 'verified').length,
    rejected: kycList.filter((k) => k.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--theme-border)] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal block">
            VERIFICATION DESK · FR-A4
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)]">
            Partner KYC Dossier Review
          </h1>
        </div>
        <div className="font-mono text-xs text-[var(--theme-text-soft)]">
          RULE BR-5: Only verified partners receive customer job requests.
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-[var(--theme-border)] pb-3">
        {[
          { key: 'pending', label: 'Pending Review' },
          { key: 'verified', label: 'Approved (Verified)' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All Dossiers' },
        ].map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors min-h-[44px] flex items-center gap-2 border-2 ${
                active
                  ? 'bg-signal text-paper border-signal font-bold shadow-hard-sm'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)] hover:bg-[var(--theme-surface-sub)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.key === 'pending' && counts.pending > 0 && filter !== 'pending' && (
                <span className="bg-[#B83A14] text-paper text-[10px] px-1.5 py-0.2">
                  {counts.pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="p-4 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-signal font-bold uppercase">
            <span>[!]</span>
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            className="px-3 py-1.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Dossiers Grid / List */}
      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)] animate-pulse">
          [SEARCHING KYC DOSSIERS IN SECURE ARCHIVE...]
        </div>
      ) : kycList.length === 0 ? (
        <div className="p-8 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center font-mono text-xs text-[var(--theme-text-muted)]">
          NO DOSSIERS MATCHING FILTER [{filter.toUpperCase()}]
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {kycList.map((dossier) => {
            const isPending = dossier.status === 'pending';
            const isVerified = dossier.status === 'verified';
            const isRejected = dossier.status === 'rejected';

            return (
              <div
                key={dossier.id}
                className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 shadow-hard flex flex-col justify-between"
              >
                <div>
                  {/* Top Dossier Bar with Photo Avatar */}
                  <div className="flex items-start justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4 gap-3">
                    <div className="flex items-start gap-3">
                      {dossier.photo_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const docs = getDossierDocs(dossier);
                            const idx = docs.findIndex((d) => d.id === 'photo');
                            openDocViewer(dossier, idx >= 0 ? idx : 0);
                          }}
                          title="Click to view full photo"
                          className="w-14 h-14 border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] overflow-hidden shrink-0 group hover:border-signal cursor-pointer relative"
                        >
                          <img
                            src={getSecureUrl(dossier.photo_url)}
                            alt={dossier.partner_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] text-paper font-mono font-bold">
                            VIEW
                          </span>
                        </button>
                      ) : (
                        <div className="w-14 h-14 border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] flex items-center justify-center font-mono font-bold text-xs text-[var(--theme-text-muted)] shrink-0">
                          KYC
                        </div>
                      )}
                      <div>
                        <span className="font-mono text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest block">
                          DOSSIER #KYC-{String(dossier.id).padStart(4, '0')} · PARTNER #{dossier.partner_id}
                        </span>
                        <h3 className="text-xl font-display font-extrabold text-[var(--theme-text-main)]">
                          {dossier.partner_name}
                        </h3>
                        <span className="font-mono text-xs text-signal font-bold block">
                          {dossier.service_name}
                        </span>
                      </div>
                    </div>

                    {/* Rubber Stamp */}
                    <div>
                      {isVerified && (
                        <span className="stamp-badge border-done text-done bg-[#EAF8F0] dark:bg-[#0D2E1A] text-xs">
                          VERIFIED
                        </span>
                      )}
                      {isPending && (
                        <span className="stamp-badge border-signal text-signal bg-[#FFF5F2] dark:bg-[#3D140C] text-xs">
                          PENDING
                        </span>
                      )}
                      {isRejected && (
                        <span className="stamp-badge border-[#B83A14] text-[#B83A14] bg-[#FFEBEB] dark:bg-[#3B1111] text-xs">
                          REJECTED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Partner Demographics */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-4 p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div>
                      <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">PHONE</span>
                      <span className="text-[var(--theme-text-main)] font-bold">{dossier.partner_phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">EMAIL</span>
                      <span className="text-[var(--theme-text-main)] font-bold truncate block">{dossier.partner_email}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">VEHICLE</span>
                      <span className="text-[var(--theme-text-main)]">{dossier.partner_vehicle}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">RATING</span>
                      <span className="text-done font-bold">{dossier.partner_rating} ★</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-[var(--theme-text-muted)] block uppercase">WORKSHOP / ADDRESS</span>
                      <span className="text-[var(--theme-text-soft)]">{dossier.partner_address}</span>
                    </div>
                  </div>

                  {/* Submitted Documents Section */}
                  <div className="space-y-2 mb-4">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)] block">
                      SUBMITTED CREDENTIALS (SRS SEC. 3.3):
                    </span>

                    {/* Doc 1: Government Identity */}
                    <div className="p-2.5 border border-[var(--theme-border)] bg-[var(--theme-surface)] flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-signal font-bold">📄</span>
                        <div>
                          <strong className="text-[var(--theme-text-main)]">{dossier.govt_id_type || 'Government ID'}: </strong>
                          <span className="text-[var(--theme-text-soft)]">{dossier.id_number || 'Submitted'}</span>
                          <span className="text-[10px] text-[var(--theme-text-muted)] block">
                            File: {dossier.document_name}
                          </span>
                        </div>
                      </div>
                      {dossier.document_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const docs = getDossierDocs(dossier);
                            const idx = docs.findIndex((d) => d.id === 'govt_id');
                            openDocViewer(dossier, idx >= 0 ? idx : 0);
                          }}
                          className="text-[10px] font-bold text-signal underline hover:text-[var(--theme-text-main)] border border-signal px-2 py-1 min-h-[32px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>👁️</span> VIEW DOCUMENT
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-done border border-done px-1.5 py-0.5 shrink-0">
                          SUBMITTED
                        </span>
                      )}
                    </div>

                    {/* Doc 2: Passport Photo */}
                    <div className="p-2.5 border border-[var(--theme-border)] bg-[var(--theme-surface)] flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-signal font-bold">🖼️</span>
                        <div>
                          <strong className="text-[var(--theme-text-main)]">Passport Photograph: </strong>
                          <span className="text-[10px] text-[var(--theme-text-muted)] block">
                            File: {dossier.photo_name}
                          </span>
                        </div>
                      </div>
                      {dossier.photo_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const docs = getDossierDocs(dossier);
                            const idx = docs.findIndex((d) => d.id === 'photo');
                            openDocViewer(dossier, idx >= 0 ? idx : 0);
                          }}
                          className="text-[10px] font-bold text-signal underline hover:text-[var(--theme-text-main)] border border-signal px-2 py-1 min-h-[32px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>👁️</span> VIEW PHOTO
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-done border border-done px-1.5 py-0.5 shrink-0">
                          PHOTO
                        </span>
                      )}
                    </div>

                    {/* Doc 3: Trade Certification */}
                    <div className="p-2.5 border border-[var(--theme-border)] bg-[var(--theme-surface)] flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-signal font-bold">📜</span>
                        <div>
                          <strong className="text-[var(--theme-text-main)]">Trade Certification: </strong>
                          <span className="text-[10px] text-[var(--theme-text-muted)] block">
                            File: {dossier.trade_cert_name}
                          </span>
                        </div>
                      </div>
                      {dossier.trade_cert_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const docs = getDossierDocs(dossier);
                            const idx = docs.findIndex((d) => d.id === 'trade_cert');
                            openDocViewer(dossier, idx >= 0 ? idx : 0);
                          }}
                          className="text-[10px] font-bold text-signal underline hover:text-[var(--theme-text-main)] border border-signal px-2 py-1 min-h-[32px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>👁️</span> VIEW CERT
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-signal border border-signal px-1.5 py-0.5 shrink-0">
                          {dossier.trade_cert_name !== 'Not Provided' ? 'PROVIDED' : 'OPTIONAL'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Decision / Reviewer Note */}
                  {dossier.reviewer_decision && (
                    <div className="p-3 bg-[var(--theme-surface-sub)] border-l-4 border-signal font-mono text-xs mb-4">
                      <span className="font-bold text-[var(--theme-text-main)] block mb-0.5">REVIEW DECISION:</span>
                      <span className="text-[var(--theme-text-soft)]">{dossier.reviewer_decision}</span>
                    </div>
                  )}

                  {dossier.rejection_reason && (
                    <div className="p-3 bg-[#FFEBEB] dark:bg-[#3D1414] border-2 border-[#B83A14] font-mono text-xs text-[#B83A14] dark:text-[#FFA0A0] mb-4">
                      <strong>REJECTION REASON (COMMUNICATED TO PARTNER):</strong>
                      <p className="mt-1">{dossier.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* Dossier Bottom Action Buttons */}
                <div className="pt-4 border-t-2 border-[var(--theme-border)] space-y-2">
                  <button
                    type="button"
                    onClick={() => openDocViewer(dossier, 0)}
                    className="w-full border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] hover:border-signal hover:text-signal text-[var(--theme-text-main)] px-3 py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                  >
                    <span>📂</span> INSPECT DOSSIER &amp; ALL DOCUMENTS ({getDossierDocs(dossier).length})
                  </button>

                  <div className="flex flex-wrap gap-2">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleApprove(dossier.partner_id, dossier.partner_name)}
                          className="btn-primary flex-1 min-h-[44px] text-xs font-mono font-bold flex items-center justify-center gap-1.5"
                        >
                          <span>✓</span> APPROVE &amp; UNLOCK
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => openRejectModal(dossier)}
                          className="border-2 border-[#B83A14] bg-paper dark:bg-ink text-[#B83A14] hover:bg-[#B83A14] hover:text-paper px-4 py-2 text-xs font-mono font-bold transition-colors min-h-[44px]"
                        >
                          ✕ REJECT WITH REASON
                        </button>
                      </>
                    )}

                    {isRejected && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleApprove(dossier.partner_id, dossier.partner_name)}
                        className="btn-secondary w-full min-h-[44px] text-xs font-mono font-bold"
                      >
                        ↺ OVERRIDE &amp; APPROVE KYC
                      </button>
                    )}

                    {isVerified && (
                      <div className="w-full flex items-center justify-between font-mono text-xs text-done">
                        <span>✓ KYC APPROVED &amp; ACTIVE</span>
                        <button
                          type="button"
                          onClick={() => openRejectModal(dossier)}
                          className="text-[#B83A14] underline text-[11px] cursor-pointer"
                        >
                          Revoke Verification
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* DOCUMENT & IMAGE INSPECTION MODAL (FR-A4)                       */}
      {/* ============================================================== */}
      {viewingDocModal && selectedDossier && (() => {
        const docs = getDossierDocs(selectedDossier);
        const activeDoc = docs[activeDocIndex] || docs[0] || null;
        const secureUrl = activeDoc ? getSecureUrl(activeDoc.url) : '';

        return (
          <div
            className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-hard">
              {/* Modal Header */}
              <div className="p-4 border-b-2 border-[var(--theme-border)] flex items-center justify-between gap-3 bg-[var(--theme-surface-sub)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                      KYC DOCUMENT INSPECTION · FR-A4
                    </span>
                    <span className="font-mono text-xs text-[var(--theme-text-muted)]">
                      · Partner #{selectedDossier.partner_id}
                    </span>
                  </div>
                  <h3 className="font-display font-extrabold text-lg sm:text-xl text-[var(--theme-text-main)]">
                    {selectedDossier.partner_name} — {selectedDossier.service_name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDossier.status === 'verified' && (
                    <span className="stamp-badge border-done text-done bg-[#EAF8F0] dark:bg-[#0D2E1A] text-xs">
                      VERIFIED
                    </span>
                  )}
                  {selectedDossier.status === 'pending' && (
                    <span className="stamp-badge border-signal text-signal bg-[#FFF5F2] dark:bg-[#3D140C] text-xs">
                      PENDING
                    </span>
                  )}
                  {selectedDossier.status === 'rejected' && (
                    <span className="stamp-badge border-[#B83A14] text-[#B83A14] bg-[#FFEBEB] dark:bg-[#3B1111] text-xs">
                      REJECTED
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingDocModal(false)}
                    className="w-8 h-8 border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] font-mono font-bold text-sm hover:border-signal hover:text-signal cursor-pointer"
                    aria-label="Close document viewer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Document Tabs */}
              {docs.length > 0 ? (
                <div className="flex flex-wrap border-b-2 border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 pt-2 gap-1">
                  {docs.map((doc, idx) => {
                    const isActive = idx === activeDocIndex;
                    return (
                      <button
                        key={doc.id || idx}
                        type="button"
                        onClick={() => setActiveDocIndex(idx)}
                        className={`px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider border-t-2 border-l-2 border-r-2 -mb-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-[var(--theme-surface)] text-signal border-[var(--theme-border)] border-b-transparent z-10'
                            : 'bg-[var(--theme-surface-sub)] text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-main)]'
                        }`}
                      >
                        <span>{doc.type === 'image' ? '🖼️' : '📄'}</span>
                        <span>{doc.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Document Preview Canvas */}
              <div className="flex-1 overflow-auto p-4 bg-[#121212]/5 dark:bg-[#121212]/40 flex flex-col items-center justify-center min-h-[350px]">
                {activeDoc ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full flex items-center justify-between text-xs font-mono text-[var(--theme-text-soft)] mb-2 px-1">
                      <span className="truncate max-w-[70%]">
                        File: <strong>{activeDoc.name}</strong>
                      </span>
                      <a
                        href={secureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-signal underline font-bold hover:text-[var(--theme-text-main)] cursor-pointer"
                      >
                        Open In New Window ↗
                      </a>
                    </div>

                    {activeDoc.type === 'image' ? (
                      <div className="w-full flex justify-center p-2 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
                        <img
                          src={secureUrl}
                          alt={activeDoc.title}
                          className="max-h-[50vh] max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
                        <iframe
                          src={secureUrl}
                          title={activeDoc.title}
                          className="w-full h-[52vh] border-0"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-muted)]">
                    No documents found for this partner dossier.
                  </div>
                )}
              </div>

              {/* Modal Footer / Status Update Controls */}
              <div className="p-4 border-t-2 border-[var(--theme-border)] bg-[var(--theme-surface)] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="font-mono text-xs text-[var(--theme-text-soft)]">
                  Verify credentials, then update KYC status:
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={async () => {
                      await handleApprove(selectedDossier.partner_id, selectedDossier.partner_name);
                      setViewingDocModal(false);
                    }}
                    className="btn-primary flex-1 sm:flex-initial px-4 py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span>✓</span> APPROVE &amp; UNLOCK
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                      setViewingDocModal(false);
                      openRejectModal(selectedDossier);
                    }}
                    className="border-2 border-[#B83A14] bg-paper dark:bg-ink text-[#B83A14] hover:bg-[#B83A14] hover:text-paper px-4 py-2.5 text-xs font-mono font-bold transition-colors flex-1 sm:flex-initial min-h-[44px]"
                  >
                    ✕ REJECT WITH REASON
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingDocModal(false)}
                    className="btn-secondary px-4 py-2.5 text-xs font-mono font-bold min-h-[44px]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* REJECTION REASON MODAL (MANDATORY REASON PER FR-A4)             */}
      {/* ============================================================== */}
      {rejectModalOpen && selectedDossier && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 max-w-lg w-full shadow-hard relative">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-4">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#B83A14]">
                DECLINE KYC DOSSIER · FR-A4
              </span>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="w-7 h-7 border border-[var(--theme-border)] font-mono font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)]">
                Reject KYC for {selectedDossier.partner_name}
              </h3>
              <p className="font-mono text-xs text-[var(--theme-text-muted)] mt-1">
                Partner #{selectedDossier.partner_id} · {selectedDossier.service_name}
              </p>
            </div>

            {rejectError && (
              <div className="p-3 bg-[#FFEBEB] dark:bg-[#3D1414] border-2 border-[#B83A14] text-[#B83A14] text-xs font-mono font-bold mb-4 flex items-start gap-2">
                <span>!</span>
                <span>{rejectError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label
                  htmlFor="rejection-reason"
                  className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1"
                >
                  Mandatory Rejection Reason <span className="text-signal">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  rows={4}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Trade certificate expired in 2025. Please upload latest NCVT renewal or government trade registration."
                  className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-3 text-xs font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <span className="font-mono text-[11px] text-[var(--theme-text-muted)] block mt-1">
                  This explanation will be delivered directly to the partner portal.
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="font-mono text-[10px] text-[var(--theme-text-muted)] uppercase block mb-1">
                  COMMON DEFICIENCY REASONS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Trade license certificate expired',
                    'Passport photograph blurry / illegible',
                    'Aadhaar number mismatch with name',
                    'Document missing official government seal',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className="px-2 py-1 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-[10px] text-[var(--theme-text-soft)] hover:text-signal"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="border-2 border-[#B83A14] bg-[#B83A14] text-paper hover:bg-[#8F2B0E] flex-1 py-2.5 text-xs font-mono font-bold min-h-[44px]"
                >
                  {actionLoading ? 'Recording Rejection...' : 'Confirm KYC Rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
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
