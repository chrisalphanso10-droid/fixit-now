/**
 * FixIt Now - Admin Service (Admin Portal)
 * Manages admin authentication, dashboard metrics, KYC dossier review,
 * plan price adjustments, service category operations, and read-only audit records.
 *
 * Conforms to SRS Section 3.4 (FR-A1 through FR-A7), Section 2.4, BR-1, BR-2, BR-4, BR-5.
 * Strictly enforces FR-A3: No customer or partner modification methods exist here.
 * Connects directly to PostgreSQL Express backend via central API client.
 */

import { get, post, put } from './api';

// LocalStorage Keys for active admin session
const ADMIN_SESSION_KEY = 'fixit_admin_session';

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
    notifyAuthChange();
  } catch (e) {
    console.warn('Storage failed for admin session:', e);
  }

  return session;
}

export function getAdminSession() {
  try {
    const role = localStorage.getItem('fixit_role');
    const raw = localStorage.getItem(ADMIN_SESSION_KEY) || (role === 'admin' ? localStorage.getItem('fixit_user') : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.role === 'admin' || role === 'admin') {
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fixit_auth_change'));
  }
}

export function adminLogout() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('fixit_token');
    localStorage.removeItem('fixit_user');
    localStorage.removeItem('fixit_role');
    notifyAuthChange();
  } catch (e) {
    console.warn('Could not clear admin session:', e);
  }
}

/**
 * -----------------------------------------------------------------------------
 * 2. DASHBOARD & ANALYTICS (FR-A2, FR-A7)
 * Fetches live aggregates from /api/admin/dashboard.
 * -----------------------------------------------------------------------------
 */

function getFallbackDashboardData(stats = {}, recentActivity = []) {
  const totalRequests = stats.total_requests || 0;
  const completedRequests = stats.completed_requests || 0;
  const cancelledRequests = stats.cancelled_requests || 0;

  return {
    analytics: {
      summary: {
        total_requests: totalRequests,
        completed_requests: completedRequests,
        cancelled_requests: cancelledRequests,
        unassigned_timeouts: 0,
        subscription_revenue: stats.total_subscription_revenue || 0,
        active_partners: stats.total_partners || 0,
        total_customers: stats.total_customers || 0,
        pending_kyc: stats.pending_kyc_count || 0,
        completion_rate: totalRequests > 0 ? `${Math.round((completedRequests / totalRequests) * 100)}%` : '0%',
        avg_arrival_minutes: 15.0,
        average_rating: 5.0,
        growth_rate: '+0%',
      },
      requestsOverTime: [],
      topServices: [],
      completionVsCancellation: [],
      growthMetrics: [],
      subscriptionRevenue: [],
      peakHours: [],
      topRatedPartners: [],
    },
    liveUsers: {
      online_partners_count: stats.online_partners_count || 0,
      active_customers_count: stats.total_customers || 0,
      active_jobs_count: stats.active_jobs_count || 0,
      pending_kyc_count: stats.pending_kyc_count || 0,
      active_subscriptions_count: stats.active_subscriptions_count || 0,
      live_online_partners: [],
    },
    activityLog: recentActivity.map((r) => formatActivityLogRow(r)),
  };
}

export async function getAdminDashboardData() {
  try {
    const res = await get('/api/admin/dashboard');
    if (res?.data?.analytics) {
      return {
        stats: res.data.stats || {},
        recentActivity: (res.data.recent_activity || []).map(formatActivityLogRow),
        activityLog: (res.data.recent_activity || []).map(formatActivityLogRow),
        analytics: res.data.analytics,
        liveUsers: res.data.live_users || res.data.liveUsers || {},
      };
    }

    const stats = res?.data?.stats || {};
    const recentActivity = res?.data?.recent_activity || [];
    return getFallbackDashboardData(stats, recentActivity);
  } catch (err) {
    console.warn('[AdminService] getAdminDashboardData error:', err.message);
    return getFallbackDashboardData({}, []);
  }
}

export async function getAdminAnalyticsData() {
  try {
    const res = await get('/api/admin/analytics');
    return res?.data?.analytics || null;
  } catch (err) {
    console.warn('[AdminService] getAdminAnalyticsData error:', err.message);
    return null;
  }
}

