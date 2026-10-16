/**
 * FixIt Now - Request Service
 * Manages request lifecycle, active tracking simulation, history, cancellations and ratings.
 * Conforms to SRS FR-C6, FR-C7, FR-C10, FR-C14, FR-C17, FR-C18, FR-C19.
 */

import { mockRequests } from '../mockData';
import { getEligiblePartnerForTrade } from './partnerService';

const REQUESTS_HISTORY_KEY = 'fixit_requests_history';
const ACTIVE_REQUEST_KEY = 'fixit_active_request';

function getStoredRequests() {
  try {
    const raw = localStorage.getItem(REQUESTS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : mockRequests;
  } catch {
    return mockRequests;
  }
}

function saveStoredRequests(list) {
  try {
    localStorage.setItem(REQUESTS_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Get current active request in progress (searching or live tracking)
 */
export function getActiveRequest() {
  try {
    const raw = localStorage.getItem(ACTIVE_REQUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set active request
 */
export function setActiveRequest(request) {
  if (!request) {
    localStorage.removeItem(ACTIVE_REQUEST_KEY);
  } else {
    localStorage.setItem(ACTIVE_REQUEST_KEY, JSON.stringify(request));
  }
}

/**
 * Create a new service request (SRS FR-C6)
 */
export async function createServiceRequest({
  service_id,
  service_name,
  problem,
  description,
  address,
  coordinates,
  photo_url = null,
}) {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!service_id) throw new Error('Please select a trade service.');
  if (!problem?.trim()) throw new Error('Please enter a brief problem title.');
  if (!description?.trim()) throw new Error('Please describe the fault in detail.');
  if (!address?.trim()) throw new Error('Please provide a service street address.');

  const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
  const nextId = 427 + Math.floor(Math.random() * 100);

  const newRequest = {
    id: nextId,
    order_number: `ORD-0${nextId}`,
    customer_id: 1,
    partner_id: null,
    service_id: Number(service_id),
    service_name: service_name || 'Trade Service',
    problem: problem.trim(),
    description: description.trim(),
    address: address.trim(),
    coordinates: coordinates || { lat: 12.9784, lng: 77.6408 },
    photo_url: photo_url,
    status: 'searching', // initial searching state
    cancel_reason: null,
    service_otp: randomOtp,
    created_at: new Date().toISOString(),
    completed_at: null,
    partner: null,
    payment_confirmed: false,
    rating: null,
    step_index: 0, // 0: Searching, 1: Accepted, 2: On way, 3: Arrived, 4: Started, 5: Completed, 6: Payment confirmed
  };

  setActiveRequest(newRequest);
  return newRequest;
}

/**
 * Assign partner to active request when search succeeds
 */
export async function assignMatchedPartner(requestId, serviceId) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const active = getActiveRequest();
  const partner = await getEligiblePartnerForTrade(serviceId);

  const updated = {
    ...active,
    partner_id: partner.id,
    partner: partner,
    status: 'accepted',
    step_index: 1, // Step 1: Request accepted
    eta_minutes: partner.estimated_arrival_minutes || 14,
    distance_km: partner.distance_km || 0.8,
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
    2: 'on_the_way',
    3: 'arrived',
    4: 'in_progress',
    5: 'completed',
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
export async function cancelServiceRequest(requestId, reason) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const active = getActiveRequest();

  const cancelledReq = {
    ...(active || { id: requestId }),
    status: 'cancelled',
    cancel_reason: reason?.trim() || 'Cancelled by customer',
    completed_at: new Date().toISOString(),
  };

  // Add to history
  const list = getStoredRequests();
  const existingIdx = list.findIndex((r) => r.id === cancelledReq.id);
  if (existingIdx !== -1) {
    list[existingIdx] = cancelledReq;
  } else {
    list.unshift(cancelledReq);
  }
  saveStoredRequests(list);

  // Clear active
  setActiveRequest(null);
  return cancelledReq;
}

/**
 * Submit rating for completed partner service (SRS FR-C17)
 */
export async function submitRequestRating(requestId, { stars, comment }) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const active = getActiveRequest();

  const finishedReq = {
    ...(active || {}),
    id: requestId || active?.id,
    status: 'completed',
    payment_confirmed: true,
    rating: {
      stars: Number(stars) || 5,
      comment: comment?.trim() || 'Service completed successfully.',
    },
    completed_at: active?.completed_at || new Date().toISOString(),
  };

  const list = getStoredRequests();
  const existingIdx = list.findIndex((r) => r.id === finishedReq.id);
  if (existingIdx !== -1) {
    list[existingIdx] = finishedReq;
  } else {
    list.unshift(finishedReq);
  }
  saveStoredRequests(list);

  // Clear active request
  setActiveRequest(null);
  return finishedReq;
}

/**
 * Get request history with optional status filter (SRS FR-C7)
 */
export async function getRequestHistory(filter = 'all') {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const list = getStoredRequests();
  if (filter === 'completed') {
    return list.filter((r) => r.status === 'completed' || r.status === 'payment_completed');
  }
  if (filter === 'cancelled') {
    return list.filter((r) => r.status === 'cancelled');
  }
  return list;
}

/**
 * Get request by ID
 */
export async function getRequestById(id) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const list = getStoredRequests();
  const found = list.find((r) => r.id === Number(id));
  if (found) return found;
  const active = getActiveRequest();
  if (active && active.id === Number(id)) return active;
  return null;
}
