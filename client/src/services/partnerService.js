/**
 * FixIt Now - Partner Service
 * Manages partner dashboard data, subscription plans, KYC verification,
 * live dispatch radar, active job state progression, earnings, ratings, and history.
 * Conforms to SRS FR-P1 to FR-P15 and docs/DESIGN.md.
 */

import { get, post, postFormData, put } from './api';
import {
  mockPartners,
  mockPartnerEarnings,
  mockPartnerRatings,
  mockIncomingJob,
} from '../mockData';

const PARTNER_STORAGE_KEY = 'fixit_current_partner';
const PARTNER_EARNINGS_KEY = 'fixit_partner_earnings_data';
const PARTNER_ACTIVE_JOB_KEY = 'fixit_partner_active_job';
export const PARTNER_RECENT_JOBS_KEY = 'fixit_partner_recent_jobs';
export const PARTNER_RECENT_RATINGS_KEY = 'fixit_recent_ratings';

/**
 * Save recently completed or cancelled partner job to local audit log.
 * Automatically dispatches update event so history views refresh immediately.
 */
export function savePartnerRecentJob(job) {
  if (!job) return null;
  try {
    const raw = localStorage.getItem(PARTNER_RECENT_JOBS_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    const normStatus =
      job.status === 'service_completed' ||
      job.status === 'payment_completed' ||
      job.status === 'paid' ||
      job.status === 'completed'
        ? 'completed'
        : job.status === 'cancelled'
        ? 'cancelled'
        : job.status || 'completed';

    const orderNum =
      job.order_number ||
      `ORD-${String(job.id || Date.now()).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

    const jobEntry = {
      id: job.id || Date.now(),
      order_number: orderNum,
      customer_name: job.customer_name || 'Customer',
      customer_phone: job.customer_phone || '+91 98765 43210',
      service_name: job.service_name || 'Service Call',
      problem: job.problem || job.description || 'Service Work',
      address: job.address || 'Indiranagar, Bengaluru',
      status: normStatus,
      amount: typeof job.amount === 'number' ? job.amount : parseFloat(job.amount) || 450.0,
      payment_mode: job.payment_mode || 'Direct Cash / UPI (On-site)',
      completed_at: job.completed_at || new Date().toISOString(),
      rating: job.rating || null,
      cancel_reason:
        job.cancel_reason ||
        (normStatus === 'cancelled' ? 'Customer cancelled prior to arrival.' : undefined),
    };

    // Filter out previous version of this job if present
    const filtered = existing.filter(
      (item) =>
        String(item.id) !== String(jobEntry.id) &&
        String(item.order_number) !== String(jobEntry.order_number)
    );

    const updated = [jobEntry, ...filtered];
    localStorage.setItem(PARTNER_RECENT_JOBS_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fixit_partner_history_updated'));
    }
    return jobEntry;
  } catch (err) {
    console.warn('[PartnerService] savePartnerRecentJob failed:', err);
    return null;
  }
}

/**
 * Add verified customer rating and feedback review for partner.
 * Updates both the ratings ledger and any matching work order in partner history.
 */
export function addPartnerRating(ratingData) {
  if (!ratingData) return null;
  try {
    const raw = localStorage.getItem(PARTNER_RECENT_RATINGS_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    const stars = Math.max(1, Math.min(5, Number(ratingData.stars) || 5));
    const orderNum =
      ratingData.orderNumber ||
      ratingData.order_number ||
      ratingData.order_id ||
      `ORD-${String(ratingData.requestId || Date.now()).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

    const reviewEntry = {
      id: ratingData.id || Date.now(),
      order_number: orderNum,
      order_id: orderNum,
      customer_name: ratingData.customerName || ratingData.customer_name || 'Customer',
      stars,
      date: ratingData.date || new Date().toISOString(),
      comment: (ratingData.comment || 'Quick fix, courteous professional.').trim(),
      service_name: ratingData.serviceName || ratingData.service_name || 'Home Service',
      partner_id: ratingData.partnerId || ratingData.partner_id,
    };

    const filtered = existing.filter(
      (item) =>
        String(item.id) !== String(reviewEntry.id) &&
        String(item.order_number) !== String(reviewEntry.order_number)
    );

    const updated = [reviewEntry, ...filtered];
    localStorage.setItem(PARTNER_RECENT_RATINGS_KEY, JSON.stringify(updated));

    // Also update rating on matching job in partner history log
    try {
      const histRaw = localStorage.getItem(PARTNER_RECENT_JOBS_KEY);
      if (histRaw) {
        const hist = JSON.parse(histRaw);
        let changed = false;
        const updatedHist = hist.map((j) => {
          if (
            String(j.order_number) === String(orderNum) ||
            (ratingData.requestId && String(j.id) === String(ratingData.requestId))
          ) {
            changed = true;
            return {
              ...j,
              rating: {
                stars,
                comment: reviewEntry.comment,
              },
            };
          }
          return j;
        });
        if (changed) {
          localStorage.setItem(PARTNER_RECENT_JOBS_KEY, JSON.stringify(updatedHist));
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fixit_partner_ratings_updated'));
      window.dispatchEvent(new Event('fixit_partner_history_updated'));
    }

    return reviewEntry;
  } catch (err) {
    console.warn('[PartnerService] addPartnerRating failed:', err);
    return null;
  }
}

function getStoredEarnings(partnerId) {
  const currentId = partnerId || getActivePartner()?.id;
  const key = currentId ? `fixit_partner_earnings_${currentId}` : PARTNER_EARNINGS_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  // Only demo master plumber Rajesh Kumar (id: 101) starts with seeded demo earnings
  if (currentId === 101 || currentId === '101') {
    return mockPartnerEarnings;
  }

  // Any newly registered partner starts at 0 earnings, 0 jobs, and empty ledger
  return {
    partner_id: currentId,
    total_earnings: 0.0,
    total_jobs: 0,
    today_earnings: 0.0,
    today_jobs: 0,
    this_week_earnings: 0.0,
    this_week_jobs: 0,
    this_month_earnings: 0.0,
    ledger: [],
  };
}

function saveStoredEarnings(earnings, partnerId) {
  const currentId = partnerId || getActivePartner()?.id;
  const key = currentId ? `fixit_partner_earnings_${currentId}` : PARTNER_EARNINGS_KEY;
  try {
    localStorage.setItem(key, JSON.stringify(earnings));
  } catch {
    // ignore
  }
}

/* ========================================================================== */
/* 1. SESSION & DEMO PARTNER SWITCHER                                         */
/* ========================================================================== */

/**
 * Returns the currently active partner session
 */
export function getActivePartner() {
  try {
    const raw = localStorage.getItem(PARTNER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      try {
        const userRaw = localStorage.getItem('fixit_user');
        if (userRaw) {
          const authUser = JSON.parse(userRaw);
          if (authUser.role === 'partner' && (!parsed.id || parsed.id === authUser.id)) {
            return { ...parsed, ...authUser };
          }
        }
      } catch {
        // ignore
      }
      return parsed;
    }
  } catch {
    // fallback
  }

  try {
    const userRaw = localStorage.getItem('fixit_user');
    if (userRaw) {
      const authUser = JSON.parse(userRaw);
      if (authUser.role === 'partner') return authUser;
    }
  } catch {
    // fallback
  }

  return mockPartners[0]; // Default to Rajesh Kumar (Verified Master Plumber)
}

/**
 * Sets active partner session
 */
export function setActivePartner(partner) {
  if (!partner) {
    localStorage.removeItem(PARTNER_STORAGE_KEY);
  } else {
    localStorage.setItem(PARTNER_STORAGE_KEY, JSON.stringify(partner));
    try {
      const userRaw = localStorage.getItem('fixit_user');
      if (userRaw) {
        const authUser = JSON.parse(userRaw);
        if (authUser.role === 'partner' && (!partner.id || authUser.id === partner.id)) {
          const merged = { ...authUser, ...partner };
          localStorage.setItem('fixit_user', JSON.stringify(merged));
          localStorage.setItem('fixit_partner_user', JSON.stringify(merged));
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Switch between 6 key demo states for testing & verification:
 * - 'verified': Rajesh Kumar (Verified KYC, Active Subscription, Master Plumber)
 * - 'pending_kyc': Sunil Mistry (Pending KYC, Carpentry)
 * - 'rejected_kyc': Vikram Joshi (Rejected KYC with reason, Appliance)
 * - 'warning_plan': Ramesh Sharma (Plan expiring in 2 days, Warning Alert, Electrician)
 * - 'expired_plan': Dinesh Nair (Plan expired, Lockout Screen, Masonry)
 * - 'new_partner': Mohan Sharma (Fresh registered partner needing plan selection & KYC)
 */
export async function switchDemoPartnerAccount(type) {
  await new Promise((resolve) => setTimeout(resolve, 150));

  let partner;
  if (type === 'pending_kyc') {
    partner = mockPartners.find((p) => p.id === 103) || mockPartners[2];
    partner = { ...partner, kyc_status: 'pending', rejection_reason: null };
  } else if (type === 'rejected_kyc') {
    partner = mockPartners.find((p) => p.id === 104) || mockPartners[3];
    partner = {
      ...partner,
      kyc_status: 'rejected',
      rejection_reason:
        'Trade qualification certificate illegible. Please upload a clear color PDF scan of your certification.',
    };
  } else if (type === 'warning_plan') {
    partner = mockPartners.find((p) => p.id === 105) || mockPartners[1];
    partner = { ...partner, kyc_status: 'verified' };
  } else if (type === 'expired_plan') {
    partner = mockPartners.find((p) => p.id === 106) || {
      id: 106,
      name: 'Dinesh Nair',
      email: 'dinesh.mason@fixitnow.local',
      service_name: 'Masonry & Tiling',
      kyc_status: 'verified',
      online: false,
      total_jobs: 38,
      rating: 4.8,
    };
  } else if (type === 'new_partner') {
    partner = {
      id: 'new_partner_demo',
      name: 'Mohan Sharma',
      email: 'naveen.lock@fixitnow.local',
      phone: '+91 98111 22334',
      service_id: 1,
      service_name: 'Electrician',
      online: false,
      kyc_status: 'not_submitted',
      subscription_status: 'unsubscribed',
      rating: 5.0,
      total_jobs: 0,
      badge: 'New Tradesperson Pro',
      vehicle: 'Hero Passion Pro',
      avatar_color: '#FF5B14',
      address: '22, HAL Airport Road, Kodihalli, Bengaluru',
    };
  } else {
    // verified (default)
    partner = mockPartners[0];
  }

  setActivePartner(partner);
  return partner;
}

/**
 * Toggle Partner Online/Offline status (SRS FR-P8)
 * Only KYC-verified & unexpired partners may go online (FR-M3)
 */
export async function togglePartnerOnline(_partnerId) {
  try {
    const res = await put('/api/partner/online');
    if (res && res.status === 'success') {
      const current = getActivePartner();
      const updated = {
        ...current,
        ...(res.partner || {}),
        online: res.online,
      };
      setActivePartner(updated);
      return updated;
    }
  } catch (err) {
    // If the server explicitly rejected with 403 or validation error, rethrow error
    if (err.message && (err.message.includes('KYC') || err.message.includes('subscription') || err.message.includes('Required role'))) {
      throw err;
    }
    console.warn('[PartnerService] togglePartnerOnline backend request failed, using local check:', err.message);
  }

  const current = getActivePartner();

  if (current.kyc_status !== 'verified') {
    throw new Error('KYC verification is required before you can go online to receive requests (SRS FR-P7, FR-M3).');
  }

  const sub = await getPartnerSubscription(current.id);
  if (!sub || sub.status === 'expired' || sub.days_remaining <= 0) {
    throw new Error('Your subscription has expired. Please renew your plan to go online (SRS FR-P3).');
  }

  const updated = {
    ...current,
    online: !current.online,
  };

  setActivePartner(updated);
  return updated;
}

/* ========================================================================== */
/* 2. DASHBOARD DATA (SRS Section 3.3, FR-P7)                                 */
/* ========================================================================== */

export async function getPartnerDashboardData(partnerId) {
  try {
    const res = await get('/api/partner/dashboard');
    if (res && res.status === 'success' && res.data) {
      const activeJob = getActiveJob();
      const currentPartner = getActivePartner();
      const earnings = getStoredEarnings(partnerId || currentPartner?.id);

      if (res.data.partner) {
        const merged = { ...currentPartner, ...res.data.partner };
        setActivePartner(merged);
      }

      return {
        ...res.data,
        active_job: activeJob,
        today_jobs: earnings.today_jobs ?? res.data.stats?.today_jobs ?? 0,
        today_earnings: earnings.today_earnings ?? res.data.stats?.today_earnings ?? 0.0,
      };
    }
  } catch (err) {
    console.warn('[PartnerService] getPartnerDashboardData from backend failed, using local session:', err.message);
  }

  const partner = getActivePartner();
  const subscription = await getPartnerSubscription(partner?.id);
  const kyc = await getPartnerKyc(partner?.id);
  const earnings = getStoredEarnings(partner?.id);
  const activeJob = getActiveJob();

  const isSubscribed = Boolean(subscription && subscription.status === 'active' && subscription.days_remaining > 0);
  const isLocked = !isSubscribed;
  const isExpiringSoon = Boolean(subscription && subscription.is_expiring_soon);

  return {
    partner,
    subscription,
    kyc,
    today_jobs: earnings.today_jobs ?? 0,
    today_earnings: earnings.today_earnings ?? 0.0,
    total_jobs: partner?.total_jobs ?? earnings.total_jobs ?? 0,
    rating: partner?.rating || 4.9,
    active_job: activeJob,
    is_subscribed: isSubscribed,
    is_locked: isLocked,
    warning_expiry: isExpiringSoon,
  };
}

/* ========================================================================== */
/* 3. SUBSCRIPTION & PLAN MANAGEMENT (SRS FR-P2, FR-P13, FR-P14, FR-P15)       */
/* ========================================================================== */

/**
 * Fetch available subscription plans from PostgreSQL
 * (Quarterly, Half-yearly, Yearly - longer = cheaper per month)
 */
export async function getSubscriptionPlans() {
  try {
    const res = await get('/api/partner/plans');
    if (res && res.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (err) {
    console.warn('[PartnerService] getSubscriptionPlans failed, trying fallback:', err.message);
    try {
      const fallback = await get('/api/plans');
      if (fallback && fallback.data && Array.isArray(fallback.data)) {
        return fallback.data;
      }
    } catch {
      // ignore
    }
  }

  // Fallback plans if server is temporarily unreachable
  return [
    { id: 1, name: 'quarterly', duration_months: 3, price: 899.0, monthly_equivalent: 300, active: true },
    { id: 2, name: 'half-yearly', duration_months: 6, price: 1599.0, monthly_equivalent: 266, active: true },
    { id: 3, name: 'yearly', duration_months: 12, price: 2799.0, monthly_equivalent: 233, active: true },
  ];
}

/**
 * Fetch current partner subscription status
 */
export async function getPartnerSubscription(partnerId) {
  try {
    const res = await get('/api/partner/subscription');
    if (res && res.status === 'success') {
      return res.data;
    }
  } catch (err) {
    console.warn('[PartnerService] getPartnerSubscription failed:', err.message);
  }

  // Fallback demo subscription for unauthenticated demo switcher
  const current = getActivePartner();
  if (current?.email === 'dinesh.mason@fixitnow.local') {
    return {
      partner_id: partnerId,
      plan_id: 1,
      plan_name: 'Quarterly',
      duration_months: 3,
      price_paid: 899.0,
      start_date: '2026-07-10T00:00:00Z',
      end_date: '2026-10-10T23:59:59Z',
      days_remaining: 0,
      status: 'expired',
      is_expiring_soon: false,
    };
  }

  if (current?.email === 'naveen.lock@fixitnow.local' || current?.id === 'new_partner_demo') {
    return null; // Unsubscribed
  }

  return {
    partner_id: Number(partnerId) || 101,
    plan_id: 2,
    plan_name: 'Half-yearly',
    duration_months: 6,
    price_paid: 1599.0,
    start_date: '2026-08-01T00:00:00Z',
    end_date: '2027-02-01T23:59:59Z',
    days_remaining: 108,
    status: 'active',
    is_expiring_soon: false,
  };
}

/**
 * Select or Renew a Plan (Simulated payment, SRS FR-P2, FR-P14)
 * Stores start and end dates and the exact price paid at that time
 */
export async function selectOrRenewPlan(partnerId, planId) {
  try {
    const res = await post('/api/partner/subscribe', { plan_id: Number(planId) });
    if (res && res.data) {
      const newSub = res.data;
      const current = getActivePartner();
      if (current) {
        setActivePartner({
          ...current,
          subscription_status: 'active',
        });
      }
      return newSub;
    }
  } catch (err) {
    console.warn('[PartnerService] Backend subscription failed, using local simulation:', err.message);
  }

  // Local fallback simulation if offline
  const plans = await getSubscriptionPlans();
  const plan = plans.find((p) => p.id === Number(planId)) || plans[0];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + plan.duration_months);

  const newSub = {
    partner_id: partnerId,
    plan_id: plan.id,
    plan_name: plan.name,
    duration_months: plan.duration_months,
    price_paid: plan.price,
    start_date: now.toISOString(),
    end_date: endDate.toISOString(),
    days_remaining: plan.duration_months * 30,
    status: 'active',
    is_expiring_soon: false,
  };

  const current = getActivePartner();
  if (current) {
    setActivePartner({
      ...current,
      subscription_status: 'active',
    });
  }

  return newSub;
}

/* ========================================================================== */
/* 4. KYC VERIFICATION (SRS FR-P4, FR-P5, FR-P7)                              */
/* ========================================================================== */

/**
 * Get current partner KYC status and uploaded documents
 */
export async function getPartnerKyc(partnerId) {
  try {
    const res = await get('/api/partner/kyc');
    if (res && res.status === 'success' && res.data) {
      const current = getActivePartner();
      if (current && res.data.status && current.kyc_status !== res.data.status) {
        setActivePartner({
          ...current,
          kyc_status: res.data.status,
          rejection_reason: res.data.rejection_reason || null,
        });
      }
      return res.data;
    }
  } catch (err) {
    console.warn('[PartnerService] getPartnerKyc failed:', err.message);
  }

  const current = getActivePartner();
  const isSubmitted = current?.kyc_status && current.kyc_status !== 'not_submitted';
  return {
    partner_id: partnerId,
    govt_id_type: 'Aadhaar Card',
    id_number: isSubmitted ? '•••• •••• 1024' : '',
    status: current?.kyc_status || 'not_submitted',
    rejection_reason: current?.rejection_reason || null,
    submitted_at: new Date().toISOString(),
    documents: [],
  };
}

/**
 * Submit KYC documents & passport photo (SRS FR-P4)
 * Uses Multer multipart/form-data upload
 */
export async function submitPartnerKyc(partnerId, payload) {
  let formData;
  if (payload instanceof FormData) {
    formData = payload;
  } else {
    formData = new FormData();
    if (payload.govt_id_type) formData.append('govt_id_type', payload.govt_id_type);
    if (payload.id_number) formData.append('id_number', payload.id_number);
    if (payload.documentFile) formData.append('document', payload.documentFile);
    if (payload.photoFile) formData.append('photo', payload.photoFile);
    if (payload.tradeCertFile) formData.append('trade_cert', payload.tradeCertFile);
  }

  try {
    const res = await postFormData('/api/partner/kyc', formData);
    if (res && res.status === 'success') {
      const current = getActivePartner();
      if (current) {
        setActivePartner({
          ...current,
          kyc_status: 'pending',
          rejection_reason: null,
        });
      }
      return {
        status: 'pending',
        partner_id: partnerId,
        govt_id_type: payload.govt_id_type || 'Aadhaar Card',
        id_number: payload.id_number || '',
        submitted_at: new Date().toISOString(),
        ...res.data,
      };
    }
  } catch (err) {
    console.warn('[PartnerService] Backend KYC upload failed, falling back to local simulation:', err.message);
    throw err;
  }

  // Local fallback
  const current = getActivePartner();
  if (current) {
    setActivePartner({
      ...current,
      kyc_status: 'pending',
      rejection_reason: null,
    });
  }

  return {
    partner_id: partnerId,
    govt_id_type: payload.govt_id_type || 'Aadhaar Card',
    id_number: payload.id_number || '',
    status: 'pending',
    submitted_at: new Date().toISOString(),
    document_name: payload.documentFile?.name || 'Identity_Document.pdf',
    photo_name: payload.photoFile?.name || 'passport_photo.jpg',
    trade_cert_name: payload.tradeCertFile?.name || 'Trade_Certificate.pdf',
  };
}

/**
 * Resubmit KYC documents (e.g., after rejection)
 */
export async function resubmitPartnerKyc(partnerId, kycPayload) {
  return submitPartnerKyc(partnerId, kycPayload);
}

/**
 * Review Partner KYC decision (Admin decision / testing helper)
 */
export async function reviewPartnerKyc(partnerId, decision, rejection_reason = null) {
  try {
    const res = await put(`/api/partner/kyc/${partnerId}/decision`, {
      decision,
      rejection_reason,
    });
    if (res && res.status === 'success') {
      const current = getActivePartner();
      if (current) {
        setActivePartner({
          ...current,
          kyc_status: decision,
          rejection_reason: decision === 'rejected' ? rejection_reason : null,
        });
      }
      return res.data;
    }
  } catch (err) {
    console.warn('[PartnerService] reviewPartnerKyc error:', err.message);
  }

  const current = getActivePartner();
  if (current) {
    setActivePartner({
      ...current,
      kyc_status: decision,
      rejection_reason: decision === 'rejected' ? rejection_reason : null,
    });
  }
  return { partner_id: partnerId, kyc_status: decision, rejection_reason };
}

/* ========================================================================== */
/* 5. ACTIVE JOB LIFECYCLE (SRS FR-P9, FR-P10, FR-T2, docs/DESIGN.md line 90) */
/* ========================================================================== */

export function getActiveJob() {
  try {
    const raw = localStorage.getItem(PARTNER_ACTIVE_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveJob(job) {
  if (!job) {
    localStorage.removeItem(PARTNER_ACTIVE_JOB_KEY);
  } else {
    localStorage.setItem(PARTNER_ACTIVE_JOB_KEY, JSON.stringify(job));
  }
}

/**
 * Advance Active Job to next step (single primary next-action button)
 */
export async function advanceJobStep(jobId, currentStep, enteredOtp = null) {
  const job = getActiveJob();

  // 1. If at 'arrived' or 'partner_arrived', partner submits OTP to server for verification
  if (currentStep === 'arrived' || currentStep === 'partner_arrived') {
    try {
      const res = await post(`/api/requests/${jobId}/verify-otp`, {
        otp: enteredOtp?.toString().trim(),
      });
      if (res && res.status === 'success') {
        const updated = {
          ...(job || {}),
          id: jobId,
          status: 'service_started',
          step_index: 4,
          service_started_at: new Date().toISOString(),
          otp_verified: true,
        };
        setActiveJob(updated);
        return updated;
      }
    } catch (err) {
      throw new Error(err.message || 'OTP verification failed.');
    }
  }

  // 2. Map other status transitions (SRS FR-P9)
  const nextStatusMap = {
    accepted: 'partner_on_way',
    start_trip: 'partner_on_way',
    on_the_way: 'partner_arrived',
    partner_on_way: 'partner_arrived',
    arrived: 'service_started',
    partner_arrived: 'service_started',
    in_progress: 'service_completed',
    service_started: 'service_completed',
    completed: 'payment_completed',
    service_completed: 'payment_completed',
  };
  const nextStepIndexMap = {
    accepted: 2,
    start_trip: 2,
    on_the_way: 3,
    partner_on_way: 3,
    arrived: 4,
    partner_arrived: 4,
    in_progress: 5,
    service_started: 5,
    completed: 6,
    service_completed: 6,
  };

  const targetStatus = nextStatusMap[currentStep] || currentStep;
  const targetStep = nextStepIndexMap[currentStep] || 1;

  // Try real backend API
  try {
    await put(`/api/requests/${jobId}/status`, { status: targetStatus });
  } catch (apiErr) {
    console.warn('[PartnerService API update warning]:', apiErr.message);
  }

  // If completed / paid: direct cash/UPI settlement confirmed
  if (targetStatus === 'payment_completed' || targetStatus === 'paid') {
    const settlementAmount = job?.amount || 450.0;
    const currentPartner = getActivePartner();
    const earnings = getStoredEarnings(currentPartner?.id);
    const orderNum =
      job?.order_number ||
      `ORD-${String(jobId).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

    const newEntry = {
      id: Date.now(),
      order_number: orderNum,
      customer_name: job?.customer_name || 'Customer',
      service_name: job?.service_name || 'Service',
      problem: job?.problem || 'Completed Repair Work',
      amount: settlementAmount,
      payment_mode: 'Direct Cash / UPI (On-site)',
      date: new Date().toISOString(),
      status: 'settled',
    };

    const updatedEarnings = {
      ...earnings,
      total_earnings: (earnings.total_earnings || 0) + settlementAmount,
      total_jobs: (earnings.total_jobs || 0) + 1,
      today_earnings: (earnings.today_earnings || 0) + settlementAmount,
      today_jobs: (earnings.today_jobs || 0) + 1,
      this_week_earnings: (earnings.this_week_earnings || 0) + settlementAmount,
      this_month_earnings: (earnings.this_month_earnings || 0) + settlementAmount,
      ledger: [newEntry, ...(earnings.ledger || [])],
    };
    saveStoredEarnings(updatedEarnings, currentPartner?.id);

    // Save completed job to partner audit history
    savePartnerRecentJob({
      id: jobId || Date.now(),
      order_number: orderNum,
      customer_name: job?.customer_name || 'Customer',
      customer_phone: job?.customer_phone || '+91 98765 43210',
      service_name: job?.service_name || 'Service Call',
      problem: job?.problem || job?.description || 'Completed Repair Work',
      address: job?.address || 'Site Location, Bengaluru',
      status: 'completed',
      amount: settlementAmount,
      payment_mode: 'Direct Cash / UPI (On-site)',
      completed_at: new Date().toISOString(),
      rating: job?.rating || null,
    });

    // Clear active job so partner radar is free
    setActiveJob(null);

    return {
      id: jobId,
      status: 'payment_completed',
      step_index: 6,
      settlement: {
        ...newEntry,
        payment_confirmed: true,
      },
    };
  }

  // If partner completes service work, record completed entry into history
  if (targetStatus === 'service_completed' || targetStatus === 'completed') {
    savePartnerRecentJob({
      id: jobId || Date.now(),
      order_number:
        job?.order_number ||
        `ORD-${String(jobId).replace(/-/g, '').slice(0, 4).toUpperCase()}`,
      customer_name: job?.customer_name || 'Customer',
      customer_phone: job?.customer_phone || '+91 98765 43210',
      service_name: job?.service_name || 'Service Call',
      problem: job?.problem || job?.description || 'Service Work',
      address: job?.address || 'Site Location, Bengaluru',
      status: 'completed',
      amount: job?.amount || 450.0,
      payment_mode: 'Direct Cash / UPI (On-site)',
      completed_at: new Date().toISOString(),
      rating: job?.rating || null,
    });
  }

  const updated = {
    ...(job || {}),
    id: jobId,
    status: targetStatus,
    step_index: targetStep,
  };
  setActiveJob(updated);
  return updated;
}

/**
 * Accept Incoming Request (SRS FR-P9)
 */
export async function acceptIncomingJob(jobData) {
  const reqId = jobData?.id || jobData?.request_id;
  try {
    if (reqId) {
      await post(`/api/requests/${reqId}/respond`, { decision: 'accept' });
    }
  } catch (apiErr) {
    console.warn('[PartnerService Accept API Warning]:', apiErr.message);
  }

  const newActiveJob = {
    ...jobData,
    id: reqId,
    status: 'accepted',
    step_index: 1,
    accepted_at: new Date().toISOString(),
  };

  setActiveJob(newActiveJob);
  return newActiveJob;
}

/**
 * Decline Incoming Request (SRS FR-P7)
 */
export async function declineIncomingJob(_jobId) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { success: true, message: 'Request declined. Remaining online for next dispatch.' };
}

/**
 * Trigger mock incoming job dispatch for testing / demonstration
 */
export function getMockIncomingJob() {
  return {
    ...mockIncomingJob,
    id: Date.now(),
    order_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    created_at: new Date().toISOString(),
  };
}

/**
 * Simulate Customer Cancellation (SRS FR-C19, FR-T3)
 */
export async function simulateCustomerCancel(jobId, reason = 'Customer cancelled due to emergency.') {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const job = getActiveJob();
  const orderNum =
    job?.order_number ||
    `ORD-${String(jobId || 428).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  // Save cancellation record to partner history
  savePartnerRecentJob({
    id: jobId || job?.id || Date.now(),
    order_number: orderNum,
    customer_name: job?.customer_name || 'Customer',
    customer_phone: job?.customer_phone || '+91 98765 43210',
    service_name: job?.service_name || 'Service Call',
    problem: job?.problem || job?.description || 'Emergency Dispatch',
    address: job?.address || 'Customer site location',
    status: 'cancelled',
    amount: 0,
    cancel_reason: reason,
    completed_at: new Date().toISOString(),
    rating: null,
  });

  setActiveJob(null);
  return {
    cancelled: true,
    reason,
    message: 'Customer cancelled the request. You are now free for new dispatches.',
  };
}

/* ========================================================================== */
/* 6. EARNINGS & RATINGS (SRS FR-P11, FR-P12, BR-7)                           */
/* ========================================================================== */

export async function getPartnerEarnings(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getStoredEarnings(partnerId);
}

/**
 * Get Partner Ratings, Scorecard & Recent Verified Customer Reviews (SRS FR-P11)
 * Combines server ratings, local storage ratings from customer submissions, and verified testimonials.
 */
export async function getPartnerRatings(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 150));

  let apiReviews = [];
  try {
    let res;
    try {
      res = await get('/api/partner/ratings');
    } catch {
      res = await get('/api/partners/ratings');
    }
    if (res && res.status === 'success' && res.data) {
      if (Array.isArray(res.data.recent_reviews) && res.data.recent_reviews.length > 0) {
        apiReviews = res.data.recent_reviews;
      } else if (Array.isArray(res.data.reviews) && res.data.reviews.length > 0) {
        apiReviews = res.data.reviews;
      }
    }
  } catch {
    // Backend may be unauthenticated
  }

  // Also harvest any rated requests directly from /api/requests
  try {
    const reqRes = await get('/api/requests?filter=all');
    if (reqRes && reqRes.status === 'success' && Array.isArray(reqRes.data)) {
      for (const item of reqRes.data) {
        const itemStars = item.rating?.stars || item.rating_stars;
        const itemComment = item.rating?.comment || item.rating_comment;
        if (itemStars) {
          const ordId =
            item.order_number ||
            `ORD-${String(item.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
          apiReviews.push({
            id: `req-${item.id}`,
            order_number: ordId,
            order_id: ordId,
            customer_name: item.customer_name || 'Customer',
            stars: itemStars,
            date: item.completed_at || item.updated_at || item.created_at || new Date().toISOString(),
            comment: itemComment || 'Service completed promptly and professionally.',
            service_name: item.service_name || 'Home Service',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // Load newly submitted ratings from localStorage
  let localRecentRatings = [];
  try {
    const raw = localStorage.getItem(PARTNER_RECENT_RATINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localRecentRatings.push(...parsed);
    }
  } catch {
    // ignore
  }

  // Also check PARTNER_RECENT_JOBS_KEY for completed jobs with ratings
  try {
    const rawJobs = localStorage.getItem(PARTNER_RECENT_JOBS_KEY);
    if (rawJobs) {
      const parsedJobs = JSON.parse(rawJobs);
      if (Array.isArray(parsedJobs)) {
        for (const job of parsedJobs) {
          if (job.rating && job.rating.stars) {
            localRecentRatings.push({
              id: `job-${job.id || job.order_number}`,
              order_number: job.order_number,
              order_id: job.order_number,
              customer_name: job.customer_name || 'Customer',
              stars: job.rating.stars,
              date: job.completed_at || new Date().toISOString(),
              comment: job.rating.comment,
              service_name: job.service_name,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const baseReviews = (mockPartnerRatings.reviews || []).map((r) => ({
    id: r.id,
    order_number: r.order_number,
    order_id: r.order_number,
    customer_name: r.customer_name,
    stars: r.stars,
    date: r.date,
    comment: r.comment,
    service_name: r.service_name,
  }));

  // Merge recent customer reviews at the top, followed by API reviews and baseline reviews
  const seenReviews = new Set();
  const allReviews = [];

  for (const rev of [...localRecentRatings, ...apiReviews, ...baseReviews]) {
    const key = rev.order_number || rev.order_id || String(rev.id);
    if (!seenReviews.has(key)) {
      seenReviews.add(key);
      allReviews.push({
        ...rev,
        order_number: rev.order_number || rev.order_id || 'ORD-0428',
        order_id: rev.order_number || rev.order_id || 'ORD-0428',
      });
    }
  }

  // Recalculate dynamic star breakdown and average aggregate score
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumStars = 0;
  allReviews.forEach((r) => {
    const s = Math.max(1, Math.min(5, Number(r.stars) || 5));
    breakdown[s] = (breakdown[s] || 0) + 1;
    sumStars += s;
  });

  const totalReviews = allReviews.length;
  const average = totalReviews > 0 ? parseFloat((sumStars / totalReviews).toFixed(2)) : 4.9;

  return {
    partner_id: partnerId,
    average,
    average_rating: average,
    total_reviews: totalReviews,
    breakdown,
    distribution: breakdown,
    recent_reviews: allReviews,
    reviews: allReviews,
  };
}

/* ========================================================================== */
/* 7. REQUEST HISTORY (SRS FR-P11, BR-6)                                      */
/* ========================================================================== */

/**
 * Get Partner Job History log.
 * Fetches recent completed and cancelled jobs from live database, local session storage, and baseline audit logs.
 */
export async function getPartnerHistory(partnerId, filter = 'ALL') {
  await new Promise((resolve) => setTimeout(resolve, 150));

  let apiJobs = [];
  try {
    const res = await get('/api/requests?filter=all');
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      apiJobs = res.data.map((r) => {
        const normStatus =
          r.status === 'service_completed' ||
          r.status === 'payment_completed' ||
          r.status === 'paid' ||
          r.status === 'completed'
            ? 'completed'
            : r.status === 'cancelled'
            ? 'cancelled'
            : r.status;

        return {
          id: r.id,
          order_number:
            r.order_number ||
            `ORD-${String(r.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`,
          customer_name: r.customer_name || 'Customer',
          customer_phone: r.customer_phone || '+91 98765 43210',
          service_name: r.service_name || 'Service Call',
          problem: r.problem || r.description || 'Service Work',
          address: r.address || 'Indiranagar, Bengaluru',
          status: normStatus,
          amount: parseFloat(r.amount || r.base_price_estimate) || 450.0,
          payment_mode: r.payment_mode || 'Direct UPI / Cash (On-site)',
          completed_at: r.completed_at || r.updated_at || r.created_at,
          rating:
            r.rating ||
            (r.rating_stars
              ? { stars: r.rating_stars, comment: r.rating_comment }
              : null),
          cancel_reason:
            r.cancel_reason ||
            (normStatus === 'cancelled' ? 'Cancelled by customer' : undefined),
        };
      });
    }
  } catch {
    // Backend may be offline or unauthenticated
  }

  // Load locally saved recent completed & cancelled jobs
  let localRecentJobs = [];
  try {
    const raw = localStorage.getItem(PARTNER_RECENT_JOBS_KEY);
    if (raw) {
      localRecentJobs = JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  const baselineList = [
    {
      id: 427,
      order_number: 'ORD-0427',
      customer_name: 'Arjun Swaminathan',
      customer_phone: '+91 97410 11998',
      service_name: 'Plumbing Repairs',
      problem: 'Flush valve tank overflowing continuously',
      address: '104, Palm Grove, 6th Main, Indiranagar, Bengaluru',
      status: 'completed',
      amount: 450.0,
      payment_mode: 'Direct UPI (On-site)',
      completed_at: '2026-10-16T10:45:00Z',
      rating: { stars: 5, comment: 'Quick fix, courteous professional.' },
    },
    {
      id: 426,
      order_number: 'ORD-0426',
      customer_name: 'Pooja Hegde',
      customer_phone: '+91 98860 33412',
      service_name: 'Plumbing Repairs',
      problem: 'Overhead water tank ball valve jammed',
      address: '77, 12th Cross, Indiranagar 2nd Stage, Bengaluru',
      status: 'completed',
      amount: 500.0,
      payment_mode: 'Direct Cash (On-site)',
      completed_at: '2026-10-16T08:30:00Z',
      rating: { stars: 5, comment: 'Arrived in 10 minutes. Clean job.' },
    },
    {
      id: 425,
      order_number: 'ORD-0425',
      customer_name: 'Ananya Sharma',
      customer_phone: '+91 98765 43210',
      service_name: 'Plumbing Repairs',
      problem: 'Under-sink kitchen drain pipe leaking profusely',
      address: '42, 3rd Cross, Indiranagar, Bengaluru',
      status: 'completed',
      amount: 400.0,
      payment_mode: 'Direct UPI (On-site)',
      completed_at: '2026-10-10T10:15:00Z',
      rating: { stars: 5, comment: 'Replaced the pipe cleanly. Excellent work.' },
    },
    {
      id: 420,
      order_number: 'ORD-0420',
      customer_name: 'Sunita Rao',
      customer_phone: '+91 98450 77112',
      service_name: 'Plumbing Repairs',
      problem: 'Bathroom floor drain blocked with cement residue',
      address: '52, 1st Cross, Domlur, Bengaluru',
      status: 'cancelled',
      amount: 0,
      cancel_reason: 'Customer rescheduled due to sudden travel.',
      completed_at: '2026-10-09T16:00:00Z',
      rating: null,
    },
  ];

  // Merge: Local recent jobs first, then API jobs, then baseline
  const seenOrders = new Set();
  const merged = [];

  for (const job of [...localRecentJobs, ...apiJobs, ...baselineList]) {
    const key = job.order_number || String(job.id);
    if (!seenOrders.has(key)) {
      seenOrders.add(key);
      merged.push(job);
    }
  }

  // Synchronize any submitted ratings from fixit_recent_ratings onto the jobs
  try {
    const rawRatings = localStorage.getItem(PARTNER_RECENT_RATINGS_KEY);
    if (rawRatings) {
      const ratings = JSON.parse(rawRatings);
      const ratingMap = {};
      ratings.forEach((r) => {
        if (r.order_number) ratingMap[r.order_number] = r;
      });
      merged.forEach((j) => {
        if (!j.rating && ratingMap[j.order_number]) {
          const r = ratingMap[j.order_number];
          j.rating = { stars: r.stars, comment: r.comment };
        }
      });
    }
  } catch {
    // ignore
  }

  // Sort descending by date (most recent job at the very top)
  merged.sort(
    (a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0)
  );

  if (filter === 'COMPLETED') {
    return merged.filter((r) => r.status === 'completed');
  }
  if (filter === 'CANCELLED') {
    return merged.filter((r) => r.status === 'cancelled');
  }
  return merged;
}

/* ========================================================================== */
/* 8. PROFILE MANAGEMENT (SRS FR-P11)                                         */
/* ========================================================================== */

export async function updatePartnerProfile(partnerId, profileData) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const current = getActivePartner();

  const updated = {
    ...current,
    name: profileData.name?.trim() || current.name,
    phone: profileData.phone?.trim() || current.phone,
    address: profileData.address?.trim() || current.address,
    vehicle: profileData.vehicle?.trim() || current.vehicle,
  };

  setActivePartner(updated);
  return updated;
}

/* ========================================================================== */
/* 9. ELIGIBILITY MATCHING (Backward compatible with customer portal)          */
/* ========================================================================== */

export async function getEligiblePartnerForTrade(serviceId) {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const numServiceId = Number(serviceId);
  const found = mockPartners.find(
    (p) => p.service_id === numServiceId && p.online && p.kyc_status === 'verified'
  );

  if (found) {
    return {
      ...found,
      distance_km: 0.8,
      estimated_arrival_minutes: 14,
    };
  }

  const fallback = mockPartners[0];
  return {
    ...fallback,
    distance_km: 1.1,
    estimated_arrival_minutes: 16,
  };
}

export async function getPartnerById(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const found = mockPartners.find((p) => p.id === Number(partnerId));
  return found || mockPartners[0];
}

export default {
  getActivePartner,
  setActivePartner,
  switchDemoPartnerAccount,
  togglePartnerOnline,
  getPartnerDashboardData,
  getPartnerSubscription,
  getSubscriptionPlans,
  selectOrRenewPlan,
  getPartnerKyc,
  submitPartnerKyc,
  resubmitPartnerKyc,
  reviewPartnerKyc,
  getActiveJob,
  setActiveJob,
  advanceJobStep,
  acceptIncomingJob,
  declineIncomingJob,
  getMockIncomingJob,
  simulateCustomerCancel,
  getPartnerEarnings,
  getPartnerRatings,
  getPartnerHistory,
  savePartnerRecentJob,
  addPartnerRating,
  updatePartnerProfile,
  getEligiblePartnerForTrade,
  getPartnerById,
};
