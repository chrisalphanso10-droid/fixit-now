/**
 * FixIt Now - Admin Service (Admin Portal)
 * Manages admin authentication, dashboard metrics, KYC dossier review,
 * plan price adjustments, service category operations, and read-only audit records.
 *
 * Conforms to SRS Section 3.4 (FR-A1 through FR-A7), BR-1, BR-2, BR-4, BR-5.
 * Strictly enforces FR-A3: No customer or partner modification methods exist here.
 */

import { post } from './api';
import {
  mockAdminAnalytics,
  mockLiveUsers,
  mockActivityLog,
  mockCustomers,
  mockPartners,
  mockRequests,
  mockSubscriptions,
  mockKycDocuments,
  mockServices,
  mockPlans,
  mockPartnerRatings,
} from '../mockData';

// LocalStorage Keys for persistence of admin decisions
const ADMIN_SESSION_KEY = 'fixit_admin_session';
const ADMIN_PLANS_KEY = 'fixit_admin_plans';
const ADMIN_SERVICES_KEY = 'fixit_admin_services';
const ADMIN_KYC_KEY = 'fixit_admin_kyc_docs';
const ADMIN_PARTNERS_KEY = 'fixit_admin_partners';
const ADMIN_ACTIVITY_KEY = 'fixit_admin_activity_log';

/**
 * Helper to simulate brief network delay
 */
const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * -----------------------------------------------------------------------------
 * 1. ADMIN AUTHENTICATION (FR-A1)
 * Login only, no registration. One pre-created account on /api/admin/login route.
 * -----------------------------------------------------------------------------
 */

export async function adminLogin(email, password) {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPassword = password?.trim();

  if (!cleanEmail || !cleanPassword) {
    throw new Error('Please enter both admin email and password.');
  }

  const res = await post('/api/admin/login', {
    email: cleanEmail,
    password: cleanPassword,
  });

  const session = {
    id: res.user.id,
    name: res.user.name,
    email: res.user.email,
    role: 'admin',
    badge: 'Root Dispatch Controller',
    token: res.token,
    login_time: new Date().toISOString(),
  };

  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('fixit_token', res.token);
    localStorage.setItem('fixit_user', JSON.stringify(session));
    localStorage.setItem('fixit_role', 'admin');
  } catch (e) {
    console.warn('Storage failed for admin session:', e);
  }

  return session;
}

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    const role = localStorage.getItem('fixit_role');
    if (raw && role === 'admin') {
      return JSON.parse(raw);
    }
    return null;
  } catch {
    return null;
  }
}

export function adminLogout() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('fixit_token');
    localStorage.removeItem('fixit_user');
    localStorage.removeItem('fixit_role');
  } catch (e) {
    console.warn('Could not clear admin session:', e);
  }
}

/**
 * -----------------------------------------------------------------------------
 * 2. DASHBOARD & ANALYTICS (FR-A7, FR-A2)
 * -----------------------------------------------------------------------------
 */

export async function getAdminDashboardData() {
  await delay(150);
  const partners = await getAdminPartners();
  const requests = await getAdminRequests();
  const kycList = await getAdminKycList('pending');

  const pendingKycCount = kycList.length;
  const onlinePartnersCount = partners.filter((p) => p.online).length;
  const activeJobsCount = requests.filter((r) => r.status === 'in_progress' || r.status === 'accepted').length;

  return {
    analytics: mockAdminAnalytics,
    liveUsers: {
      ...mockLiveUsers,
      online_partners_count: onlinePartnersCount || mockLiveUsers.online_partners_count,
      active_jobs_count: activeJobsCount || mockLiveUsers.active_jobs_count,
      pending_kyc_count: pendingKycCount,
    },
    activityLog: await getAdminActivityLog(),
  };
}

export async function getAdminAnalytics() {
  await delay(150);
  return mockAdminAnalytics;
}

export async function getLiveUsersMonitor() {
  await delay(100);
  return mockLiveUsers;
}

/**
 * -----------------------------------------------------------------------------
 * 3. KYC DOSSIER REVIEW (FR-A4, BR-5)
 * Approve or reject partner KYC. Rejection requires mandatory reason.
 * -----------------------------------------------------------------------------
 */

