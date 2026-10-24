/**
 * FixIt Now - Socket.IO Real-Time Dispatch & Matching Service
 * Conforms to docs/SRS.md FR-C10 to FR-C12, FR-P7, FR-P9, FR-M4, FR-M5, FR-T1, FR-T3 and docs/PLAN.md Phase 6.
 *
 * Implements sequential partner offer loop:
 * - Nearest eligible partner offered request first with countdown (configurable, default 30s).
 * - On decline or timeout, cascades automatically to the next nearest eligible partner.
 * - If none remain, times out and customer receives "All partners busy, try again later".
 * - Customer can cancel anytime, clearing countdown and notifying the currently offered partner.
 */

import { Server } from 'socket.io';
import db from '../config/db.js';

let io = null;

// In-memory active dispatches map: requestId -> dispatchState
const activeDispatches = new Map();

/**
 * Returns the active Socket.IO server instance
 */
export function getIo() {
  return io;
}

/**
 * Initializes the Socket.IO server and binds real-time rooms & event handlers
 * @param {import('http').Server} httpServer
 */
export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    // 1. Partner registration
    socket.on('register_partner', (payload) => {
      const partnerId = typeof payload === 'object' && payload !== null ? payload.partnerId : payload;
      if (!partnerId) return;
      const room = `partner:${partnerId}`;
      socket.join(room);
      socket.partnerId = String(partnerId);
      socket.emit('registered', { role: 'partner', partnerId });

      // On connect or reconnect: load open requests for this partner if eligible
      for (const [reqId, state] of activeDispatches.entries()) {
        if (
          state.status === 'searching' &&
          !state.declinedPartnerIds.has(String(partnerId))
        ) {
          const partner = state.eligiblePartners.find((p) => String(p.id) === String(partnerId));
          if (partner) {
            const remainingSeconds = Math.max(1, Math.round((state.expiresAt - Date.now()) / 1000));
            const etaMinutes =
              partner.eta_minutes ||
              Math.max(5, Math.round(Number(partner.distance_km || 1) * 6 + 5));

            socket.emit('incoming_request', {
              job: {
                id: state.request.id,
                request_id: state.request.id,
                order_number: state.request.order_number,
                customer_id: state.request.customer_id,
                customer_name: state.request.customer_name || 'Customer',
                customer_phone: state.request.customer_phone || '',
                service_id: state.request.service_id,
                service_name: state.request.service_name || partner.service_name || 'Service',
                problem: state.request.problem,
                description: state.request.description,
                address: state.request.address,
                distance_km: partner.distance_km,
                eta_minutes: etaMinutes,
                photo_url: state.request.photo_url || null,
                created_at: state.request.created_at || new Date().toISOString(),
                service_otp: state.request.service_otp,
              },
              countdown: remainingSeconds,
            });
          }
        }
      }
    });

    // 2. Customer registration
    socket.on('register_customer', (payload) => {
      const customerId = typeof payload === 'object' && payload !== null ? payload.customerId : payload;
      if (!customerId) return;
      const room = `customer:${customerId}`;
      socket.join(room);
      socket.customerId = String(customerId);
      socket.emit('registered', { role: 'customer', customerId });
    });

    // 3. Join request-specific channel
    socket.on('join_request', (payload) => {
      const requestId = typeof payload === 'object' && payload !== null ? payload.requestId : payload;
      if (!requestId) return;
      socket.join(`request:${requestId}`);
      socket.emit('joined_request', { requestId });
    });

    // 4. Partner responds to request offer via WebSocket
    socket.on('partner_respond', async ({ requestId, partnerId, decision, reason }) => {
      try {
        if (decision === 'accept') {
          await handlePartnerAccept(requestId, partnerId);
        } else {
          await handlePartnerDecline(requestId, partnerId, reason || 'PARTNER_DECLINED');
        }
      } catch (err) {
        socket.emit('response_error', { requestId, message: err.message });
      }
    });

    // 5. Customer cancels request via WebSocket
    socket.on('customer_cancel', async ({ requestId, reason }) => {
      try {
        await handleCustomerCancel(requestId, reason || 'Cancelled by customer during search');
      } catch (err) {
        socket.emit('cancel_error', { requestId, message: err.message });
      }
    });

    // 6. Partner requests customer to provide OTP for service start
    socket.on('partner_request_otp', ({ requestId }) => {
      if (!requestId) return;
      io.to(`request:${requestId}`).emit('otp_prompt_customer', { requestId });
    });

    // 7. Admin registration (join admin room for real-time KYC & dispatch alerts)
    socket.on('register_admin', () => {
      socket.join('admin');
      socket.emit('registered', { role: 'admin' });
    });
    socket.on('join_admin', () => {
      socket.join('admin');
      socket.emit('joined_admin');
    });

    socket.on('disconnect', () => {
      // Socket disconnected cleanly
    });
  });

  return io;
}

