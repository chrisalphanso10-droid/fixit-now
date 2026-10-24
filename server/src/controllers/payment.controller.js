/**
 * FixIt Now - Payment Controller
 * Handles Payment Attempt creation, status checking, and server-rendered /pay/:token page.
 * Conforms to Item 3:
 * - Creates payment attempts with locked amount.
 * - Rate-limits GET /pay/:token.
 * - Server-renders mobile-friendly HTML without React or CORS.
 * - Displays exact user messages: "Payment confirmed", "This QR was already used", "This QR has expired", "Invalid QR".
 */

import { query } from '../config/db.js';
import { notifyRequestStatusUpdate } from '../services/socket.service.js';
import { createNotification } from './notification.controller.js';
import {
  createPaymentAttempt,
  getActivePaymentAttempt,
  getPaymentAttemptById,
  handleScanToken,
} from '../services/payment.service.js';

// Simple in-memory sliding-window IP rate limiter for /pay/:token
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/min per IP

export function payRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  let record = rateLimitMap.get(ip);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record = { startTime: now, count: 1 };
    rateLimitMap.set(ip, record);
    return next();
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Too Many Requests - FixIt Now</title>
        <style>
          body { font-family: monospace; background: #FFFDF8; color: #111111; padding: 24px; text-align: center; }
          .card { border: 2px solid #111111; max-width: 400px; margin: 40px auto; padding: 24px; box-shadow: 4px 4px 0 #111111; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Too Many Requests</h2>
          <p>Please wait a moment before trying again.</p>
        </div>
      </body>
      </html>
    `);
  }

  next();
}

/**
 * Clean up old rate limiter records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * POST /api/partner/payment-attempt
 * Creates a payment attempt for the partner and plan.
 */
export async function createPaymentAttemptHandler(req, res, next) {
  try {
    const partnerId = req.user.id;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Plan ID is required to initiate a payment attempt.',
      });
    }

    const result = await createPaymentAttempt(partnerId, plan_id);
    return res.status(201).json({
      status: 'success',
      message: 'Payment attempt created successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/partner/payment-attempt/active
 * Gets the active / latest attempt for this partner & plan.
 */
export async function getActivePaymentAttemptHandler(req, res, next) {
  try {
    const partnerId = req.user.id;
    const planId = req.query.plan_id || req.query.planId;

    if (!planId) {
      return res.status(400).json({
        status: 'error',
        message: 'Plan ID query parameter is required.',
      });
    }

    const result = await getActivePaymentAttempt(partnerId, planId);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/partner/payment-attempt/:id
 * Gets an attempt by ID.
 */
export async function getPaymentAttemptByIdHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getPaymentAttemptById(id);
    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment attempt not found.',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /pay/:token
 * Plain server-rendered mobile-friendly HTML page.
 * Never throws 500 on used/expired/invalid tokens.
 */
export async function renderPayPage(req, res) {
  try {
    const { token } = req.params;
    const scanResult = await handleScanToken(token);

    if (scanResult.success) {
      return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed - FixIt Now</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #FFFDF8;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .ticket {
      background: #FFFFFF;
      border: 3px solid #111111;
      width: 100%;
      max-width: 440px;
      box-shadow: 6px 6px 0px #111111;
      padding: 28px 24px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #111111;
      padding-bottom: 12px;
      margin-bottom: 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .badge {
      display: inline-block;
      background: #00AA55;
      color: #FFFFFF;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid #111111;
    }
    .status-title {
      font-size: 26px;
      font-weight: 900;
      color: #111111;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }
    .plan-box {
      background: #FFFDF8;
      border: 2px solid #111111;
      padding: 16px;
      margin: 20px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .plan-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 13px;
    }
    .plan-row.total {
      border-top: 2px dashed #111111;
      margin-top: 8px;
      padding-top: 10px;
      font-weight: 800;
      font-size: 16px;
    }
    .note {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: #555555;
      line-height: 1.5;
      text-align: center;
      padding-top: 12px;
      border-top: 1px solid #E5E5E5;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <span>FixIt Now · Partner Pay</span>
      <span class="badge">● VERIFIED</span>
    </div>

    <h1 class="status-title">Payment confirmed</h1>

    <div class="plan-box">
      <div class="plan-row">
        <span>SUBSCRIPTION PLAN</span>
        <strong>${scanResult.planName}</strong>
      </div>
      <div class="plan-row total">
        <span>AMOUNT LOCKED</span>
        <strong style="color: #FF5500;">₹${scanResult.amount.toFixed(2)}</strong>
      </div>
    </div>

    <p class="note">
      Your partner terminal has detected this scan and is activating your dispatch pass. You may close this tab now.
    </p>
  </div>
</body>
</html>
      `);
    }

    // Failure reasons: 'used', 'expired', 'invalid'
    let messageText = 'Invalid QR';
    let subtitleText = 'This QR link does not match any known payment request.';

    if (scanResult.reason === 'used') {
      messageText = 'This QR was already used';
      subtitleText = 'This payment attempt has already been processed or cancelled.';
    } else if (scanResult.reason === 'expired') {
      messageText = 'This QR has expired';
      subtitleText = 'This payment QR exceeded its 5-minute validity window. Please generate a new QR on your screen.';
    }

    return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${messageText} - FixIt Now</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #FFFDF8;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .ticket {
      background: #FFFFFF;
      border: 3px solid #111111;
      width: 100%;
      max-width: 440px;
      box-shadow: 6px 6px 0px #111111;
      padding: 28px 24px;
      text-align: center;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #111111;
      padding-bottom: 12px;
      margin-bottom: 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .badge {
      display: inline-block;
      background: #FF5500;
      color: #FFFFFF;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid #111111;
    }
    .status-title {
      font-size: 24px;
      font-weight: 900;
      color: #111111;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }
    .description {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #444444;
      line-height: 1.6;
      margin-bottom: 20px;
      padding: 12px;
      background: #FFFDF8;
      border: 1px solid #111111;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <span>FixIt Now · Partner Pay</span>
      <span class="badge">NOTICE</span>
    </div>

    <h1 class="status-title">${messageText}</h1>
    <p class="description">${subtitleText}</p>
  </div>
</body>
</html>
    `);
  } catch (err) {
    // Under no circumstances should this endpoint return a 500 error page
    console.error('[Pay Page Exception]:', err);
    return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid QR - FixIt Now</title>
  <style>
    body { font-family: monospace; background: #FFFDF8; color: #111111; padding: 24px; text-align: center; }
    .card { border: 3px solid #111111; max-width: 400px; margin: 40px auto; padding: 24px; box-shadow: 6px 6px 0 #111111; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Invalid QR</h2>
    <p>Please check your partner terminal or generate a new QR code.</p>
  </div>
</body>
</html>
    `);
  }
}