function getStoredKycDocs() {
  try {
    const raw = localStorage.getItem(ADMIN_KYC_KEY);
    return raw ? JSON.parse(raw) : mockKycDocuments;
  } catch {
    return mockKycDocuments;
  }
}

function saveStoredKycDocs(list) {
  try {
    localStorage.setItem(ADMIN_KYC_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed saving KYC docs:', e);
  }
}

function getStoredPartners() {
  try {
    const raw = localStorage.getItem(ADMIN_PARTNERS_KEY);
    return raw ? JSON.parse(raw) : mockPartners;
  } catch {
    return mockPartners;
  }
}

function saveStoredPartners(list) {
  try {
    localStorage.setItem(ADMIN_PARTNERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed saving partners:', e);
  }
}

export async function getAdminKycList(filter = 'all') {
  await delay(150);
  const docs = getStoredKycDocs();
  const partners = getStoredPartners();

  // Combine KYC document data with partner profile
  const combined = docs.map((doc) => {
    const partner = partners.find((p) => p.id === doc.partner_id) || {};
    return {
      ...doc,
      partner_name: partner.name || 'Unknown Partner',
      partner_email: partner.email || 'N/A',
      partner_phone: partner.phone || 'N/A',
      service_name: partner.service_name || 'General Repairs',
      partner_address: partner.address || 'N/A',
      partner_vehicle: partner.vehicle || 'N/A',
      partner_rating: partner.rating || 5.0,
      partner_avatar_color: partner.avatar_color || '#111418',
    };
  });

  if (filter === 'pending') {
    return combined.filter((k) => k.status === 'pending');
  }
  if (filter === 'verified') {
    return combined.filter((k) => k.status === 'verified');
  }
  if (filter === 'rejected') {
    return combined.filter((k) => k.status === 'rejected');
  }
  return combined;
}

export async function getPartnerKycDossier(partnerId) {
  await delay(100);
  const list = await getAdminKycList('all');
  const dossier = list.find((k) => k.partner_id === Number(partnerId));
  if (!dossier) {
    throw new Error(`No KYC dossier found for Partner #${partnerId}`);
  }
  return dossier;
}

/**
 * Approve partner KYC (instantly unlocks eligibility per BR-5)
 */
export async function approvePartnerKyc(partnerId, approvalNote = '') {
  await delay(250);
  const numId = Number(partnerId);
  const docs = getStoredKycDocs();
  const partners = getStoredPartners();

  const docIndex = docs.findIndex((d) => d.partner_id === numId);
  if (docIndex === -1) {
    throw new Error(`KYC record not found for Partner #${partnerId}`);
  }

  const nowIso = new Date().toISOString();
  docs[docIndex] = {
    ...docs[docIndex],
    status: 'verified',
    verified_at: nowIso,
    reviewer_decision: approvalNote?.trim()
      ? `Approved: ${approvalNote.trim()}`
      : 'Approved: Government ID and trade qualification verified by Admin.',
  };
  saveStoredKycDocs(docs);

  // Update partner kyc_status
  const partnerIndex = partners.findIndex((p) => p.id === numId);
  if (partnerIndex !== -1) {
    partners[partnerIndex] = {
      ...partners[partnerIndex],
      kyc_status: 'verified',
      rejection_reason: null,
    };
    saveStoredPartners(partners);
  }

  // Audit activity log
  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: 'KYC_APPROVED',
    target: `Partner #${numId} (${partners[partnerIndex]?.name || 'Partner'})`,
    details: docs[docIndex].reviewer_decision,
    category: 'KYC',
    status: 'success',
  });

  return docs[docIndex];
}

/**
 * Reject partner KYC (FR-A4: rejection reason is mandatory)
 */
