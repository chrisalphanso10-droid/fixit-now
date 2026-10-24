/**
 * FixIt Now - Request Controller
 * Conforms to docs/SRS.md FR-C6, FR-C7, FR-C9, FR-C10 to FR-C12, FR-C19, FR-P7, FR-P9, FR-M1 to FR-M6.
 */

import { query, getClient } from '../config/db.js';
import { geocodeAddress } from '../services/geocoding.service.js';
import { findEligiblePartnersFromDb } from '../services/matching.service.js';
import {
  startRequestMatching,
  handlePartnerAccept,
  handlePartnerDecline,
  handleCustomerCancel,
  startMovementSimulation,
  stopMovementSimulation,
  notifyRequestStatusUpdate,
} from '../services/socket.service.js';
import { createNotification } from './notification.controller.js';

/**
 * 1. Create a New Service Request (SRS FR-C6, FR-C9, FR-C10)
 * Immediate requests only; geocodes location, persists record, finds eligible partners within 2 km,
 * and launches sequential Socket.IO dispatch.
 */
export async function createRequest(req, res, next) {
  try {
    const customerId = req.user.id;
    const {
      service_id,
      problem,
      description,
      address,
      latitude,
      longitude,
    } = req.body;

    if (!service_id) {
      return res.status(400).json({ status: 'error', message: 'Service category is required.' });
    }
    if (!problem?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Problem headline is required.' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Fault description is required.' });
    }
    if (!address?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Service street address is required.' });
    }

    // Verify service exists
    const serviceRes = await query(
      'SELECT id, name, base_price_estimate FROM services WHERE id = $1 AND active = true',
      [service_id]
    );
    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Selected service category is not available.' });
    }
    const serviceObj = serviceRes.rows[0];

    // Fetch customer details
    const custRes = await query('SELECT name, phone FROM customers WHERE id = $1', [customerId]);
    const customerName = custRes.rows[0]?.name || 'Customer';
    const customerPhone = custRes.rows[0]?.phone || '';

    // Handle photo URL from Multer file or body
    let photoUrl = null;
    if (req.file) {
      photoUrl = `uploads/requests/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photoUrl = req.body.photo_url;
    }

    // Geocode address if coordinates are missing or zero (outside transaction to avoid blocking)
    let lat = latitude != null ? Number(latitude) : null;
    let lon = longitude != null ? Number(longitude) : null;
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon) || (lat === 0 && lon === 0)) {
      const geo = await geocodeAddress(address.trim());
      lat = geo.latitude;
      lon = geo.longitude;
    }

    // Generate 6-digit service OTP (SRS FR-C16)
    const serviceOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Concurrency requirement f: Customer row lock inside transaction serializes concurrent double-clicks
    const client = await getClient();
    let existing = null;
    let newRequest = null;

    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);

      // Check if the same customer submitted the same service within the last few seconds
      const recentRes = await client.query(
        `SELECT * FROM requests
         WHERE customer_id = $1
           AND service_id = $2
           AND status IN ('searching', 'requested')
           AND created_at > (CURRENT_TIMESTAMP - INTERVAL '5 seconds')
         ORDER BY created_at DESC
         LIMIT 1`,
        [customerId, serviceObj.id]
      );

      if (recentRes.rows.length > 0) {
        existing = recentRes.rows[0];
        await client.query('COMMIT');
      } else {
        const insertResult = await client.query(
          `INSERT INTO requests (
             customer_id, service_id, problem, description, address, latitude, longitude, photo_url, status, service_otp
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'searching', $9)
           RETURNING *`,
          [
            customerId,
            serviceObj.id,
            problem.trim(),
            description.trim(),
            address.trim(),
            lat,
            lon,
            photoUrl,
            serviceOtp,
          ]
        );
        newRequest = insertResult.rows[0];

        // Insert initial status log tick
        await client.query(
          `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'searching')`,
          [newRequest.id]
        );

        await client.query('COMMIT');
      }
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    if (existing) {
      const orderNumber = `ORD-${String(existing.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
      return res.status(200).json({
        status: 'success',
        message: 'Request created. Scanning for nearby eligible partners...',
        data: {
          request: {
            ...existing,
            order_number: orderNumber,
            service_name: serviceObj.name,
            base_price_estimate: serviceObj.base_price_estimate,
            customer_name: customerName,
            customer_phone: customerPhone,
          },
          order_number: orderNumber,
          dispatch_status: 'searching',
        },
      });
    }

    const orderNumber = `ORD-${String(newRequest.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

    // Query eligible partners within 2 km (online, KYC verified, active plan, no active job, service match)
    const eligiblePartners = await findEligiblePartnersFromDb(serviceObj.id, lat, lon, 2.0);

    const fullRequestRecord = {
      ...newRequest,
      order_number: orderNumber,
      service_name: serviceObj.name,
      base_price_estimate: serviceObj.base_price_estimate,
      customer_name: customerName,
      customer_phone: customerPhone,
    };

    // Initiate Socket.IO matching broadcast offer loop
    const dispatchResult = await startRequestMatching(fullRequestRecord, eligiblePartners);

    return res.status(201).json({
      status: 'success',
      message: dispatchResult.success
        ? 'Request created. Scanning for nearby eligible partners...'
        : 'All partners busy, try again later',
      data: {
        request: fullRequestRecord,
        order_number: orderNumber,
        eligible_partners_count: eligiblePartners.length,
        dispatch_status: dispatchResult.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Get Request Details by ID (SRS FR-C13, FR-C14)
 */
export async function getRequestById(req, res, next) {
  try {
    const requestId = req.params.id;

    const result = await query(
      `SELECT
         r.*,
         s.name AS service_name,
         s.base_price_estimate,
         c.name AS customer_name,
         c.phone AS customer_phone,
         p.name AS partner_name,
         p.phone AS partner_phone,
         p.rating AS partner_rating,
         p.total_jobs AS partner_total_jobs,
         p.badge AS partner_badge,
         p.vehicle AS partner_vehicle,
         p.photo_url AS partner_photo_url,
         p.latitude AS partner_lat,
         p.longitude AS partner_lon
       FROM requests r
       JOIN services s ON r.service_id = s.id
       JOIN customers c ON r.customer_id = c.id
       LEFT JOIN partners p ON r.partner_id = p.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found.' });
    }

    const row = result.rows[0];

    // Authorization & Ownership check (Security & Privacy)
    const user = req.user;
    if (user && user.role !== 'admin') {
      if (user.role === 'customer' && row.customer_id !== user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to view this request.' });
      }
      if (user.role === 'partner' && row.partner_id && row.partner_id !== user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to view this request.' });
      }
    }

    const orderNumber = `ORD-${String(row.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;

    // Map status to step index for tracking screen
    const stepMap = {
      requested: 0,
      accepted: 1,
      partner_on_way: 2,
      partner_arrived: 3,
      service_started: 4,
      service_completed: 5,
      payment_completed: 6,
      cancelled: -1,
    };

    const partnerData = row.partner_id
      ? {
          id: row.partner_id,
          name: row.partner_name,
          phone: row.partner_phone,
          rating: row.partner_rating,
          total_jobs: row.partner_total_jobs,
          badge: row.partner_badge,
          vehicle: row.partner_vehicle,
          photo_url: row.partner_photo_url,
          latitude: row.partner_lat,
          longitude: row.partner_lon,
        }
      : null;

    // Query all status transition logs with timestamps
    const logsRes = await query(
      `SELECT id, status, created_at
       FROM request_status_logs
       WHERE request_id = $1
       ORDER BY created_at ASC`,
      [requestId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        ...row,
        order_number: orderNumber,
        step_index: stepMap[row.status] ?? 0,
        partner: partnerData,
        status_logs: logsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Get Request History (SRS FR-C7, FR-P11)
 * Supports customer and partner roles with status filtering ('all', 'completed', 'cancelled').
 */
export async function getRequestHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const filter = (req.query.filter || req.query.status || 'all').toLowerCase();

    let condition = '';
    const params = [userId];

    if (userRole === 'partner') {
      condition = 'r.partner_id = $1';
    } else {
      condition = 'r.customer_id = $1';
    }

    if (filter === 'completed') {
      condition += " AND r.status IN ('service_completed', 'payment_completed')";
    } else if (filter === 'cancelled') {
      condition += " AND r.status = 'cancelled'";
    }

    const result = await query(
      `SELECT
         r.*,
         s.name AS service_name,
         s.base_price_estimate,
         c.name AS customer_name,
         c.phone AS customer_phone,
         p.name AS partner_name,
         p.phone AS partner_phone,
         p.rating AS partner_rating,
         p.vehicle AS partner_vehicle,
         rat.stars AS rating_stars,
         rat.comment AS rating_comment,
         pay.receipt_no,
         pay.payment_method,
         pay.amount AS paid_amount
       FROM requests r
       JOIN services s ON r.service_id = s.id
       JOIN customers c ON r.customer_id = c.id
       LEFT JOIN partners p ON r.partner_id = p.id
       LEFT JOIN ratings rat ON rat.request_id = r.id
       LEFT JOIN payments pay ON pay.request_id = r.id
       WHERE ${condition}
       ORDER BY r.created_at DESC`,
      params
    );

    const rows = result.rows;

    const mapped = rows.map((row) => ({
      ...row,
      order_number: `ORD-${String(row.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`,
      rating: row.rating_stars
        ? { stars: row.rating_stars, comment: row.rating_comment }
        : null,
      amount: parseFloat(row.paid_amount || row.base_price_estimate) || 450.0,
      payment_mode: row.payment_method || 'Direct UPI / Cash (On-site)',
      receipt_no: row.receipt_no,
      completed_at: row.updated_at || row.created_at,
      partner: row.partner_id
        ? {
            id: row.partner_id,
            name: row.partner_name,
            phone: row.partner_phone,
            rating: row.partner_rating,
            vehicle: row.partner_vehicle,
          }
        : null,
    }));

    return res.status(200).json({
      status: 'success',
      data: mapped,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Cancel Service Request (SRS FR-C19, FR-T3)
 */
export async function cancelRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const { reason } = req.body;
    const customerId = req.user.id;

    // Verify ownership
    const check = await query('SELECT id, status, customer_id FROM requests WHERE id = $1', [
      requestId,
    ]);
    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found.' });
    }

    const currentReq = check.rows[0];
    if (req.user.role !== 'admin' && (req.user.role !== 'customer' || currentReq.customer_id !== customerId)) {
      return res.status(403).json({ status: 'error', message: 'You can only cancel your own requests.' });
    }

    if (currentReq.status === 'service_completed' || currentReq.status === 'payment_completed') {
      return res.status(400).json({ status: 'error', message: 'Cannot cancel a completed service.' });
    }

    const cancelReason = reason?.trim() || 'Cancelled by customer';
    await handleCustomerCancel(requestId, cancelReason);

    return res.status(200).json({
      status: 'success',
      message: 'Request cancelled successfully.',
      data: {
        id: requestId,
        status: 'cancelled',
        cancel_reason: cancelReason,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Partner Respond to Incoming Request (Accept / Decline) (SRS FR-P9, FR-P7)
 */
export async function respondToRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const partnerId = req.user.id;
    const { decision, reason } = req.body;

    if (decision !== 'accept' && decision !== 'decline') {
      return res.status(400).json({ status: 'error', message: "Decision must be 'accept' or 'decline'." });
    }

    if (decision === 'accept') {
      const result = await handlePartnerAccept(requestId, partnerId);
      if (!result.success) {
        // Requirement: Never an error page and never an HTTP 500
        return res.status(result.reason === 'taken' ? 409 : 400).json({
          status: 'fail',
          code: result.reason,
          message: result.message,
          data: result,
        });
      }
      return res.status(200).json({
        status: 'success',
        message: 'Work order accepted.',
        data: result,
      });
    } else {
      const result = await handlePartnerDecline(requestId, partnerId, reason);
      return res.status(200).json({
        status: 'success',
        message: 'Request declined.',
        data: result,
      });
    }
  } catch (err) {
    // Graceful error fallback - never 500
    return res.status(400).json({
      status: 'fail',
      message: err.message || 'Unable to process response.',
    });
  }
}

/**
 * 6. Update Request Status (Partner advances work order lifecycle)
 * Statuses: 'on_the_way' (2), 'arrived' (3), 'completed' (5), 'paid' (6)
 */
export async function updateRequestStatus(req, res, next) {
  try {
    const requestId = req.params.id;
    const partnerId = req.user.id;
    const { status } = req.body;

    const allowedTransitions = [
      'accepted',
      'start_trip',
      'on_the_way',
      'partner_on_way',
      'arrived',
      'partner_arrived',
      'start_service',
      'service_started',
      'in_progress',
      'completed',
      'service_completed',
      'payment_received',
      'paid',
      'payment_completed',
    ];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status transition: ${status}. Must be one of: ${allowedTransitions.join(', ')}.`,
      });
    }

    const check = await query(
      `SELECT r.id, r.status, r.customer_id, r.partner_id, r.service_otp,
              r.latitude AS customer_lat, r.longitude AS customer_lon,
              c.name AS customer_name, c.phone AS customer_phone,
              s.name AS service_name,
              p.latitude AS partner_lat, p.longitude AS partner_lon
       FROM requests r
       JOIN customers c ON r.customer_id = c.id
       JOIN services s ON r.service_id = s.id
       LEFT JOIN partners p ON r.partner_id = p.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found.' });
    }

    const currentReq = check.rows[0];
    if (String(currentReq.partner_id) !== String(partnerId)) {
      return res.status(403).json({ status: 'error', message: 'You are not the assigned partner for this request.' });
    }

    // Step index and DB status mapping (matches docs/SRS.md and db/schema.sql constraints)
    const statusMap = {
      accepted: { dbStatus: 'accepted', stepIndex: 1 },
      start_trip: { dbStatus: 'partner_on_way', stepIndex: 2 },
      on_the_way: { dbStatus: 'partner_on_way', stepIndex: 2 },
      partner_on_way: { dbStatus: 'partner_on_way', stepIndex: 2 },
      arrived: { dbStatus: 'partner_arrived', stepIndex: 3 },
      partner_arrived: { dbStatus: 'partner_arrived', stepIndex: 3 },
      start_service: { dbStatus: 'service_started', stepIndex: 4 },
      in_progress: { dbStatus: 'service_started', stepIndex: 4 },
      service_started: { dbStatus: 'service_started', stepIndex: 4 },
      completed: { dbStatus: 'service_completed', stepIndex: 5 },
      service_completed: { dbStatus: 'service_completed', stepIndex: 5 },
      payment_received: { dbStatus: 'payment_completed', stepIndex: 6 },
      paid: { dbStatus: 'payment_completed', stepIndex: 6 },
      payment_completed: { dbStatus: 'payment_completed', stepIndex: 6 },
      cancelled: { dbStatus: 'cancelled', stepIndex: -1 },
    };
    const mapped = statusMap[status] || { dbStatus: status, stepIndex: 1 };
    const dbStatus = mapped.dbStatus;
    const stepIndex = mapped.stepIndex;

    // Update DB with valid enum status
    await query(
      `UPDATE requests
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [dbStatus, requestId]
    );

    await query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, $2)`,
      [requestId, dbStatus]
    );

    // Movement Simulation: Start when partner begins trip (SRS FR-T2, FR-C15)
    if (dbStatus === 'partner_on_way') {
      const cLat = Number(currentReq.customer_lat) || 12.9784;
      const cLon = Number(currentReq.customer_lon) || 77.6408;
      const pLat = Number(currentReq.partner_lat) || (cLat - 0.007);
      const pLon = Number(currentReq.partner_lon) || (cLon - 0.005);

      startMovementSimulation({
        requestId,
        partnerId,
        customerId: currentReq.customer_id,
        startLat: pLat,
        startLon: pLon,
        endLat: cLat,
        endLon: cLon,
        initialEta: 14,
        totalSteps: 14,
      });
    } else if (dbStatus === 'partner_arrived') {
      stopMovementSimulation(requestId);
    } else if (dbStatus === 'service_completed' || dbStatus === 'payment_completed') {
      stopMovementSimulation(requestId);
    }

    // If paid/completed, increment partner total_jobs and free partner (SRS FR-P12, BR-7)
    if (dbStatus === 'payment_completed' || dbStatus === 'service_completed') {
      try {
        await query(
          `UPDATE partners SET total_jobs = total_jobs + 1, online = true WHERE id = $1`,
          [partnerId]
        );
      } catch (err) {
        console.warn('[Partner stats update warning]:', err.message);
      }
    }

    // Notify customer and partner rooms via Socket.IO
    notifyRequestStatusUpdate(requestId, dbStatus, stepIndex, {
      customerId: currentReq.customer_id,
      partnerId,
      service_name: currentReq.service_name,
      customer_name: currentReq.customer_name,
    });

    return res.status(200).json({
      status: 'success',
      message: `Request status updated to ${dbStatus}.`,
      data: {
        id: requestId,
        status: dbStatus,
        step_index: stepIndex,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. Verify Service OTP (Partner arrives and customer provides 6-digit OTP to start service)
 * Transitions status to 'in_progress' (Step 4)
 */
export async function verifyRequestOtp(req, res, next) {
  try {
    const requestId = req.params.id;
    const partnerId = req.user.id;
    const { otp } = req.body;

    if (!otp || !otp.toString().trim()) {
      return res.status(400).json({
        status: 'error',
        message: '6-digit service OTP is required.',
      });
    }

    const check = await query(
      `SELECT r.id, r.status, r.customer_id, r.partner_id, r.service_otp,
              c.name AS customer_name, s.name AS service_name
       FROM requests r
       JOIN customers c ON r.customer_id = c.id
       JOIN services s ON r.service_id = s.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found.' });
    }

    const currentReq = check.rows[0];
    if (String(currentReq.partner_id) !== String(partnerId)) {
      return res.status(403).json({ status: 'error', message: 'You are not the assigned partner for this request.' });
    }

    const cleanInputOtp = otp.toString().trim();
    const expectedOtp = String(currentReq.service_otp).trim();

    if (cleanInputOtp !== expectedOtp) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid service verification OTP. Please ask the customer for the 6-digit code shown on their tracking screen.',
      });
    }

    // Advance to 'service_started' (Step 4 in db/schema.sql)
    await query(
      `UPDATE requests
       SET status = 'service_started', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    await query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'service_started')`,
      [requestId]
    );

    notifyRequestStatusUpdate(requestId, 'service_started', 4, {
      customerId: currentReq.customer_id,
      partnerId,
      service_name: currentReq.service_name,
      customer_name: currentReq.customer_name,
      status: 'service_started',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Service OTP verified successfully. Work order is now in progress.',
      data: {
        id: requestId,
        status: 'service_started',
        step_index: 4,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. Submit Customer Rating (SRS FR-C17)
 */
export async function rateRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const { stars, rating, comment, review } = req.body;

    const rawStars = stars !== undefined ? stars : (rating !== undefined ? rating : 5);
    const parsedStars = parseInt(rawStars, 10);
    if (isNaN(parsedStars) || parsedStars < 1 || parsedStars > 5) {
      return res.status(400).json({ status: 'error', message: 'Rating must be an integer between 1 and 5 stars.' });
    }
    const numStars = parsedStars;
    const cleanComment = (comment || review || 'Service completed successfully.').trim();

    const check = await query(
      `SELECT r.id, r.customer_id, r.partner_id, r.status
       FROM requests r
       WHERE r.id = $1`,
      [requestId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found.' });
    }

    const currentReq = check.rows[0];

    // Ownership check: Customer must own this request (or admin)
    if (req.user && req.user.role !== 'admin' && currentReq.customer_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'You can only rate your own service requests.' });
    }

    // Status check: Request must be completed or paid
    if (currentReq.status !== 'service_completed' && currentReq.status !== 'payment_completed') {
      return res.status(400).json({ status: 'error', message: 'Cannot rate a request that has not been completed.' });
    }

    const partnerId = currentReq.partner_id;
    if (!partnerId) {
      return res.status(400).json({ status: 'error', message: 'No partner was assigned to this request.' });
    }

    // Check if already rated (idempotency & fraud prevention)
    const existingRating = await query('SELECT id FROM ratings WHERE request_id = $1', [requestId]);
    if (existingRating.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'This request has already been rated.' });
    }

    const ratingRes = await query(
      `INSERT INTO ratings (request_id, partner_id, stars, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, request_id, partner_id, stars, comment, created_at`,
      [requestId, partnerId, numStars, cleanComment]
    );

    try {
      await query(
        `UPDATE partners
         SET rating = (SELECT ROUND(AVG(stars)::numeric, 1) FROM ratings WHERE partner_id = $1)
         WHERE id = $1`,
        [partnerId]
      );
    } catch (err) {
      console.warn('[Partner Rating Update Warning]:', err.message);
    }

    try {
      await createNotification({
        recipientType: 'partner',
        recipientId: partnerId,
        title: 'New Customer Review',
        message: `A customer gave you ${numStars}★: "${cleanComment.slice(0, 60)}"`,
      });
    } catch (notifErr) {
      console.warn('[Rating notification warning]:', notifErr.message);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Rating submitted successfully.',
      data: ratingRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createRequest,
  getRequestById,
  getRequestHistory,
  cancelRequest,
  respondToRequest,
  updateRequestStatus,
  verifyRequestOtp,
  rateRequest,
};
