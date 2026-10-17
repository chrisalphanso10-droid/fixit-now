/**
 * FixIt Now - Client Socket.IO Service
 * Conforms to docs/SRS.md FR-C10..FR-C12, FR-P7..FR-P9, FR-T1, FR-T3 and docs/PLAN.md Phase 6.
 *
 * Manages WebSocket connection to backend for:
 * - Partner dispatch calls (incoming request popup with countdown)
 * - Real-time matching updates and "All partners busy" notification
 * - Instant job acceptance & cancellation pushes
 */

import { io } from 'socket.io-client';

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5001';

let socket = null;

/**
 * Initializes and retrieves the singleton socket connection
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      // Re-register session if stored
      try {
        const userRaw = localStorage.getItem('fixit_user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user.role === 'partner' && user.id) {
            registerPartner(user.id);
          } else if (user.role === 'customer' && user.id) {
            registerCustomer(user.id);
          }
        }
      } catch {
        // ignore
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Connection Error]:', err.message);
    });
  }

  return socket;
}

/**
 * Registers partner room
 */
export function registerPartner(partnerId) {
  if (!partnerId) return;
  const s = getSocket();
  s.emit('register_partner', { partnerId: String(partnerId) });
}

/**
 * Registers customer room
 */
export function registerCustomer(customerId) {
  if (!customerId) return;
  const s = getSocket();
  s.emit('register_customer', { customerId: String(customerId) });
}

/**
 * Joins request room
 */
export function joinRequest(requestId) {
  if (!requestId) return;
  const s = getSocket();
  s.emit('join_request', { requestId: String(requestId) });
}

/**
 * Partner responds to an incoming request (Accept or Decline)
 */
export function respondToJob(requestId, partnerId, decision, reason = '') {
  const s = getSocket();
  s.emit('partner_respond', {
    requestId: String(requestId),
    partnerId: String(partnerId),
    decision,
    reason,
  });
}

/**
 * Customer cancels active request
 */
export function cancelJob(requestId, reason = 'Cancelled by customer') {
  const s = getSocket();
  s.emit('customer_cancel', {
    requestId: String(requestId),
    reason,
  });
}

/**
 * Subscribes to incoming request events (Partner side)
 */
export function onIncomingRequest(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('incoming_request', handler);
  return () => s.off('incoming_request', handler);
}

/**
 * Subscribes to request timeout events (Partner side)
 */
export function onRequestTimeout(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('request_timeout', handler);
  return () => s.off('request_timeout', handler);
}

/**
 * Subscribes to request cancellation events (Partner side or Customer side)
 */
export function onRequestCancelled(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('request_cancelled', handler);
  return () => s.off('request_cancelled', handler);
}

/**
 * Subscribes to request acceptance events (Customer side)
 */
export function onRequestAccepted(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('request_accepted', handler);
  return () => s.off('request_accepted', handler);
}

/**
 * Subscribes to searching progress updates
 */
export function onSearchingUpdate(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('searching_update', handler);
  return () => s.off('searching_update', handler);
}

/**
 * Subscribes to "all partners busy" state
 */
export function onAllPartnersBusy(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('all_partners_busy', handler);
  return () => s.off('all_partners_busy', handler);
}

/**
 * Partner emits request for customer to provide OTP
 */
export function requestOtpPrompt(requestId) {
  if (!requestId) return;
  const s = getSocket();
  s.emit('partner_request_otp', { requestId: String(requestId) });
}

/**
 * Customer subscribes to OTP popup event triggered when partner requests verification
 */
export function onOtpPrompt(callback) {
  const s = getSocket();
  const handler = (data) => callback(data);
  s.on('otp_prompt_customer', handler);
  return () => s.off('otp_prompt_customer', handler);
}

/**
 * Generic event listener on socket
 */
export function on(event, callback) {
  const s = getSocket();
  if (s && typeof s.on === 'function') {
    s.on(event, callback);
    return () => s.off(event, callback);
  }
  return () => {};
}

/**
 * Generic event listener removal on socket
 */
export function off(event, callback) {
  const s = getSocket();
  if (s && typeof s.off === 'function') {
    s.off(event, callback);
  }
}

export default {
  getSocket,
  registerPartner,
  registerCustomer,
  joinRequest,
  respondToJob,
  cancelJob,
  requestOtpPrompt,
  onOtpPrompt,
  onIncomingRequest,
  onRequestTimeout,
  onRequestCancelled,
  onRequestAccepted,
  onSearchingUpdate,
  onAllPartnersBusy,
  on,
  off,
};