export async function rejectPartnerKyc(partnerId, rejectionReason) {
  await delay(250);
  const numId = Number(partnerId);
  const cleanReason = rejectionReason?.trim();

  if (!cleanReason) {
    throw new Error('A detailed rejection reason is mandatory before declining a KYC dossier.');
  }

  const docs = getStoredKycDocs();
  const partners = getStoredPartners();

  const docIndex = docs.findIndex((d) => d.partner_id === numId);
  if (docIndex === -1) {
    throw new Error(`KYC record not found for Partner #${partnerId}`);
  }

  const nowIso = new Date().toISOString();
  docs[docIndex] = {
    ...docs[docIndex],
    status: 'rejected',
    rejection_reason: cleanReason,
    reviewer_decision: `Rejected: ${cleanReason}`,
    rejected_at: nowIso,
  };
  saveStoredKycDocs(docs);

  // Update partner kyc_status
  const partnerIndex = partners.findIndex((p) => p.id === numId);
  if (partnerIndex !== -1) {
    partners[partnerIndex] = {
      ...partners[partnerIndex],
      kyc_status: 'rejected',
      rejection_reason: cleanReason,
    };
    saveStoredPartners(partners);
  }

  // Audit activity log
  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: 'KYC_REJECTED',
    target: `Partner #${numId} (${partners[partnerIndex]?.name || 'Partner'})`,
    details: `Reason: ${cleanReason}`,
    category: 'KYC',
    status: 'error',
  });

  return docs[docIndex];
}

/**
 * -----------------------------------------------------------------------------
 * 4. PLANS AND PRICES MANAGEMENT (FR-A5, BR-2)
 * Admin can change plan prices. Price changes strictly apply to new subscriptions only.
 * -----------------------------------------------------------------------------
 */

function getStoredPlans() {
  try {
    const raw = localStorage.getItem(ADMIN_PLANS_KEY);
    return raw ? JSON.parse(raw) : mockPlans;
  } catch {
    return mockPlans;
  }
}

function saveStoredPlans(list) {
  try {
    localStorage.setItem(ADMIN_PLANS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed saving plans:', e);
  }
}

export async function getAdminPlans() {
  await delay(100);
  return getStoredPlans();
}

export async function updatePlanPrice(planId, newPrice) {
  await delay(250);
  const numId = Number(planId);
  const parsedPrice = parseFloat(newPrice);

  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    throw new Error('Please enter a valid price greater than zero.');
  }

  const plans = getStoredPlans();
  const index = plans.findIndex((p) => p.id === numId);
  if (index === -1) {
    throw new Error(`Plan #${planId} not found.`);
  }

  const oldPrice = plans[index].price;
  plans[index] = {
    ...plans[index],
    price: parsedPrice,
    updated_at: new Date().toISOString(),
  };
  saveStoredPlans(plans);

  // Audit activity log per BR-2
  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: 'PLAN_PRICE_UPDATED',
    target: `Plan: ${plans[index].name}`,
    details: `Price changed from ₹${oldPrice} to ₹${parsedPrice}. Rule BR-2 enforced: applies strictly to new subscriptions.`,
    category: 'Plans',
    status: 'warning',
  });

  return plans[index];
}

/**
 * -----------------------------------------------------------------------------
 * 5. SERVICE CATEGORIES MANAGEMENT (FR-A6)
 * Manage categories, active/disabled status, and base price estimates.
 * -----------------------------------------------------------------------------
 */

function getStoredServices() {
  try {
    const raw = localStorage.getItem(ADMIN_SERVICES_KEY);
    return raw ? JSON.parse(raw) : mockServices;
  } catch {
    return mockServices;
  }
}

function saveStoredServices(list) {
  try {
    localStorage.setItem(ADMIN_SERVICES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed saving services:', e);
  }
}

export async function getAdminServices() {
  await delay(100);
  return getStoredServices();
}

export async function toggleServiceStatus(serviceId) {
  await delay(200);
  const numId = Number(serviceId);
  const list = getStoredServices();
  const index = list.findIndex((s) => s.id === numId);

  if (index === -1) {
    throw new Error(`Service #${serviceId} not found.`);
  }

  const newStatus = !list[index].active;
  list[index] = {
    ...list[index],
    active: newStatus,
  };
  saveStoredServices(list);

  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: newStatus ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED',
    target: list[index].name,
    details: `Category status updated to ${newStatus ? 'ACTIVE' : 'DISABLED'}.`,
    category: 'Services',
    status: newStatus ? 'info' : 'warning',
  });

  return list[index];
}

