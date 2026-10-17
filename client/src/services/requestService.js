/**
 * FixIt Now - Request Service
 * Manages request lifecycle, active tracking, history, cancellations and ratings.
 * Conforms to SRS FR-C6, FR-C7, FR-C10, FR-C14, FR-C17, FR-C19 and docs/PLAN.md Phase 6.
 */

import { get, post, postFormData } from './api';
import { savePartnerRecentJob, addPartnerRating } from './partnerService';

const ACTIVE_REQUEST_KEY = 'fixit_active_request';
const LOCAL_REQUEST_HISTORY_KEY = 'fixit_requests_history';

/**
 * Get current active request from local session cache
 */
export function getActiveRequest() {
  try {
    const raw = localStorage.getItem(ACTIVE_REQUEST_KEY);
    if (!raw) return null;
    const req = JSON.parse(raw);
    if (['completed', 'cancelled', 'paid', 'service_completed'].includes(req?.status)) {
      localStorage.removeItem(ACTIVE_REQUEST_KEY);
      return null;
    }
    return req;
  } catch {
    return null;
  }
}

/**
 * Set active request in local session cache
 */
export function setActiveRequest(request) {
  if (!request) {
    localStorage.removeItem(ACTIVE_REQUEST_KEY);
  } else {
    localStorage.setItem(ACTIVE_REQUEST_KEY, JSON.stringify(request));
  }
}

/**
 * Create a new service request via REST API (SRS FR-C6, FR-C9, FR-C10)
 */
export async function createServiceRequest({
  service_id,
  service_name,
  problem,
  description,
  address,
  coordinates,
  photo_url = null,
  photo_file = null,
}) {
  if (!service_id) throw new Error('Please select a trade service.');
  if (!problem?.trim()) throw new Error('Please enter a brief problem title.');
  if (!description?.trim()) throw new Error('Please describe the fault in detail.');
  if (!address?.trim()) throw new Error('Please provide a service street address.');

  const lat = coordinates?.latitude ?? coordinates?.lat ?? 12.9784;
  const lon = coordinates?.longitude ?? coordinates?.lng ?? 77.6408;

  let result;
  if (photo_file instanceof File) {
    const formData = new FormData();
    formData.append('service_id', service_id);
    formData.append('problem', problem.trim());
    formData.append('description', description.trim());
    formData.append('address', address.trim());
    formData.append('latitude', lat);
    formData.append('longitude', lon);
    formData.append('photo', photo_file);
    result = await postFormData('/api/requests', formData);
  } else {
    result = await post('/api/requests', {
      service_id,
      problem: problem.trim(),
      description: description.trim(),
      address: address.trim(),
      latitude: lat,
      longitude: lon,
      photo_url,
    });
  }

  if (result && result.status === 'success' && result.data?.request) {
    const createdReq = {
      ...result.data.request,
      service_name: service_name || result.data.request.service_name || 'Trade Service',
      order_number: result.data.order_number,
      step_index: 0, // 0: Searching
      dispatch_status: result.data.dispatch_status,
      eligible_partners_count: result.data.eligible_partners_count,
    };

    setActiveRequest(createdReq);
    return createdReq;
  }

  throw new Error(result?.message || 'Failed to create service request.');
}

/**
 * Assign partner to active request when search succeeds (SRS FR-C13)
 */
export async function assignMatchedPartner(requestId, partnerData, extra = {}) {
  const active = getActiveRequest();

  const updated = {
    ...(active || {}),
    id: requestId || active?.id,
    partner_id: partnerData?.id,
    partner: partnerData,
    status: 'accepted',
    step_index: 1, // Step 1: Request accepted
    eta_minutes: partnerData?.eta_minutes || 14,
    distance_km: partnerData?.distance_km || 0.8,
    service_otp: extra?.service_otp || active?.service_otp,
    order_number: extra?.order_number || active?.order_number,
    service_name: extra?.service_name || active?.service_name,
    address: extra?.address || active?.address,
    problem: extra?.problem || active?.problem,
  };

  setActiveRequest(updated);
  return updated;
}

/**
 * Advance or set tracking step on active request (SRS FR-C14)
 * Steps:
 * 1: Request accepted
 * 2: Partner on the way
 * 3: Partner arrived
 * 4: Service started
 * 5: Service completed
 * 6: Payment completed
 */
export function updateTrackingStep(stepIndex) {
  const active = getActiveRequest();
  if (!active) return null;

  const statusMap = {
    1: 'accepted',
    2: 'partner_on_way',
    3: 'partner_arrived',
    4: 'service_started',
    5: 'service_completed',
    6: 'payment_completed',
  };

  const newStatus = statusMap[stepIndex] || active.status;
  const updated = {
    ...active,
    step_index: stepIndex,
    status: newStatus,
    payment_confirmed: stepIndex >= 6,
    completed_at: stepIndex >= 5 ? active.completed_at || new Date().toISOString() : null,
  };

  setActiveRequest(updated);
  return updated;
}

