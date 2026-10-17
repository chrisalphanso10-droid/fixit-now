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

    socket.on('disconnect', () => {
      // Socket disconnected cleanly
    });
  });

  return io;
}

/**
 * Initiates the real-time matching and sequential offer loop for a customer request.
 *
 * @param {object} request The newly created request record from DB
 * @param {Array<object>} eligiblePartners Array of eligible partners sorted nearest first
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

  // Case 2: One or more eligible partners available. Begin sequential dispatch.
  const state = {
    requestId: request.id,
    request: requestPayload,
    eligiblePartners,
    currentIndex: 0,
    countdownSeconds,
    timer: null,
    status: 'offering',
  };

  activeDispatches.set(String(request.id), state);

  // Offer to the nearest partner (index 0)
  offerToCurrentPartner(String(request.id));

  return {
    success: true,
    status: 'searching',
    partner_count: eligiblePartners.length,
    order_number: orderNumber,
  };
}

/**
 * Offers the request to the partner at `state.currentIndex` with a countdown timer.
 * If index exceeds partner list, marks the request as "all partners busy".
 *
 * @param {string} requestId
 */
function offerToCurrentPartner(requestId) {
  const state = activeDispatches.get(String(requestId));
  if (!state || state.status !== 'offering') {
    return;
  }

  // Clear any existing timer
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  // If we have exhausted all eligible partners
  if (state.currentIndex >= state.eligiblePartners.length) {
    handleMatchingExhausted(requestId);
    return;
  }

  const currentPartner = state.eligiblePartners[state.currentIndex];
  const etaMinutes =
    currentPartner.eta_minutes ||
    Math.max(5, Math.round(Number(currentPartner.distance_km || 1) * 6 + 5));

  const incomingJobPayload = {
    id: state.request.id,
    request_id: state.request.id,
    order_number: state.request.order_number,
    customer_id: state.request.customer_id,
    customer_name: state.request.customer_name || 'Customer',
    customer_phone: state.request.customer_phone || '',
    service_id: state.request.service_id,
    service_name: state.request.service_name || currentPartner.service_name || 'Service',
    problem: state.request.problem,
    description: state.request.description,
    address: state.request.address,
    distance_km: currentPartner.distance_km,
    eta_minutes: etaMinutes,
    photo_url: state.request.photo_url || null,
    created_at: state.request.created_at || new Date().toISOString(),
    service_otp: state.request.service_otp,
  };

  if (io) {
    // 1. Emit incoming request popup event to the specific partner
    io.to(`partner:${currentPartner.id}`).emit('incoming_request', {
      job: incomingJobPayload,
      countdown: state.countdownSeconds,
    });

    // 2. Emit status update to the waiting customer
    const searchUpdate = {
      requestId: state.request.id,
      order_number: state.request.order_number,
      status: 'searching',
      attemptingPartnerIndex: state.currentIndex + 1,
      totalEligible: state.eligiblePartners.length,
      countdown: state.countdownSeconds,
    };

    io.to(`customer:${state.request.customer_id}`).emit('searching_update', searchUpdate);
    io.to(`request:${state.request.id}`).emit('searching_update', searchUpdate);
  }

  // Start the countdown timer (default 30 seconds)
  state.timer = setTimeout(async () => {
    // Notify the partner that this request offer timed out
    if (io) {
      io.to(`partner:${currentPartner.id}`).emit('request_timeout', {
        requestId: state.request.id,
        order_number: state.request.order_number,
        message: 'Request offer timed out. You remain online for next dispatch.',
      });
    }

    // Cascade to next nearest eligible partner automatically
    state.currentIndex++;
    offerToCurrentPartner(requestId);
  }, state.countdownSeconds * 1000);
}

/**
 * Partner accepts the incoming job offer
 *
 * @param {string} requestId
 * @param {string} partnerId
 */
