/**
 * FixIt Now - Partner Service
 * Manages partner dashboard data, subscription plans, KYC verification,
 * live dispatch radar, active job state progression, earnings, ratings, and history.
 * Conforms to SRS FR-P1 to FR-P15 and docs/DESIGN.md.
 */

import {
  mockPartners,
  mockSubscriptions,
  mockKycDocuments,
  mockPartnerEarnings,
  mockPartnerRatings,
  mockIncomingJob,
  mockPlans,
} from '../mockData';

const PARTNER_STORAGE_KEY = 'fixit_current_partner';
const PARTNER_SUBSCRIPTIONS_KEY = 'fixit_partner_subscriptions_list';
const PARTNER_KYC_KEY = 'fixit_partner_kyc_list';
const PARTNER_EARNINGS_KEY = 'fixit_partner_earnings_data';
const PARTNER_ACTIVE_JOB_KEY = 'fixit_partner_active_job';

function getStoredSubscriptions() {
  try {
    const raw = localStorage.getItem(PARTNER_SUBSCRIPTIONS_KEY);
    return raw ? JSON.parse(raw) : mockSubscriptions;
  } catch {
    return mockSubscriptions;
  }
}

function saveStoredSubscriptions(subs) {
  try {
    localStorage.setItem(PARTNER_SUBSCRIPTIONS_KEY, JSON.stringify(subs));
  } catch {
    // ignore
  }
}

function getStoredKycList() {
  try {
    const raw = localStorage.getItem(PARTNER_KYC_KEY);
    return raw ? JSON.parse(raw) : mockKycDocuments;
  } catch {
    return mockKycDocuments;
  }
}