export async function updateServiceCategory(serviceId, updates) {
  await delay(250);
  const numId = Number(serviceId);
  const list = getStoredServices();
  const index = list.findIndex((s) => s.id === numId);

  if (index === -1) {
    throw new Error(`Service #${serviceId} not found.`);
  }

  const current = list[index];
  const name = updates.name?.trim() || current.name;
  const description = updates.description?.trim() || current.description;
  const basePrice = updates.base_price_estimate !== undefined
    ? parseFloat(updates.base_price_estimate)
    : current.base_price_estimate;

  if (isNaN(basePrice) || basePrice < 0) {
    throw new Error('Base price estimate must be a non-negative number.');
  }

  list[index] = {
    ...current,
    name,
    description,
    base_price_estimate: basePrice,
    active: updates.active !== undefined ? Boolean(updates.active) : current.active,
  };
  saveStoredServices(list);

  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: 'SERVICE_UPDATED',
    target: name,
    details: `Updated category details. Base estimate: ₹${basePrice}.`,
    category: 'Services',
    status: 'info',
  });

  return list[index];
}

export async function createServiceCategory(categoryData) {
  await delay(250);
  const name = categoryData.name?.trim();
  const description = categoryData.description?.trim();
  const basePrice = parseFloat(categoryData.base_price_estimate || 350);

  if (!name || !description) {
    throw new Error('Please enter both category name and description.');
  }

  const list = getStoredServices();
  const newId = Math.max(...list.map((s) => s.id), 0) + 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const newCategory = {
    id: newId,
    name,
    slug,
    description,
    base_price_estimate: isNaN(basePrice) ? 350 : basePrice,
    active: true,
  };

  list.push(newCategory);
  saveStoredServices(list);

  await recordActivity({
    actor: 'admin@fixitnow.local',
    action: 'SERVICE_CREATED',
    target: name,
    details: `Added new service category #${newId} with base estimate ₹${basePrice}.`,
    category: 'Services',
    status: 'success',
  });

  return newCategory;
}

/**
 * -----------------------------------------------------------------------------
 * 6. READ-ONLY AUDIT & MONITORING DATA (FR-A2, FR-A3)
 * Strictly read-only tables for registered customers, partners, requests,
 * subscriptions, ratings, and activity logs.
 * -----------------------------------------------------------------------------
 */

export async function getAdminCustomers() {
  await delay(150);
  return mockCustomers;
}

export async function getAdminPartners() {
  await delay(150);
  return getStoredPartners();
}

export async function getAdminRequests(statusFilter = 'all') {
  await delay(150);
  if (statusFilter === 'all') {
    return mockRequests;
  }
  return mockRequests.filter((r) => r.status === statusFilter);
}

export async function getAdminSubscriptions() {
  await delay(150);
  const partners = getStoredPartners();
  // Join partner names into subscription rows
  return mockSubscriptions.map((sub) => {
    const partner = partners.find((p) => p.id === sub.partner_id) || {};
    return {
      ...sub,
      partner_name: partner.name || `Partner #${sub.partner_id}`,
      partner_email: partner.email || 'N/A',
      service_name: partner.service_name || 'General Repairs',
    };
  });
}

export async function getAdminRatings() {
  await delay(150);
  return mockPartnerRatings.reviews;
}

export async function getAdminActivityLog() {
  await delay(100);
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    // Combine stored dynamic activities with initial seed mockActivityLog
    const combined = [...stored, ...mockActivityLog];
    return combined.sort((a, b) => new Date(b.time) - new Date(a.time));
  } catch {
    return mockActivityLog;
  }
}

async function recordActivity(entry) {
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const newEntry = {
      id: `ACT-${Math.floor(1000 + Math.random() * 9000)}`,
      time: new Date().toISOString(),
      ...entry,
    };
    stored.unshift(newEntry);
    localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(stored.slice(0, 50)));
  } catch (e) {
    console.warn('Could not record activity:', e);
  }
}