/**
 * Dismiss active request offers from a partner and notify their client
 * when KYC transitions to pending or rejected.
 *
 * @param {string|number} partnerId
 */
export function dismissPartnerOffers(partnerId) {
  const pId = String(partnerId);
  for (const [reqId, state] of activeDispatches.entries()) {
    if (state.eligiblePartners) {
      state.eligiblePartners = state.eligiblePartners.filter((p) => String(p.id) !== pId);
    }
    if (state.declinedPartnerIds) {
      state.declinedPartnerIds.add(pId);
    }
  }
  if (io) {
    io.to(`partner:${pId}`).emit('request_dismiss', { reason: 'KYC_PENDING' });
    io.to(`partner:${pId}`).emit('kyc:status_updated', { kyc_status: 'pending' });
  }
}

/**
 * Initiates the real-time matching and sequential offer loop for a customer request.
 *
 * @param {object} request The newly created request record from DB
 * @param {Array<object>} eligiblePartners Array of eligible partners sorted nearest first
 * @param {number} [customCountdown] Optional countdown override (seconds)
 */
/**
 * Initiates the real-time matching and broadcast offer loop for a customer request.
 * Conforms to Item 1: sends at the same moment to every eligible partner.
 *
 * @param {object} request The newly created request record from DB
 * @param {Array<object>} eligiblePartners Array of eligible partners within 2 km
 * @param {number} [customCountdown] Optional countdown override (seconds)
 */