/**
 * -----------------------------------------------------------------------------
 * 3. KYC DOSSIER REVIEW (FR-A4, BR-5)
 * Approve or reject partner KYC. Rejection requires mandatory reason.
 * -----------------------------------------------------------------------------
 */

export async function getAdminKycList(filter = 'all') {
  try {
    const res = await get('/api/admin/kyc');
    let list = Array.isArray(res?.data) ? res.data : [];

    if (filter === 'pending') {
      return list.filter((k) => k.status === 'pending');
    }
    if (filter === 'verified') {
      return list.filter((k) => k.status === 'verified');
    }
    if (filter === 'rejected') {
      return list.filter((k) => k.status === 'rejected');
    }
    return list;
  } catch (err) {
    console.error('[AdminService] getAdminKycList error:', err.message);
    throw err;
  }
}

export async function getPartnerKycDossier(partnerId) {
  const list = await getAdminKycList('all');
  const dossier = list.find((k) => String(k.partner_id) === String(partnerId));
  if (!dossier) {
    throw new Error(`No KYC dossier found for Partner #${partnerId}`);
  }
  return dossier;
}

/**
 * Approve partner KYC (instantly unlocks eligibility per BR-5)
 */
export async function approvePartnerKyc(partnerId, approvalNote = '') {
  const res = await put(`/api/admin/kyc/${partnerId}/decision`, {
    decision: 'verified',
    reviewer_notes: approvalNote,
  });

  // Sync active partner in localStorage if currently signed in on this client
  try {
    const raw = localStorage.getItem('fixit_current_partner');
    if (raw) {
      const p = JSON.parse(raw);
      if (String(p.id) === String(partnerId)) {
        const updated = { ...p, kyc_status: 'verified', rejection_reason: null };
        localStorage.setItem('fixit_current_partner', JSON.stringify(updated));
        const userRaw = localStorage.getItem('fixit_user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          if (String(u.id) === String(partnerId)) {
            localStorage.setItem(
              'fixit_user',
              JSON.stringify({ ...u, kyc_status: 'verified', rejection_reason: null })
            );
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return res.data;
}

/**
 * Reject partner KYC (FR-A4: rejection reason is mandatory)
 */
export async function rejectPartnerKyc(partnerId, rejectionReason) {
  const cleanReason = rejectionReason?.trim();
  if (!cleanReason) {
    throw new Error('A detailed rejection reason is mandatory before declining a KYC dossier.');
  }

  const res = await put(`/api/admin/kyc/${partnerId}/decision`, {
    decision: 'rejected',
    rejection_reason: cleanReason,
  });

  // Sync active partner in localStorage if currently signed in on this client
  try {
    const raw = localStorage.getItem('fixit_current_partner');
    if (raw) {
      const p = JSON.parse(raw);
      if (String(p.id) === String(partnerId)) {
        const updated = { ...p, kyc_status: 'rejected', rejection_reason: cleanReason };
        localStorage.setItem('fixit_current_partner', JSON.stringify(updated));
        const userRaw = localStorage.getItem('fixit_user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          if (String(u.id) === String(partnerId)) {
            localStorage.setItem(
              'fixit_user',
              JSON.stringify({ ...u, kyc_status: 'rejected', rejection_reason: cleanReason })
            );
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return res.data;
}

/**
 * -----------------------------------------------------------------------------
 * 4. PLANS AND PRICES MANAGEMENT (FR-A5, BR-2)
 * Admin can change plan prices. Price changes strictly apply to new subscriptions only.
 * -----------------------------------------------------------------------------
 */

export async function getAdminPlans() {
  try {
    const res = await get('/api/admin/plans');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminPlans error:', err.message);
    throw err;
  }
}

export async function updatePlanPrice(planId, newPrice) {
  const parsedPrice = parseFloat(newPrice);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    throw new Error('Please enter a valid price greater than zero.');
  }

  const res = await put(`/api/admin/plans/${planId}`, {
    price: parsedPrice,
  });

  return res.data;
}

/**
 * -----------------------------------------------------------------------------
 * 5. SERVICE CATEGORIES MANAGEMENT (FR-A6)
 * Manage categories, active/disabled status, and base price estimates.
 * -----------------------------------------------------------------------------
 */

export async function getAdminServices() {
  try {
    const res = await get('/api/admin/services');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminServices error:', err.message);
    throw err;
  }
}

export async function toggleServiceStatus(serviceId) {
  const res = await put(`/api/admin/services/${serviceId}/toggle`, {});
  return res.data;
}

export async function updateServiceCategory(serviceId, updates) {
  const res = await put(`/api/admin/services/${serviceId}`, updates);
  return res.data;
}

export async function createServiceCategory(categoryData) {
  const res = await post('/api/admin/services', categoryData);
  return res.data;
}

/**
 * -----------------------------------------------------------------------------
 * 6. READ-ONLY AUDIT & MONITORING DATA (FR-A2, FR-A3)
 * Strictly read-only tables for registered customers, partners, requests,
 * subscriptions, ratings, and activity logs.
 * -----------------------------------------------------------------------------
 */

export async function getAdminCustomers() {
  try {
    const res = await get('/api/admin/customers');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminCustomers error:', err.message);
    throw err;
  }
}

export async function getAdminPartners() {
  try {
    const res = await get('/api/admin/partners');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminPartners error:', err.message);
    throw err;
  }
}

export async function getAdminRequests(statusFilter = 'all') {
  try {
    const query = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    const res = await get(`/api/admin/requests${query}`);
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminRequests error:', err.message);
    throw err;
  }
}

export async function getAdminSubscriptions() {
  try {
    const res = await get('/api/admin/subscriptions');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminSubscriptions error:', err.message);
    throw err;
  }
}

export async function getAdminRatings() {
  try {
    const res = await get('/api/admin/ratings');
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.error('[AdminService] getAdminRatings error:', err.message);
    throw err;
  }
}

export async function getAdminActivityLog() {
  try {
    const res = await get('/api/admin/activity-log');
    const rows = Array.isArray(res?.data) ? res.data : [];
    return rows.map((r) => formatActivityLogRow(r));
  } catch (err) {
    console.error('[AdminService] getAdminActivityLog error:', err.message);
    throw err;
  }
}

/**
 * Helper to normalize PostgreSQL activity_logs rows into UI-friendly schema
 */
function formatActivityLogRow(row) {
  let detailsObj = row.details;
  if (typeof detailsObj === 'string') {
    try {
      detailsObj = JSON.parse(detailsObj);
    } catch {
      detailsObj = { message: detailsObj };
    }
  }
  detailsObj = detailsObj || {};

  const action = row.action || 'EVENT';
  let category = 'System';
  if (action.startsWith('KYC')) category = 'KYC';
  else if (action.startsWith('PLAN')) category = 'Plans';
  else if (action.startsWith('SERVICE')) category = 'Services';
  else if (action.startsWith('REQUEST')) category = 'Requests';
  else if (action.startsWith('SUBSCRIPTION')) category = 'Subscriptions';

  let status = 'info';
  if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('SUCCESS')) {
    status = 'success';
  } else if (action.includes('UPDATED') || action.includes('PRICE') || action.includes('DEACTIVATED')) {
    status = 'warning';
  } else if (action.includes('REJECTED') || action.includes('FAILED') || action.includes('ERROR')) {
    status = 'error';
  }

  let target = detailsObj.target;
  if (!target) {
    if (detailsObj.partner_name) {
      target = `${detailsObj.partner_name} (${String(detailsObj.partner_id || '').substring(0, 8)})`;
    } else if (detailsObj.name) {
      target = `Service: ${detailsObj.name}`;
    } else if (detailsObj.plan_name) {
      target = `Plan: ${detailsObj.plan_name}`;
    } else {
      target = 'Platform Operations';
    }
  }

  let detailsText = detailsObj.details || detailsObj.message || detailsObj.note || detailsObj.rejection_reason;
  if (!detailsText) {
    if (detailsObj.decision) {
      detailsText = `Decision: ${detailsObj.decision.toUpperCase()}${detailsObj.rejection_reason ? ` (Reason: ${detailsObj.rejection_reason})` : ''}`;
    } else if (detailsObj.new_price) {
      detailsText = `Price: ₹${detailsObj.old_price} → ₹${detailsObj.new_price}. ${detailsObj.note || ''}`;
    } else {
      detailsText = JSON.stringify(detailsObj);
    }
  }

  return {
    id: `ACT-${row.id}`,
    actor: row.actor || 'admin@fixitnow.com',
    action,
    category,
    status,
    target,
    details: detailsText,
    time: row.created_at || new Date().toISOString(),
  };
}
