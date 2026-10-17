/**
 * FixIt Now - Payment Controller
 * Conforms to docs/SRS.md FR-C18, BR-1, BR-7 and docs/PLAN.md Phase 8.
 * Handles simulated payment lifecycle: proceed -> waiting -> successful,
 * receipt generation, and ledger recording.
 */

import { query } from '../config/db.js';
import { notifyRequestStatusUpdate } from '../services/socket.service.js';
import { createNotification } from './notification.controller.js';

/**
 * 1. Process Simulated Payment (SRS FR-C18)
 * States: 'proceed' -> 'waiting' -> 'successful'
 */
export async function processPayment(req, res, next) {
  try {
    const requestId = req.params.id || req.body.request_id;
    const { payment_method = 'Direct UPI / Cash (On-site)', state = 'successful' } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!requestId) {
      return res.status(400).json({ status: 'error', message: 'Request ID is required.' });
    }

    // Fetch the request record
    const reqRes = await query(
      `SELECT r.*, s.name AS service_name, s.base_price_estimate,
              c.name AS customer_name, c.phone AS customer_phone,
              p.name AS partner_name, p.phone AS partner_phone
       FROM requests r
       JOIN services s ON r.service_id = s.id
       JOIN customers c ON r.customer_id = c.id
       LEFT JOIN partners p ON r.partner_id = p.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Work order request not found.' });
    }

    const currentReq = reqRes.rows[0];

    // Authorization check
    if (userRole === 'customer' && currentReq.customer_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'You can only process payment for your own requests.' });
    }
    if (userRole === 'partner' && currentReq.partner_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'You are not the assigned partner for this request.' });
    }

    const orderNumber = `ORD-${String(currentReq.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
    const amount = parseFloat(req.body.amount || currentReq.base_price_estimate) || 450.0;
    const methodStr =
      payment_method === 'cash' || String(payment_method).toLowerCase().includes('cash')
        ? 'Direct Cash (On-site)'
        : payment_method === 'upi' || String(payment_method).toLowerCase().includes('upi')
        ? 'Direct UPI (On-site)'
        : payment_method;

    // Handle 'proceed' state
    if (state === 'proceed') {
      return res.status(200).json({
        status: 'success',
        data: {
          state: 'proceed',
          order_number: orderNumber,
          amount,
          payment_method: methodStr,
          service_name: currentReq.service_name,
          partner_name: currentReq.partner_name,
          customer_name: currentReq.customer_name,
          message: 'Ready to proceed to settlement.',
        },
      });
    }

    // Handle 'waiting' state
    if (state === 'waiting') {
      return res.status(200).json({
        status: 'success',
        data: {
          state: 'waiting',
          order_number: orderNumber,
          amount,
          payment_method: methodStr,
          message: 'Waiting for on-site settlement confirmation...',
        },
      });
    }

    // Handle 'successful' state (default / final completion)
    const receiptNo = `REC-${String(currentReq.id).replace(/-/g, '').slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if payment already exists for this request
    const existingPay = await query('SELECT * FROM payments WHERE request_id = $1', [requestId]);
    let paymentRecord;

    if (existingPay.rows.length > 0) {
      const updatePay = await query(
        `UPDATE payments
         SET status = 'successful', receipt_no = COALESCE(receipt_no, $1), payment_method = $2, amount = $3
         WHERE request_id = $4
         RETURNING *`,
        [receiptNo, methodStr, amount, requestId]
      );
      paymentRecord = updatePay.rows[0];
    } else {
      const insertPay = await query(
        `INSERT INTO payments (request_id, amount, status, receipt_no, payment_method)
         VALUES ($1, $2, 'successful', $3, $4)
         RETURNING *`,
        [requestId, amount, receiptNo, methodStr]
      );
      paymentRecord = insertPay.rows[0];
    }

    // Update request status to payment_completed (Step 6)
    await query(
      `UPDATE requests
       SET status = 'payment_completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Insert status log tick
    await query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'payment_completed')`,
      [requestId]
    );

    // Free partner and increment total_jobs
    if (currentReq.partner_id) {
      try {
        await query(
          `UPDATE partners SET total_jobs = total_jobs + 1, online = true WHERE id = $1`,
          [currentReq.partner_id]
        );
      } catch (err) {
        console.warn('[Partner stats update warning]:', err.message);
      }
    }

    // Notify via Socket.IO
    notifyRequestStatusUpdate(requestId, 'payment_completed', 6, {
      customerId: currentReq.customer_id,
      partnerId: currentReq.partner_id,
      service_name: currentReq.service_name,
      customer_name: currentReq.customer_name,
      status: 'payment_completed',
      receipt_no: paymentRecord.receipt_no,
    });

    // In-app notifications
    try {
      await createNotification({
        recipientType: 'customer',
        recipientId: currentReq.customer_id,
        title: 'Payment Successful',
        message: `Settlement for work order ${orderNumber} (${currentReq.service_name}) completed. Receipt: ${paymentRecord.receipt_no}.`,
      });

      if (currentReq.partner_id) {
        await createNotification({
          recipientType: 'partner',
          recipientId: currentReq.partner_id,
          title: 'Payment Received',
          message: `Payment received for job ${orderNumber} from ${currentReq.customer_name}. Job marked completed.`,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Creation Warning]:', notifErr.message);
    }

    const receiptData = {
      id: paymentRecord.id,
      request_id: currentReq.id,
      receipt_no: paymentRecord.receipt_no,
      order_number: orderNumber,
      amount,
      payment_method: methodStr,
      status: 'successful',
      created_at: paymentRecord.created_at,
      service_name: currentReq.service_name,
      problem: currentReq.problem,
      address: currentReq.address,
      customer_name: currentReq.customer_name,
      customer_phone: currentReq.customer_phone,
      partner_name: currentReq.partner_name,
      partner_phone: currentReq.partner_phone,
    };

    return res.status(200).json({
      status: 'success',
      message: 'Payment settled and receipt generated successfully.',
      data: {
        payment: paymentRecord,
        receipt: receiptData,
        step_index: 6,
        status: 'payment_completed',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Get Work Order Receipt (SRS FR-C18)
 */
export async function getPaymentReceipt(req, res, next) {
  try {
    const requestId = req.params.id;

    const result = await query(
      `SELECT p.id AS payment_id, p.amount, p.status AS payment_status, p.receipt_no,
              p.payment_method, p.created_at AS payment_date,
              r.id AS request_id, r.problem, r.description, r.address, r.status AS request_status,
              s.name AS service_name,
              c.name AS customer_name, c.phone AS customer_phone,
              part.name AS partner_name, part.phone AS partner_phone, part.rating AS partner_rating,
              rat.stars AS rating_stars, rat.comment AS rating_comment
       FROM requests r
       JOIN services s ON r.service_id = s.id
       JOIN customers c ON r.customer_id = c.id
       LEFT JOIN partners part ON r.partner_id = part.id
       LEFT JOIN payments p ON p.request_id = r.id
       LEFT JOIN ratings rat ON rat.request_id = r.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Work order receipt not found.' });
    }

    const row = result.rows[0];
    const orderNumber = `ORD-${String(row.request_id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
    const receiptNo = row.receipt_no || `REC-${orderNumber.slice(4)}-01`;

    const receipt = {
      receipt_no: receiptNo,
      order_number: orderNumber,
      request_id: row.request_id,
      amount: parseFloat(row.amount) || 450.0,
      payment_method: row.payment_method || 'Direct UPI / Cash (On-site)',
      status: row.payment_status || 'successful',
      payment_date: row.payment_date || new Date().toISOString(),
      service_name: row.service_name,
      problem: row.problem,
      description: row.description,
      address: row.address,
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
      },
      partner: row.partner_name
        ? {
            name: row.partner_name,
            phone: row.partner_phone,
            rating: row.partner_rating,
          }
        : null,
      rating: row.rating_stars
        ? {
            stars: row.rating_stars,
            comment: row.rating_comment,
          }
        : null,
    };

    return res.status(200).json({
      status: 'success',
      data: receipt,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  processPayment,
  getPaymentReceipt,
};