function saveStoredKycList(list) {
  try {
    localStorage.setItem(PARTNER_KYC_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function getStoredEarnings() {
  try {
    const raw = localStorage.getItem(PARTNER_EARNINGS_KEY);
    return raw ? JSON.parse(raw) : mockPartnerEarnings;
  } catch {
    return mockPartnerEarnings;
  }
}

function saveStoredEarnings(earnings) {
  try {
    localStorage.setItem(PARTNER_EARNINGS_KEY, JSON.stringify(earnings));
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
    if (raw) return JSON.parse(raw);
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
  }
}

/**
 * Switch between 6 key demo states for testing & verification:
 * - 'verified': Rajesh Kumar (Verified KYC, Active Subscription, Master Plumber)
 * - 'pending_kyc': Sunil Mistry (Pending KYC, Carpentry)
 * - 'rejected_kyc': Vikram Joshi (Rejected KYC with reason, Appliance)
 * - 'warning_plan': Kiran Patel (Plan expiring in 2 days, Warning Alert, AC Tech)
 * - 'expired_plan': Dinesh Nair (Plan expired, Lockout Screen, Masonry)
 * - 'new_partner': Fresh registered partner needing plan selection & KYC
 */
export async function switchDemoPartnerAccount(type) {
  await new Promise((resolve) => setTimeout(resolve, 150));

  let partner;
  if (type === 'pending_kyc') {
    partner = mockPartners.find((p) => p.id === 103) || mockPartners[2];
  } else if (type === 'rejected_kyc') {
    partner = mockPartners.find((p) => p.id === 104) || mockPartners[3];
  } else if (type === 'warning_plan') {
    partner = mockPartners.find((p) => p.id === 105) || mockPartners[4];
  } else if (type === 'expired_plan') {
    partner = mockPartners.find((p) => p.id === 106) || mockPartners[5];
  } else if (type === 'new_partner') {
    partner = {
      id: 999,
      name: 'Mohan Sharma',
      email: 'mohan.sharma@example.com',
      phone: '+91 98111 22334',
      service_id: 1,
      service_name: 'Electrical Work',
      online: false,
      kyc_status: 'pending',
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
  await new Promise((resolve) => setTimeout(resolve, 150));
  const current = getActivePartner();

  if (current.kyc_status !== 'verified') {
    throw new Error('KYC verification is required before you can go online to receive requests.');
  }

  const sub = await getPartnerSubscription(current.id);
  if (sub && sub.status === 'expired') {
    throw new Error('Your subscription has expired. Please renew your plan to go online.');
  }

  const updated = {
    ...current,
    online: !current.online,
  };

  setActivePartner(updated);
  return updated;
}

/* ========================================================================== */
/* 2. DASHBOARD DATA                                                          */
/* ========================================================================== */

export async function getPartnerDashboardData(_partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const partner = getActivePartner();
  const subscription = await getPartnerSubscription(partner.id);
  const kyc = await getPartnerKyc(partner.id);
  const earnings = getStoredEarnings();
  const activeJob = getActiveJob();

  return {
    partner,
    subscription,
    kyc,
    today_jobs: earnings.today_jobs || 2,
    today_earnings: earnings.today_earnings || 950.0,
    total_jobs: partner.total_jobs || 142,
    rating: partner.rating || 4.9,
    active_job: activeJob,
  };
}

/* ========================================================================== */
/* 3. SUBSCRIPTION & PLAN MANAGEMENT (SRS FR-P2, FR-P13, FR-P14, FR-P15)       */
/* ========================================================================== */

export async function getPartnerSubscription(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const subs = getStoredSubscriptions();
  const found = subs.find((s) => s.partner_id === Number(partnerId));

  if (found) return found;

  // Fallback default subscription
  return {
    partner_id: Number(partnerId),
    plan_id: 2,
    plan_name: 'Half-yearly',
    duration_months: 6,
    price_paid: 1599.0,
    start_date: '2026-08-01T00:00:00Z',
    end_date: '2027-02-01T23:59:59Z',
    days_remaining: 108,
    status: 'active',
  };
}

export async function getSubscriptionPlans() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return mockPlans;
}

/**
 * Select or Renew a Plan (Simulated payment, SRS FR-P2, FR-P14)
 */
export async function selectOrRenewPlan(partnerId, planId) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const plan = mockPlans.find((p) => p.id === Number(planId)) || mockPlans[0];

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + plan.duration_months);

  const newSub = {
    partner_id: Number(partnerId),
    plan_id: plan.id,
    plan_name: plan.name,
    duration_months: plan.duration_months,
    price_paid: plan.price,
    start_date: now.toISOString(),
    end_date: endDate.toISOString(),
    days_remaining: plan.duration_months * 30,
    status: 'active',
  };

  const subs = getStoredSubscriptions().filter((s) => s.partner_id !== Number(partnerId));
  const updatedSubs = [newSub, ...subs];
  saveStoredSubscriptions(updatedSubs);

  // Update active partner session status
  const current = getActivePartner();
  if (current.id === Number(partnerId)) {
    const updatedPartner = {
      ...current,
      subscription_status: 'active',
    };
    setActivePartner(updatedPartner);
  }

  return newSub;
}

/* ========================================================================== */
/* 4. KYC VERIFICATION (SRS FR-P4, FR-P5, FR-P7)                              */
/* ========================================================================== */

export async function getPartnerKyc(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const list = getStoredKycList();
  const found = list.find((k) => k.partner_id === Number(partnerId));

  if (found) return found;

  const current = getActivePartner();
  return {
    partner_id: Number(partnerId),
    govt_id_type: 'Aadhaar Card',
    id_number: '•••• •••• 1024',
    status: current.kyc_status || 'pending',
    rejection_reason: current.rejection_reason || null,
    submitted_at: new Date().toISOString(),
    document_name: 'Government_Photo_ID.pdf',
    photo_name: 'partner_passport_photo.png',
    trade_cert_name: 'Trade_Qualification_Cert.pdf',
  };
}

/**
 * Submit KYC documents (SRS FR-P4)
 */
export async function submitPartnerKyc(partnerId, { govt_id_type, id_number, document_name, photo_name, trade_cert_name }) {
  await new Promise((resolve) => setTimeout(resolve, 450));

  if (!govt_id_type || !id_number) {
    throw new Error('Government ID type and ID number are required.');
  }

  const newKyc = {
    id: Date.now(),
    partner_id: Number(partnerId),
    govt_id_type,
    id_number: id_number.trim(),
    status: 'pending', // Pending Admin review per FR-P5
    submitted_at: new Date().toISOString(),
    reviewer_decision: null,
    rejection_reason: null,
    document_name: document_name || 'Government_ID_Scan.pdf',
    photo_name: photo_name || 'passport_photo.jpg',
    trade_cert_name: trade_cert_name || 'Trade_License_Certificate.pdf',
  };

  const list = getStoredKycList().filter((k) => k.partner_id !== Number(partnerId));
  const updatedList = [newKyc, ...list];
  saveStoredKycList(updatedList);

  // Update current partner's kyc_status
  const current = getActivePartner();
  if (current.id === Number(partnerId)) {
    const updatedPartner = {
      ...current,
      kyc_status: 'pending',
      rejection_reason: null,
    };
    setActivePartner(updatedPartner);
  }

  return newKyc;
}

/**
 * Resubmit KYC documents (e.g., after rejection)
 */
export async function resubmitPartnerKyc(partnerId, kycPayload) {
  return submitPartnerKyc(partnerId, kycPayload);
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
 * Order:
 * 1. 'accepted' -> 'on_the_way' (Start trip)
 * 2. 'on_the_way' -> 'arrived' (Arrived)
 * 3. 'arrived' -> 'in_progress' (Confirm Service OTP)
 * 4. 'in_progress' -> 'completed' (Complete service)
 * 5. 'completed' -> 'paid' (Payment received, records earnings & clears active job)
 */
export async function advanceJobStep(jobId, currentStep, enteredOtp = null) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const job = getActiveJob();

  if (!job || job.id !== Number(jobId)) {
    throw new Error('Active job not found or already completed.');
  }

  if (currentStep === 'accepted') {
    const updated = {
      ...job,
      status: 'on_the_way',
      step_index: 2,
      started_trip_at: new Date().toISOString(),
    };
    setActiveJob(updated);
    return updated;
  }

  if (currentStep === 'on_the_way') {
    const updated = {
      ...job,
      status: 'arrived',
      step_index: 3,
      arrived_at: new Date().toISOString(),
    };
    setActiveJob(updated);
    return updated;
  }

  if (currentStep === 'arrived') {
    const cleanOtp = enteredOtp?.trim();
    if (cleanOtp !== job.service_otp && cleanOtp !== '8392') {
      throw new Error(`Invalid service OTP. Please ask customer for the 4-digit code (Hint: ${job.service_otp || '8392'}).`);
    }

    const updated = {
      ...job,
      status: 'in_progress',
      step_index: 4,
      service_started_at: new Date().toISOString(),
      otp_verified: true,
    };
    setActiveJob(updated);
    return updated;
  }

  if (currentStep === 'in_progress') {
    const updated = {
      ...job,
      status: 'completed',
      step_index: 5,
      completed_at: new Date().toISOString(),
    };
    setActiveJob(updated);
    return updated;
  }

  if (currentStep === 'completed') {
    // Stage 5: Payment received - confirm direct on-site settlement (SRS FR-P12, BR-7)
    const settlementAmount = job.amount || 450.0;
    const earnings = getStoredEarnings();
    const newEntry = {
      id: Date.now(),
      order_number: job.order_number || `ORD-${job.id}`,
      customer_name: job.customer_name || 'Customer',
      service_name: job.service_name || 'Service',
      problem: job.problem || 'Completed Repair Work',
      amount: settlementAmount,
      payment_mode: 'Direct Cash / UPI (On-site)',
      date: new Date().toISOString(),
      status: 'settled',
    };

    const updatedEarnings = {
      ...earnings,
      total_earnings: (earnings.total_earnings || 28450) + settlementAmount,
      total_jobs: (earnings.total_jobs || 142) + 1,
      today_earnings: (earnings.today_earnings || 950) + settlementAmount,
      today_jobs: (earnings.today_jobs || 2) + 1,
      ledger: [newEntry, ...(earnings.ledger || [])],
    };
    saveStoredEarnings(updatedEarnings);

    // Clear active job
    setActiveJob(null);

    return {
      status: 'paid',
      closed: true,
      settlement: newEntry,
    };
  }

  return job;
}

/**
 * Accept Incoming Request (SRS FR-P9)
 */
export async function acceptIncomingJob(jobData) {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const newActiveJob = {
    ...jobData,
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

export async function getPartnerEarnings(_partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getStoredEarnings();
}

export async function getPartnerRatings(_partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return mockPartnerRatings;
}

/* ========================================================================== */
/* 7. REQUEST HISTORY (SRS FR-P11, BR-6)                                      */
/* ========================================================================== */

export async function getPartnerHistory(partnerId, filter = 'ALL') {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Base list of completed/cancelled jobs
  const list = [
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

  if (filter === 'COMPLETED') {
    return list.filter((r) => r.status === 'completed');
  }
  if (filter === 'CANCELLED') {
    return list.filter((r) => r.status === 'cancelled');
  }
  return list;
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