export async function startRequestMatching(request, eligiblePartners = [], customCountdown = null) {
  const countdownSeconds =
    customCountdown ||
    Number(process.env.MATCHING_COUNTDOWN_SECONDS) ||
    30;

  const orderNumber =
    request.order_number ||
    `ORD-${String(request.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  const requestPayload = {
    ...request,
    order_number: orderNumber,
  };

  // Case 1: No eligible partners found within 2 km (Busy State)
  if (!eligiblePartners || eligiblePartners.length === 0) {
    try {
      await db.query(
        `UPDATE requests
         SET status = 'cancelled', cancel_reason = 'All partners busy or outside 2 km', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id]
      );
      await db.query(
        `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
        [request.id]
      );
    } catch (dbErr) {
      console.error('[SocketService DB Error on Busy]:', dbErr.message);
    }

    if (io) {
      const busyEvent = {
        requestId: request.id,
        order_number: orderNumber,
        status: 'busy',
        message: 'All partners busy, try again later',
        reason: 'ALL_PARTNERS_BUSY',
      };

      io.to(`customer:${request.customer_id}`).emit('all_partners_busy', busyEvent);
      io.to(`request:${request.id}`).emit('all_partners_busy', busyEvent);
    }

    return {
      success: false,
      status: 'busy',
      message: 'All partners busy, try again later',
    };
  }

  // Case 2: One or more eligible partners available. Broadcast to ALL simultaneously.
  const state = {
    requestId: request.id,
    request: requestPayload,
    eligiblePartners,
    declinedPartnerIds: new Set(),
    countdownSeconds,
    expiresAt: Date.now() + countdownSeconds * 1000,
    timer: null,
    status: 'searching',
  };

  activeDispatches.set(String(request.id), state);

  broadcastToEligiblePartners(String(request.id));

  return {
    success: true,
    status: 'searching',
    partner_count: eligiblePartners.length,
    order_number: orderNumber,
  };
}

/**
 * Broadcasts the incoming request to all eligible partners simultaneously.
 * Single countdown timer for the whole request.
 *
 * @param {string} requestId
 */
function broadcastToEligiblePartners(requestId) {
  const state = activeDispatches.get(String(requestId));
  if (!state || state.status !== 'searching') {
    return;
  }

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  for (const partner of state.eligiblePartners) {
    const etaMinutes =
      partner.eta_minutes ||
      Math.max(5, Math.round(Number(partner.distance_km || 1) * 6 + 5));

    const incomingJobPayload = {
      id: state.request.id,
      request_id: state.request.id,
      order_number: state.request.order_number,
      customer_id: state.request.customer_id,
      customer_name: state.request.customer_name || 'Customer',
      customer_phone: state.request.customer_phone || '',
      service_id: state.request.service_id,
      service_name: state.request.service_name || partner.service_name || 'Service',
      problem: state.request.problem,
      description: state.request.description,
      address: state.request.address,
      distance_km: partner.distance_km,
      eta_minutes: etaMinutes,
      photo_url: state.request.photo_url || null,
      created_at: state.request.created_at || new Date().toISOString(),
      service_otp: state.request.service_otp,
    };

    if (io) {
      io.to(`partner:${partner.id}`).emit('incoming_request', {
        job: incomingJobPayload,
        countdown: state.countdownSeconds,
      });
    }
  }

  if (io) {
    const searchUpdate = {
      requestId: state.request.id,
      order_number: state.request.order_number,
      status: 'searching',
      totalEligible: state.eligiblePartners.length,
      countdown: state.countdownSeconds,
    };

    io.to(`customer:${state.request.customer_id}`).emit('searching_update', searchUpdate);
    io.to(`request:${state.request.id}`).emit('searching_update', searchUpdate);
  }

  // Single countdown timer for the whole request
  state.timer = setTimeout(async () => {
    await handleMatchingTimeout(requestId);
  }, state.countdownSeconds * 1000);
}

/**
 * Helper to build the standardized accepted payload
 */
function formatAcceptedPayload(requestRecord, partnerRecord, originalRequest = {}) {
  const distanceKm = partnerRecord.distance_km != null ? Number(partnerRecord.distance_km) : 0.8;
  const etaMinutes =
    partnerRecord.eta_minutes ||
    Math.max(5, Math.round(Number(distanceKm) * 6 + 5));

  const partnerProfile = {
    id: partnerRecord.id,
    name: partnerRecord.name,
    phone: partnerRecord.phone,
    service_id: partnerRecord.service_id,
    service_name: partnerRecord.service_name || originalRequest.service_name,
    rating: partnerRecord.rating,
    total_jobs: partnerRecord.total_jobs,
    badge: partnerRecord.badge || 'Certified Tradesperson',
    vehicle: partnerRecord.vehicle || 'Standard Service Vehicle',
    distance_km: distanceKm,
    eta_minutes: etaMinutes,
    photo_url: partnerRecord.photo_url || null,
  };

  const orderNumber =
    requestRecord.order_number ||
    originalRequest.order_number ||
    `ORD-${String(requestRecord.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

  return {
    requestId: requestRecord.id,
    order_number: orderNumber,
    status: 'accepted',
    step_index: 1,
    partner: partnerProfile,
    service_otp: requestRecord.service_otp || originalRequest.service_otp,
    address: requestRecord.address || originalRequest.address,
    problem: requestRecord.problem || originalRequest.problem,
    service_name: partnerRecord.service_name || originalRequest.service_name,
  };
}

/**
 * Partner accepts the incoming job offer.
 * Enforces atomic database transaction with partner row lock (SELECT ... FOR UPDATE),
 * eligibility re-checks, and unique partial active job constraint.
 *
 * @param {string} requestId
 * @param {string} partnerId
 */
export async function handlePartnerAccept(requestId, partnerId) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock partner row to serialize concurrent accept calls by this partner
    const partnerRes = await client.query(
      `SELECT p.*, s.name AS service_name
       FROM partners p
       JOIN services s ON p.service_id = s.id
       WHERE p.id = $1 FOR UPDATE`,
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'not_found', message: 'Partner not found.' };
    }
    const partner = partnerRes.rows[0];

    // 2. Fetch the request to verify service match & current status
    const reqRes = await client.query(
      `SELECT r.*, s.name AS service_name, s.base_price_estimate, c.name AS customer_name, c.phone AS customer_phone
       FROM requests r
       JOIN services s ON r.service_id = s.id
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'not_found', message: 'Request not found.' };
    }
    const request = reqRes.rows[0];

    // Requirement d: Double-click or retried Accept from the same partner is idempotent
    if (request.status === 'accepted' && String(request.partner_id) === String(partnerId)) {
      await client.query('COMMIT');
      return {
        success: true,
        idempotent: true,
        request: formatAcceptedPayload(request, partner, request),
      };
    }

    // Already accepted by another partner
    if (request.status === 'accepted' && request.partner_id && String(request.partner_id) !== String(partnerId)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'taken',
        message: 'Request accepted by another partner',
      };
    }

    // Cancelled or expired
    if (request.status === 'cancelled') {
      await client.query('ROLLBACK');
      const isExpired =
        request.cancel_reason?.includes('busy') ||
        request.cancel_reason?.includes('expired') ||
        request.cancel_reason?.includes('outside 2 km');
      return {
        success: false,
        reason: 'cancelled',
        message: isExpired ? 'Request offer has expired' : 'Request was cancelled by customer',
      };
    }

    if (request.status !== 'searching' && request.status !== 'requested') {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'unavailable',
        message: 'Request is no longer available',
      };
    }

    // Re-check partner eligibility INSIDE the accept transaction
    // Rule: Offers the requested service
    if (Number(partner.service_id) !== Number(request.service_id)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'wrong_service',
        message: 'You do not offer this service category.',
      };
    }

    // Rule: Online
    if (!partner.online) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'offline',
        message: 'Partner is currently offline.',
      };
    }

    // Rule: KYC verified (not pending, not rejected)
    if (partner.kyc_status !== 'verified') {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'unverified',
        message: 'Partner KYC is not verified.',
      };
    }

    // Rule: Active subscription
    const subRes = await client.query(
      `SELECT id FROM subscriptions
       WHERE partner_id = $1 AND status = 'active' AND end_date > CURRENT_TIMESTAMP
       LIMIT 1`,
      [partnerId]
    );
    if (subRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'expired_plan',
        message: 'Active subscription plan required.',
      };
    }

    // Rule: Not on another active job (Requirement e: returns "you are already on a job")
    const activeJobRes = await client.query(
      `SELECT id FROM requests
       WHERE partner_id = $1
         AND status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started')
       LIMIT 1`,
      [partnerId]
    );
    if (activeJobRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'already_on_job',
        message: 'you are already on a job',
      };
    }

    // Requirement a: Atomic conditional update
    const updateRes = await client.query(
      `UPDATE requests
       SET partner_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND (status = 'searching' OR status = 'requested') AND partner_id IS NULL
       RETURNING *`,
      [partnerId, requestId]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const recheck = await db.query('SELECT status, partner_id, cancel_reason FROM requests WHERE id = $1', [requestId]);
      const curr = recheck.rows[0];
      if (curr?.status === 'accepted') {
        return { success: false, reason: 'taken', message: 'Request accepted by another partner' };
      } else if (curr?.status === 'cancelled') {
        const isExp =
          curr.cancel_reason?.includes('busy') ||
          curr.cancel_reason?.includes('expired') ||
          curr.cancel_reason?.includes('outside 2 km');
        return {
          success: false,
          reason: 'cancelled',
          message: isExp ? 'Request offer has expired' : 'Request was cancelled by customer',
        };
      }
      return { success: false, reason: 'taken', message: 'Request accepted by another partner' };
    }

    // Exactly one status-log entry for accepted
    await client.query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'accepted')`,
      [requestId]
    );

    await client.query('COMMIT');

    // Cancel time-out timer so it does not fire after accept
    const state = activeDispatches.get(String(requestId));
    if (state && state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state) {
      state.status = 'accepted';
      state.acceptedPartnerId = partnerId;
    }

    const acceptedPayload = formatAcceptedPayload(updateRes.rows[0], partner, request);

    if (io) {
      io.to(`customer:${request.customer_id}`).emit('request_accepted', acceptedPayload);
      io.to(`request:${requestId}`).emit('request_accepted', acceptedPayload);

      io.to(`partner:${partnerId}`).emit('request_confirmed', {
        ...acceptedPayload,
        job: {
          ...request,
          ...updateRes.rows[0],
          status: 'accepted',
          step_index: 1,
          partner: acceptedPayload.partner,
        },
      });

      // Requirement g: After accept, every other partner gets a "request taken" socket event
      const takenPayload = {
        requestId,
        order_number: acceptedPayload.order_number,
        message: 'Request accepted by another partner',
        reason: 'TAKEN_BY_ANOTHER_PARTNER',
      };

      if (state && Array.isArray(state.eligiblePartners)) {
        for (const p of state.eligiblePartners) {
          if (String(p.id) !== String(partnerId)) {
            io.to(`partner:${p.id}`).emit('request_taken', takenPayload);
          }
        }
      } else {
        io.to(`request:${requestId}`).emit('request_taken', takenPayload);
      }
    }

    activeDispatches.delete(String(requestId));

    return {
      success: true,
      request: acceptedPayload,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // Unique partial index violation (idx_requests_active_partner)
    if (err.code === '23505') {
      return {
        success: false,
        reason: 'already_on_job',
        message: 'you are already on a job',
      };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Partner declines the incoming job offer.
 * Decline only removes the request from that partner's own screen.
 * If every eligible partner declines, triggers "All partners busy, try again later".
 *
 * @param {string} requestId
 * @param {string} partnerId
 * @param {string} [reason]
 */
export async function handlePartnerDecline(requestId, partnerId, reason = 'PARTNER_DECLINED') {
  const state = activeDispatches.get(String(requestId));
  if (!state) return { success: false, message: 'Dispatch inactive.' };

  state.declinedPartnerIds.add(String(partnerId));

  if (io) {
    io.to(`partner:${partnerId}`).emit('request_declined_ack', {
      requestId,
      reason,
    });
  }

  // If every eligible partner has declined, trigger all partners busy
  if (state.declinedPartnerIds.size >= state.eligiblePartners.length) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    await handleMatchingTimeout(requestId);
  }

  return { success: true };
}

/**
 * Single time-out mechanism per request.
 * Safe if it fires during an accept, and will not fire after accept.
 *
 * @param {string} requestId
 */
export async function handleMatchingTimeout(requestId) {
  const state = activeDispatches.get(String(requestId));
  if (state && state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  activeDispatches.delete(String(requestId));

  // Atomic conditional update in DB: only if still searching
  const res = await db.query(
    `UPDATE requests
     SET status = 'cancelled', cancel_reason = 'All partners busy, try again later', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND (status = 'searching' OR status = 'requested') AND partner_id IS NULL
     RETURNING *`,
    [requestId]
  );

  if (res.rows.length > 0) {
    await db.query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
      [requestId]
    );

    if (io) {
      const orderNumber =
        res.rows[0].order_number ||
        state?.request?.order_number ||
        `ORD-${String(requestId).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

      const busyEvent = {
        requestId,
        order_number: orderNumber,
        status: 'busy',
        message: 'All partners busy, try again later',
        reason: 'ALL_PARTNERS_BUSY',
      };

      io.to(`customer:${res.rows[0].customer_id}`).emit('all_partners_busy', busyEvent);
      io.to(`request:${requestId}`).emit('all_partners_busy', busyEvent);

      if (state && Array.isArray(state.eligiblePartners)) {
        for (const p of state.eligiblePartners) {
          io.to(`partner:${p.id}`).emit('request_timeout', {
            requestId,
            order_number: orderNumber,
            message: 'Request offer timed out. You remain online for next dispatch.',
          });
        }
      }
    }
  }
}

/**
 * Customer cancels the request while searching, matching, or in active trip.
 * Conforms to Item 1: atomic update and clean notification.
 *
 * @param {string} requestId
 * @param {string} [reason]
 */
export async function handleCustomerCancel(requestId, reason = 'Cancelled by customer') {
  stopMovementSimulation(requestId);

  const state = activeDispatches.get(String(requestId));
  if (state && state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  activeDispatches.delete(String(requestId));

  const updateRes = await db.query(
    `UPDATE requests
     SET status = 'cancelled', cancel_reason = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND status NOT IN ('service_completed', 'payment_completed', 'cancelled')
     RETURNING *`,
    [reason, requestId]
  );

  if (updateRes.rows.length === 0) {
    return { success: false, message: 'Request is already completed or cancelled.' };
  }

  const reqRow = updateRes.rows[0];

  await db.query(
    `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
    [requestId]
  );

  if (reqRow.partner_id) {
    try {
      await db.query(`UPDATE partners SET online = true WHERE id = $1`, [reqRow.partner_id]);
    } catch (err) {
      console.warn('[SocketService Partner Free Warning]:', err.message);
    }
  }

  if (io) {
    const cancelPayload = {
      requestId,
      reason,
      status: 'cancelled',
      message: 'Customer cancelled the request. You are now free for new dispatches.',
    };

    io.to(`request:${requestId}`).emit('request_cancelled', cancelPayload);
    io.to(`customer:${reqRow.customer_id}`).emit('request_cancelled', cancelPayload);

    if (reqRow.partner_id) {
      io.to(`partner:${reqRow.partner_id}`).emit('request_cancelled', cancelPayload);
    }
    if (state && Array.isArray(state.eligiblePartners)) {
      for (const p of state.eligiblePartners) {
        io.to(`partner:${p.id}`).emit('request_cancelled', cancelPayload);
      }
    }
  }

  return { success: true, request: reqRow };
}

/**
 * Requirement h: If the server restarts, requests stuck in 'searching' are expired
 * cleanly on startup (customer sees "All partners busy"), no timers are orphaned,
 * and no job is left half-assigned.
 */
export async function cleanupOrphanedSearchingRequests() {
  try {
    const res = await db.query(
      `UPDATE requests
       SET status = 'cancelled',
           cancel_reason = 'All partners busy, try again later',
           updated_at = CURRENT_TIMESTAMP
       WHERE (status = 'searching' OR (status = 'requested' AND partner_id IS NULL))
       RETURNING id, customer_id, service_id`
    );

    for (const row of res.rows) {
      await db.query(
        `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
        [row.id]
      );
      if (io) {
        const orderNumber = `ORD-${String(row.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
        const busyEvent = {
          requestId: row.id,
          order_number: orderNumber,
          status: 'busy',
          message: 'All partners busy, try again later',
          reason: 'ALL_PARTNERS_BUSY',
        };
        io.to(`customer:${row.customer_id}`).emit('all_partners_busy', busyEvent);
        io.to(`request:${row.id}`).emit('all_partners_busy', busyEvent);
      }
    }

    if (res.rows.length > 0) {
      console.log(`[Startup Cleanup] Expired ${res.rows.length} orphaned searching request(s).`);
    }
  } catch (err) {
    console.error('[Startup Cleanup Error]:', err.message);
  }
}

/**
 * Active movement simulation intervals: requestId -> Interval
 */
const activeMovementSimulations = new Map();

/**
 * Start simulated partner movement toward customer coordinates every second (SRS FR-T2, Section 6)
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} [params.partnerId]
 * @param {string} [params.customerId]
 * @param {number} [params.startLat]
 * @param {number} [params.startLon]
 * @param {number} [params.endLat]
 * @param {number} [params.endLon]
 * @param {number} [params.initialEta]
 * @param {number} [params.totalSteps]
 */
export function startMovementSimulation({
  requestId,
  partnerId,
  customerId,
  startLat,
  startLon,
  endLat,
  endLon,
  initialEta = 14,
  totalSteps = 14,
}) {
  stopMovementSimulation(requestId);

  const sLat = Number(startLat) || 12.9716;
  const sLon = Number(startLon) || 77.6358;
  const eLat = Number(endLat) || 12.9784;
  const eLon = Number(endLon) || 77.6408;
  const steps = Math.max(5, Number(totalSteps) || 14);

  let currentStep = 0;

  const interval = setInterval(async () => {
    currentStep++;
    const t = Math.min(1.0, currentStep / steps);
    const curLat = Number((sLat + (eLat - sLat) * t).toFixed(6));
    const curLon = Number((sLon + (eLon - sLon) * t).toFixed(6));
    const remainingEta = t >= 1.0 ? 0 : Math.max(1, Math.ceil(initialEta * (1 - t)));

    const positionPayload = {
      requestId,
      latitude: curLat,
      longitude: curLon,
      progress: t,
      eta_minutes: remainingEta,
      status: 'partner_on_way',
      step_index: 2,
    };

    if (io) {
      io.to(`request:${requestId}`).emit('partner_location', positionPayload);
      io.to(`request:${requestId}`).emit('partner_location_update', positionPayload);
      if (customerId) {
        io.to(`customer:${customerId}`).emit('partner_location', positionPayload);
        io.to(`customer:${customerId}`).emit('partner_location_update', positionPayload);
      }
      if (partnerId) {
        io.to(`partner:${partnerId}`).emit('partner_location', positionPayload);
        io.to(`partner:${partnerId}`).emit('partner_location_update', positionPayload);
      }
    }

    if (t >= 1.0) {
      stopMovementSimulation(requestId);
    }
  }, 1000);

  activeMovementSimulations.set(String(requestId), interval);
}

/**
 * Stops any active movement simulation for a request
 *
 * @param {string} requestId
 */
export function stopMovementSimulation(requestId) {
  const existing = activeMovementSimulations.get(String(requestId));
  if (existing) {
    clearInterval(existing);
    activeMovementSimulations.delete(String(requestId));
  }
}

/**
 * Broadcasts a status transition to customer and partner rooms
 *
 * @param {string} requestId
 * @param {string} status ('on_the_way' | 'arrived' | 'service_started' | 'service_completed' | 'payment_completed' | 'cancelled')
 * @param {number} stepIndex (1..6)
 * @param {object} [extraData] Additional payload details (customer_id, partner_id, etc.)
 */
export function notifyRequestStatusUpdate(requestId, status, stepIndex, extraData = {}) {
  if (!io) return;

  const payload = {
    requestId,
    status,
    step_index: stepIndex,
    timestamp: new Date().toISOString(),
    ...extraData,
  };

  io.to(`request:${requestId}`).emit('request_status_updated', payload);
  if (extraData.customerId || extraData.customer_id) {
    const custId = extraData.customerId || extraData.customer_id;
    io.to(`customer:${custId}`).emit('request_status_updated', payload);
  }
  if (extraData.partnerId || extraData.partner_id) {
    const partId = extraData.partnerId || extraData.partner_id;
    io.to(`partner:${partId}`).emit('request_status_updated', payload);
  }
}

/**
 * Returns active dispatch state for inspection/testing
 */
export function getActiveDispatch(requestId) {
  return activeDispatches.get(String(requestId));
}

export default {
  initSocketServer,
  getIo,
  startRequestMatching,
  handlePartnerAccept,
  handlePartnerDecline,
  handleCustomerCancel,
  handleMatchingTimeout,
  cleanupOrphanedSearchingRequests,
  startMovementSimulation,
  stopMovementSimulation,
  notifyRequestStatusUpdate,
  getActiveDispatch,
  dismissPartnerOffers,
};