export async function handlePartnerAccept(requestId, partnerId) {
  const state = activeDispatches.get(String(requestId));
  if (!state) {
    throw new Error('This request dispatch is no longer active or has expired.');
  }

  const currentPartner = state.eligiblePartners[state.currentIndex];
  if (!currentPartner || String(currentPartner.id) !== String(partnerId)) {
    throw new Error(
      `This request was offered to partner ${currentPartner?.id} (${currentPartner?.name}), but accept called by partner ${partnerId}.`
    );
  }

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.status = 'accepted';

  // Update PostgreSQL database with accepted partner & status
  await db.query(
    `UPDATE requests
     SET partner_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [partnerId, requestId]
  );

  await db.query(
    `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'accepted')`,
    [requestId]
  );

  const etaMinutes =
    currentPartner.eta_minutes ||
    Math.max(5, Math.round(Number(currentPartner.distance_km || 1) * 6 + 5));

  const partnerProfile = {
    id: currentPartner.id,
    name: currentPartner.name,
    phone: currentPartner.phone,
    service_id: currentPartner.service_id,
    service_name: currentPartner.service_name,
    rating: currentPartner.rating,
    total_jobs: currentPartner.total_jobs,
    badge: currentPartner.badge || 'Certified Tradesperson',
    vehicle: currentPartner.vehicle || 'Standard Service Vehicle',
    distance_km: currentPartner.distance_km,
    eta_minutes: etaMinutes,
    photo_url: currentPartner.photo_url || null,
  };

  const acceptedPayload = {
    requestId: state.request.id,
    order_number: state.request.order_number,
    status: 'accepted',
    step_index: 1, // Step 1: Request accepted (docs/DESIGN.md line 84)
    partner: partnerProfile,
    service_otp: state.request.service_otp,
    address: state.request.address,
    problem: state.request.problem,
    service_name: state.request.service_name,
  };

  if (io) {
    // Notify customer room
    io.to(`customer:${state.request.customer_id}`).emit('request_accepted', acceptedPayload);
    io.to(`request:${state.request.id}`).emit('request_accepted', acceptedPayload);

    // Confirm to accepting partner
    io.to(`partner:${partnerId}`).emit('request_confirmed', {
      ...acceptedPayload,
      job: {
        ...state.request,
        status: 'accepted',
        step_index: 1,
        partner: partnerProfile,
      },
    });
  }

  // Remove dispatch from active dispatches
  activeDispatches.delete(String(requestId));

  return {
    success: true,
    request: acceptedPayload,
  };
}

/**
 * Partner declines the incoming job offer
 *
 * @param {string} requestId
 * @param {string} partnerId
 * @param {string} [reason]
 */
export async function handlePartnerDecline(requestId, partnerId, reason = 'PARTNER_DECLINED') {
  const state = activeDispatches.get(String(requestId));
  if (!state) return { success: false, message: 'Dispatch inactive.' };

  const currentPartner = state.eligiblePartners[state.currentIndex];
  if (currentPartner && String(currentPartner.id) === String(partnerId)) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (io) {
      io.to(`partner:${partnerId}`).emit('request_declined_ack', {
        requestId,
        reason,
      });
    }

    // Cascade to next partner immediately
    state.currentIndex++;
    offerToCurrentPartner(requestId);
    return { success: true };
  }

  return { success: false, message: 'Not the currently offered partner.' };
}

/**
 * Customer cancels the request while searching, matching, or in active trip
 * Conforms to docs/SRS.md FR-C19, FR-T3.
 *
 * @param {string} requestId
 * @param {string} [reason]
 */
export async function handleCustomerCancel(requestId, reason = 'Cancelled by customer') {
  // 1. Stop any active location movement simulation
  stopMovementSimulation(requestId);

  const state = activeDispatches.get(String(requestId));
  let targetPartnerId = null;
  let targetCustomerId = null;

  if (state) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.status = 'cancelled';

    const currentPartner = state.eligiblePartners[state.currentIndex];
    if (currentPartner) {
      targetPartnerId = currentPartner.id;
    }
    targetCustomerId = state.request?.customer_id;
    activeDispatches.delete(String(requestId));
  }

  // 2. Fetch DB request record to resolve assigned partner and customer if already accepted
  try {
    const checkRes = await db.query(
      'SELECT customer_id, partner_id FROM requests WHERE id = $1',
      [requestId]
    );
    if (checkRes.rows.length > 0) {
      targetCustomerId = checkRes.rows[0].customer_id || targetCustomerId;
      if (checkRes.rows[0].partner_id) {
        targetPartnerId = checkRes.rows[0].partner_id;
      }
    }
  } catch (err) {
    console.warn('[SocketService DB Query on Cancel Warning]:', err.message);
  }

  // 3. Update DB
  await db.query(
    `UPDATE requests
     SET status = 'cancelled', cancel_reason = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [reason, requestId]
  );

  await db.query(
    `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
    [requestId]
  );

  // 4. Free the partner for new dispatches (SRS FR-C19)
  if (targetPartnerId) {
    try {
      await db.query(`UPDATE partners SET online = true WHERE id = $1`, [targetPartnerId]);
    } catch (err) {
      console.warn('[SocketService Partner Free Warning]:', err.message);
    }
  }

  // 5. Broadcast cancellation to all relevant Socket.IO rooms
  if (io) {
    const cancelPayload = {
      requestId,
      reason,
      status: 'cancelled',
      message: 'Customer cancelled the request. You are now free for new dispatches.',
    };

    io.to(`request:${requestId}`).emit('request_cancelled', cancelPayload);
    if (targetCustomerId) {
      io.to(`customer:${targetCustomerId}`).emit('request_cancelled', cancelPayload);
    }
    if (targetPartnerId) {
      io.to(`partner:${targetPartnerId}`).emit('request_cancelled', cancelPayload);
    }
  }

  return { success: true };
}

/**
 * Handles exhausted partner list (All partners declined, timed out, or none eligible)
 *
 * @param {string} requestId
 */
async function handleMatchingExhausted(requestId) {
  const state = activeDispatches.get(String(requestId));
  if (!state) return;

  activeDispatches.delete(String(requestId));

  try {
    await db.query(
      `UPDATE requests
       SET status = 'cancelled', cancel_reason = 'All partners busy, try again later', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    await db.query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'cancelled')`,
      [requestId]
    );
  } catch (err) {
    console.error('[SocketService DB Error on Exhausted]:', err.message);
  }

  if (io) {
    const busyEvent = {
      requestId: state.request.id,
      order_number: state.request.order_number,
      status: 'busy',
      message: 'All partners busy, try again later',
      reason: 'ALL_PARTNERS_BUSY',
    };

    io.to(`customer:${state.request.customer_id}`).emit('all_partners_busy', busyEvent);
    io.to(`request:${requestId}`).emit('all_partners_busy', busyEvent);
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
  startMovementSimulation,
  stopMovementSimulation,
  notifyRequestStatusUpdate,
  getActiveDispatch,
};