/**
 * Cancel request (SRS FR-C19)
 */
export async function cancelServiceRequest(requestId, reason = 'Cancelled by customer') {
  const active = getActiveRequest();
  const orderNum =
    active?.order_number ||
    `ORD-${String(requestId).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  // Mirror cancellation record into partner history
  savePartnerRecentJob({
    id: requestId || active?.id || Date.now(),
    order_number: orderNum,
    customer_name: active?.customer_name || active?.name || 'Customer',
    customer_phone: active?.customer_phone || active?.phone || '+91 98765 43210',
    service_name: active?.service_name || 'Service Call',
    problem: active?.problem || active?.description || 'Service Work',
    address: active?.address || 'Customer site location',
    status: 'cancelled',
    amount: 0,
    cancel_reason: reason,
    completed_at: new Date().toISOString(),
    partner_id: active?.partner?.id || active?.partner_id,
    rating: null,
  });

  try {
    const res = await post(`/api/requests/${requestId}/cancel`, {
      reason: reason.trim(),
    });
    setActiveRequest(null);
    return res.data;
  } catch (err) {
    console.warn('[RequestService] cancelServiceRequest backend call failed:', err.message);
    setActiveRequest(null);
    return { id: requestId, status: 'cancelled', cancel_reason: reason };
  }
}

/**
 * Submit rating for completed partner service (SRS FR-C17)
 */
export async function submitRequestRating(requestId, { stars, comment, requestData } = {}) {
  const active = requestData || getActiveRequest();
  const numStars = Math.max(1, Math.min(5, Number(stars) || 5));
  const cleanComment = (comment || 'Service completed successfully.').trim();

  const ratingObj = {
    stars: numStars,
    comment: cleanComment,
  };

  const orderNum =
    active?.order_number ||
    `ORD-${String(requestId).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  // Try real backend API rating endpoint
  try {
    await post(`/api/requests/${requestId}/rate`, {
      stars: numStars,
      comment: cleanComment,
    });
  } catch (err) {
    console.warn('[RequestService] submitRequestRating backend call failed:', err.message);
  }

  // 1. Mirror completed work order into partner history with customer rating
  savePartnerRecentJob({
    id: requestId || active?.id || Date.now(),
    order_number: orderNum,
    customer_name: active?.customer_name || active?.name || 'Customer',
    customer_phone: active?.customer_phone || active?.phone || '+91 98765 43210',
    service_name: active?.service_name || 'Service Call',
    problem: active?.problem || active?.description || 'Service Work',
    address: active?.address || 'Site Location, Bengaluru',
    status: 'completed',
    amount: Number(active?.amount || active?.base_price_estimate || 450.0),
    payment_mode: 'Direct Cash / UPI (On-site)',
    completed_at: active?.completed_at || new Date().toISOString(),
    rating: ratingObj,
    partner_id: active?.partner?.id || active?.partner_id,
  });

  // 2. Add customer rating to partner recent ratings scorecard & feedback list
  addPartnerRating({
    id: Date.now(),
    order_id: orderNum,
    order_number: orderNum,
    customer_name: active?.customer_name || active?.name || 'Customer',
    stars: numStars,
    comment: cleanComment,
    date: new Date().toISOString(),
    service_name: active?.service_name || 'Home Service',
    partner_id: active?.partner?.id || active?.partner_id,
  });

  const finishedReq = {
    ...(active || {}),
    id: requestId || active?.id,
    status: 'service_completed',
    payment_confirmed: true,
    rating: ratingObj,
    completed_at: active?.completed_at || new Date().toISOString(),
  };

  setActiveRequest(null);
  return finishedReq;
}

/**
 * Get request history with optional status filter (SRS FR-C7)
 */
export async function getRequestHistory(filter = 'all') {
  try {
    const res = await get(`/api/requests?filter=${encodeURIComponent(filter)}`);
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (err) {
    console.warn('[RequestService] getRequestHistory backend call failed:', err.message);
  }

  return [];
}

/**
 * Get request by ID (SRS FR-C13)
 */
export async function getRequestById(id) {
  try {
    const res = await get(`/api/requests/${id}`);
    if (res && res.status === 'success' && res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[RequestService] getRequestById backend call failed:', err.message);
  }

  const active = getActiveRequest();
  if (active && String(active.id) === String(id)) return active;
  return null;
}

export default {
  getActiveRequest,
  setActiveRequest,
  createServiceRequest,
  assignMatchedPartner,
  updateTrackingStep,
  cancelServiceRequest,
  submitRequestRating,
  getRequestHistory,
  getRequestById,
};