/**
 * Work Order Payment Processing (SRS FR-C18)
 * States: 'proceed' -> 'waiting' -> 'successful'
 */
export async function processPayment(req, res, next) {
  try {
    const requestId = req.params.id || req.body.request_id;
    const { payment_method = 'Direct UPI / Cash (On-site)', state = 'successful' } = req.body;

    if (!requestId) {
      return res.status(400).json({ status: 'error', message: 'Request ID is required.' });
    }

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
    const orderNumber = `ORD-${String(currentReq.id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
    const amount = parseFloat(req.body.amount || currentReq.base_price_estimate) || 450.0;
    const methodStr =
      payment_method === 'cash' || String(payment_method).toLowerCase().includes('cash')
        ? 'Direct Cash (On-site)'
        : payment_method === 'upi' || String(payment_method).toLowerCase().includes('upi')
        ? 'Direct UPI (On-site)'
        : payment_method;

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

    const receiptNo = `REC-${String(currentReq.id).replace(/-/g, '').slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

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

    await query(
      `UPDATE requests
       SET status = 'payment_completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    await query(
      `INSERT INTO request_status_logs (request_id, status) VALUES ($1, 'payment_completed')`,
      [requestId]
    );

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

    notifyRequestStatusUpdate(requestId, 'payment_completed', 6, {
      customerId: currentReq.customer_id,
      partnerId: currentReq.partner_id,
      service_name: currentReq.service_name,
      customer_name: currentReq.customer_name,
      status: 'payment_completed',
      receipt_no: paymentRecord.receipt_no,
    });

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
 * Get Work Order Receipt (SRS FR-C18)
 */
export async function getPaymentReceipt(req, res, next) {
  try {
    const requestId = req.params.id;

    const result = await query(
      `SELECT p.id AS payment_id, p.amount, p.status AS payment_status, p.receipt_no,
              p.payment_method, p.created_at AS payment_date,
              r.id AS request_id, r.customer_id, r.partner_id, r.problem, r.description, r.address, r.status AS request_status,
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

    const user = req.user;
    if (user && user.role !== 'admin') {
      if (user.role === 'customer' && row.customer_id !== user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to view this work order receipt.' });
      }
      if (user.role === 'partner' && row.partner_id !== user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to view this work order receipt.' });
      }
    }

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
  payRateLimiter,
  createPaymentAttemptHandler,
  getActivePaymentAttemptHandler,
  getPaymentAttemptByIdHandler,
  renderPayPage,
};
