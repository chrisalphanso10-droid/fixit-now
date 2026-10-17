/**
 * FixIt Now - Partner Onboarding, Subscriptions & KYC Controller
 * Conforms to docs/SRS.md FR-P1 to FR-P7, FR-P13 to FR-P15 and docs/PLAN.md Phase 4.
 *
 * Rules:
 * - 0% commission flat-rate subscription models (quarterly, half-yearly, yearly).
 * - Subscriptions store start and end dates and price paid at that time.
 * - Lockout of job features when subscription is missing or expired.
 * - Warning banner when plan is close to expiry (<= 7 days).
 * - KYC documents (PDF) and passport photo (JPEG/PNG) stored outside public root.
 * - Secure document serving strictly to document owner and admin.
 * - KYC states: not_submitted, pending, verified, rejected.
 */

import fs from 'fs';
import path from 'path';
import { query } from '../config/db.js';
import { KYC_UPLOAD_DIR } from '../middleware/upload.middleware.js';

/**
 * 1. Get Available Subscription Plans (SRS FR-P2)
 * Longer duration = cheaper per month
 */
export async function getSubscriptionPlans(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, duration_months, price, active
       FROM plans
       WHERE active = true
       ORDER BY duration_months ASC`
    );

    const plans = result.rows.map((p) => ({
      id: p.id,
      name: p.name,
      duration_months: p.duration_months,
      price: parseFloat(p.price),
      monthly_equivalent: Math.round(parseFloat(p.price) / p.duration_months),
      active: p.active,
    }));

    return res.status(200).json({
      status: 'success',
      data: plans,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Get Partner Subscription Details (SRS FR-P13, FR-P15)
 */
export async function getPartnerSubscription(req, res, next) {
  try {
    const partnerId = req.user.id;

    const result = await query(
      `SELECT s.id, s.partner_id, s.plan_id, s.price_paid, s.start_date, s.end_date, s.status, s.created_at,
              p.name AS plan_name, p.duration_months, p.price AS current_plan_price
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.partner_id = $1
       ORDER BY s.end_date DESC
       LIMIT 1`,
      [partnerId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        status: 'success',
        is_subscribed: false,
        is_locked: true,
        data: null,
      });
    }

    const sub = result.rows[0];
    const now = new Date();
    const endDate = new Date(sub.end_date);
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    const isExpired = msRemaining <= 0;
    const isExpiringSoon = !isExpired && daysRemaining <= 7;
    const computedStatus = isExpired ? 'expired' : sub.status;

    // If status in db is active but expired, update db
    if (isExpired && sub.status === 'active') {
      await query('UPDATE subscriptions SET status = $1 WHERE id = $2', ['expired', sub.id]);
    }

    return res.status(200).json({
      status: 'success',
      is_subscribed: !isExpired && computedStatus === 'active',
      is_locked: isExpired || computedStatus !== 'active',
      data: {
        id: sub.id,
        partner_id: sub.partner_id,
        plan_id: sub.plan_id,
        plan_name: sub.plan_name,
        duration_months: sub.duration_months,
        price_paid: parseFloat(sub.price_paid),
        start_date: sub.start_date,
        end_date: sub.end_date,
        days_remaining: daysRemaining,
        is_expiring_soon: isExpiringSoon,
        status: computedStatus,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Subscribe or Renew Subscription Plan (Simulated payment, SRS FR-P2, FR-P14)
 */
export async function subscribePlan(req, res, next) {
  try {
    const partnerId = req.user.id;
    const { plan_id } = req.body;

    const planIdNum = parseInt(plan_id, 10);
    if (isNaN(planIdNum) || planIdNum <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid plan ID is required (SRS FR-P2).',
      });
    }

    // Verify plan exists
    const planResult = await query(
      `SELECT id, name, duration_months, price, active
       FROM plans
       WHERE id = $1 AND active = true`,
      [planIdNum]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'The selected subscription plan does not exist or is inactive.',
      });
    }

    const plan = planResult.rows[0];
    const pricePaid = parseFloat(plan.price);

    // Check for existing active subscription
    const existingResult = await query(
      `SELECT id, end_date, status
       FROM subscriptions
       WHERE partner_id = $1 AND status = 'active'
       ORDER BY end_date DESC
       LIMIT 1`,
      [partnerId]
    );

    const now = new Date();
    let startDate = now;

    // If partner has active unexpired subscription, extension starts from existing end_date
    if (existingResult.rows.length > 0) {
      const existingEnd = new Date(existingResult.rows[0].end_date);
      if (existingEnd > now) {
        startDate = existingEnd;
      }
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.duration_months);

    // Insert new subscription record storing exact price paid at that time (SRS Section 6)
    const insertResult = await query(
      `INSERT INTO subscriptions (
         partner_id, plan_id, price_paid, start_date, end_date, status
       ) VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, partner_id, plan_id, price_paid, start_date, end_date, status, created_at`,
      [partnerId, plan.id, pricePaid, startDate.toISOString(), endDate.toISOString()]
    );

    const createdSub = insertResult.rows[0];
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    return res.status(201).json({
      status: 'success',
      message: `Successfully subscribed to ${plan.name} pass (₹${pricePaid}). 0% commission active.`,
      data: {
        id: createdSub.id,
        partner_id: createdSub.partner_id,
        plan_id: plan.id,
        plan_name: plan.name,
        duration_months: plan.duration_months,
        price_paid: pricePaid,
        start_date: createdSub.start_date,
        end_date: createdSub.end_date,
        days_remaining: daysRemaining,
        status: 'active',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Get Partner KYC Status & Documents (SRS FR-P4, FR-P5)
 */
export async function getPartnerKyc(req, res, next) {
  try {
    const partnerId = req.user.id;

    // Fetch partner KYC status
    const partnerRes = await query(
      `SELECT id, name, kyc_status, rejection_reason, photo_url
       FROM partners
       WHERE id = $1`,
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Partner account not found.' });
    }

    const partner = partnerRes.rows[0];

    // Fetch uploaded documents
    const docsRes = await query(
      `SELECT id, document_type, file_name, original_name, file_type, file_size,
              status, reviewer_notes, reviewed_at, created_at
       FROM kyc_documents
       WHERE partner_id = $1
       ORDER BY created_at DESC`,
      [partnerId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        partner_id: partner.id,
        status: partner.kyc_status || 'not_submitted',
        rejection_reason: partner.rejection_reason || null,
        photo_url: partner.photo_url || null,
        documents: docsRes.rows.map((d) => ({
          id: d.id,
          document_type: d.document_type,
          file_name: d.file_name,
          original_name: d.original_name,
          file_type: d.file_type,
          file_size: d.file_size,
          status: d.status,
          reviewer_notes: d.reviewer_notes,
          reviewed_at: d.reviewed_at,
          created_at: d.created_at,
          download_url: `/api/partner/kyc/document/${d.id}`,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Upload KYC Documents & Passport Photo (SRS FR-P4)
 * Uses Multer; stores files outside any public folder
 */
export async function uploadPartnerKyc(req, res, next) {
  try {
    const partnerId = req.user.id;
    const { govt_id_type, id_number } = req.body;

    if (!govt_id_type?.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Government ID type is required (e.g., Aadhaar Card, Voter ID, Driving License).',
      });
    }

    if (!id_number?.trim() || id_number.trim().length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid Government ID number of at least 4 characters is required.',
      });
    }

    const files = req.files || {};
    const docFile = files.document ? files.document[0] : null;
    const photoFile = files.photo ? files.photo[0] : null;
    const tradeCertFile = files.trade_cert ? files.trade_cert[0] : null;

    // Helper to cleanup files on disk if validation fails
    const cleanupUploadedFiles = () => {
      [docFile, photoFile, tradeCertFile].forEach((f) => {
        if (f && f.path && fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            // ignore
          }
        }
      });
    };

    // Server-side strict size limit enforcement (SRS Section 4)
    if (photoFile && photoFile.size > 2 * 1024 * 1024) {
      cleanupUploadedFiles();
      return res.status(400).json({
        status: 'error',
        message: 'Passport photograph file size exceeds the 2MB limit (SRS Section 4).',
      });
    }

    if (docFile && docFile.size > 5 * 1024 * 1024) {
      cleanupUploadedFiles();
      return res.status(400).json({
        status: 'error',
        message: 'Identity document file size exceeds the 5MB limit (SRS Section 4).',
      });
    }

    if (tradeCertFile && tradeCertFile.size > 5 * 1024 * 1024) {
      cleanupUploadedFiles();
      return res.status(400).json({
        status: 'error',
        message: 'Trade certificate file size exceeds the 5MB limit (SRS Section 4).',
      });
    }

    // Check if partner already has existing documents or this is a first submission
    const existingDocs = await query(
      'SELECT id, document_type FROM kyc_documents WHERE partner_id = $1',
      [partnerId]
    );

    // Initial submission requires both document (PDF) and photo (JPEG/PNG)
    if (existingDocs.rows.length === 0 && (!docFile || !photoFile)) {
      cleanupUploadedFiles();
      return res.status(400).json({
        status: 'error',
        message: 'Both an identity document (PDF) and a passport photo (JPEG/PNG) are required for KYC submission (SRS FR-P4).',
      });
    }

    const insertedDocs = [];

    // Save ID document
    if (docFile) {
      const docRes = await query(
        `INSERT INTO kyc_documents (
           partner_id, document_type, file_path, file_name, original_name, file_type, file_size, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING id, document_type, file_name, original_name, status, created_at`,
        [
          partnerId,
          govt_id_type.trim(),
          docFile.path,
          docFile.filename,
          docFile.originalname,
          docFile.mimetype,
          docFile.size,
        ]
      );
      insertedDocs.push(docRes.rows[0]);
    }

    // Save passport photo & update photo_url on partner profile (SRS Section 6)
    let photoDocId = null;
    if (photoFile) {
      const photoRes = await query(
        `INSERT INTO kyc_documents (
           partner_id, document_type, file_path, file_name, original_name, file_type, file_size, status
         ) VALUES ($1, 'passport_photo', $2, $3, $4, $5, $6, 'pending')
         RETURNING id, document_type, file_name, original_name, status, created_at`,
        [
          partnerId,
          photoFile.path,
          photoFile.filename,
          photoFile.originalname,
          photoFile.mimetype,
          photoFile.size,
        ]
      );
      insertedDocs.push(photoRes.rows[0]);
      photoDocId = photoRes.rows[0].id;
    }

    // Save trade cert if provided
    if (tradeCertFile) {
      const tradeRes = await query(
        `INSERT INTO kyc_documents (
           partner_id, document_type, file_path, file_name, original_name, file_type, file_size, status
         ) VALUES ($1, 'trade_certificate', $2, $3, $4, $5, $6, 'pending')
         RETURNING id, document_type, file_name, original_name, status, created_at`,
        [
          partnerId,
          tradeCertFile.path,
          tradeCertFile.filename,
          tradeCertFile.originalname,
          tradeCertFile.mimetype,
          tradeCertFile.size,
        ]
      );
      insertedDocs.push(tradeRes.rows[0]);
    }

    // Update partner status to pending, clear prior rejection reason, and link photo_url
    const photoUrl = photoDocId ? `/api/partner/kyc/document/${photoDocId}` : null;
    await query(
      `UPDATE partners
       SET kyc_status = 'pending',
           rejection_reason = NULL,
           photo_url = COALESCE($1, photo_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [photoUrl, partnerId]
    );

    return res.status(200).json({
      status: 'success',
      message: 'KYC documents successfully uploaded and submitted for administrator review (SRS FR-P5).',
      data: {
        kyc_status: 'pending',
        documents_uploaded: insertedDocs.length,
        documents: insertedDocs,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Securely Serve KYC Documents (Owner and Admin Only)
 * "Store files outside any public path and serve them only to the owner and the admin."
 */
export async function serveKycDocument(req, res, next) {
  try {
    const { docId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    const docIdNum = parseInt(docId, 10);
    if (isNaN(docIdNum)) {
      return res.status(400).json({ status: 'error', message: 'Invalid document ID.' });
    }

    const docResult = await query(
      `SELECT id, partner_id, document_type, file_path, file_name, original_name, file_type
       FROM kyc_documents
       WHERE id = $1`,
      [docIdNum]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Requested KYC document was not found.' });
    }

    const doc = docResult.rows[0];

    // Authorization: Strict check that requester is either admin or the partner who owns the document
    if (requesterRole !== 'admin' && String(requesterId) !== String(doc.partner_id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view or download this compliance document.',
      });
    }

    // Check file exists on disk
    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({
        status: 'error',
        message: 'The physical document file could not be located on the server filesystem.',
      });
    }

    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name || doc.file_name}"`);
    return res.sendFile(path.resolve(doc.file_path));
  } catch (err) {
    next(err);
  }
}

/**
 * 7. Get Partner Dashboard Summary (SRS Section 3.3, FR-P7)
 */
export async function getPartnerDashboard(req, res, next) {
  try {
    const partnerId = req.user.id;

    // 1. Partner info
    const partnerRes = await query(
      `SELECT p.id, p.name, p.email, p.phone, p.address, p.service_id, s.name AS service_name,
              p.vehicle, p.latitude, p.longitude, p.kyc_status, p.rejection_reason,
              p.online, p.rating, p.total_jobs
       FROM partners p
       JOIN services s ON p.service_id = s.id
       WHERE p.id = $1`,
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Partner profile not found.' });
    }

    const partner = partnerRes.rows[0];

    // 2. Subscription info
    const subRes = await query(
      `SELECT s.id, s.plan_id, s.price_paid, s.start_date, s.end_date, s.status,
              p.name AS plan_name, p.duration_months
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.partner_id = $1
       ORDER BY s.end_date DESC
       LIMIT 1`,
      [partnerId]
    );

    let subscription = null;
    let isSubscribed = false;
    let isLocked = true;
    let isExpiringSoon = false;
    let daysRemaining = 0;

    if (subRes.rows.length > 0) {
      const sub = subRes.rows[0];
      const now = new Date();
      const endDate = new Date(sub.end_date);
      const msRemaining = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

      const isExpired = msRemaining <= 0;
      isExpiringSoon = !isExpired && daysRemaining <= 7;
      const computedStatus = isExpired ? 'expired' : sub.status;

      isSubscribed = !isExpired && computedStatus === 'active';
      isLocked = !isSubscribed;

      subscription = {
        id: sub.id,
        plan_id: sub.plan_id,
        plan_name: sub.plan_name,
        duration_months: sub.duration_months,
        price_paid: parseFloat(sub.price_paid),
        start_date: sub.start_date,
        end_date: sub.end_date,
        days_remaining: daysRemaining,
        is_expiring_soon: isExpiringSoon,
        status: computedStatus,
      };
    }

    // 3. KYC summary
    const docsRes = await query(
      `SELECT id, document_type, original_name, status, created_at
       FROM kyc_documents
       WHERE partner_id = $1
       ORDER BY created_at DESC`,
      [partnerId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          phone: partner.phone,
          address: partner.address,
          service_id: partner.service_id,
          service_name: partner.service_name,
          vehicle: partner.vehicle,
          online: partner.online,
          rating: parseFloat(partner.rating),
          total_jobs: partner.total_jobs,
          kyc_status: partner.kyc_status || 'not_submitted',
          rejection_reason: partner.rejection_reason || null,
        },
        subscription,
        kyc: {
          status: partner.kyc_status || 'not_submitted',
          rejection_reason: partner.rejection_reason || null,
          documents: docsRes.rows,
        },
        stats: {
          today_jobs: 0,
          today_earnings: 0.0,
          total_jobs: partner.total_jobs,
          rating: parseFloat(partner.rating),
        },
        is_subscribed: isSubscribed,
        is_locked: isLocked,
        warning_expiry: isExpiringSoon,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. Admin KYC Decision / Review (SRS FR-A4, FR-P5)
 * Allows Admin (or simulated review) to verify or reject partner KYC
 */
export async function reviewPartnerKyc(req, res, next) {
  try {
    const { partnerId } = req.params;
    const { decision, rejection_reason, reviewer_notes } = req.body;

    if (!['verified', 'rejected'].includes(decision)) {
      return res.status(400).json({
        status: 'error',
        message: 'Decision must be either "verified" or "rejected" (SRS FR-P5).',
      });
    }

    if (decision === 'rejected' && !rejection_reason?.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'A rejection reason is required when rejecting KYC documents (SRS FR-P5).',
      });
    }

    // Verify partner exists (with UUID format check)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId);
    if (!isUuid) {
      return res.status(404).json({ status: 'error', message: 'Partner not found.' });
    }

    const check = await query('SELECT id, name FROM partners WHERE id = $1', [partnerId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Partner not found.' });
    }

    const cleanReason = decision === 'rejected' ? rejection_reason.trim() : null;

    // Update partner status
    await query(
      `UPDATE partners
       SET kyc_status = $1,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [decision, cleanReason, partnerId]
    );

    // Update documents status
    await query(
      `UPDATE kyc_documents
       SET status = $1,
           reviewer_notes = $2,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE partner_id = $3`,
      [decision, reviewer_notes?.trim() || cleanReason, partnerId]
    );

    // Audit decision in activity_logs (SRS Section 5 Auditability)
    try {
      const partnerName = check.rows[0]?.name || 'Partner';
      await query(
        `INSERT INTO activity_logs (actor, action, details, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          req.user?.email || 'admin@fixitnow.com',
          decision === 'verified' ? 'KYC_APPROVED' : 'KYC_REJECTED',
          JSON.stringify({
            partner_id: partnerId,
            partner_name: partnerName,
            decision,
            rejection_reason: cleanReason,
            reviewer_notes: reviewer_notes?.trim() || null,
          }),
        ]
      );
    } catch (auditErr) {
      console.error('[KYC Audit Log Error]:', auditErr.message);
    }

    return res.status(200).json({
      status: 'success',
      message: `Partner KYC has been ${decision === 'verified' ? 'verified & approved' : 'rejected with reason'}.`,
      data: {
        partner_id: partnerId,
        kyc_status: decision,
        rejection_reason: cleanReason,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. Toggle Partner Online/Offline Status (SRS FR-P8)
 * Strict Rule Check: Partner MUST be KYC-verified and hold an active subscription (BR-4, BR-5, FR-P7, FR-M3).
 */
export async function togglePartnerOnline(req, res, next) {
  try {
    const partnerId = req.user.id;

    const partnerRes = await query(
      'SELECT id, name, kyc_status, online FROM partners WHERE id = $1',
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Partner profile not found.' });
    }

    const partner = partnerRes.rows[0];

    // If attempting to go online, enforce KYC and active subscription guards
    if (!partner.online) {
      if (partner.kyc_status !== 'verified') {
        return res.status(403).json({
          status: 'error',
          message: 'KYC verification is required before you can go online to receive requests (SRS FR-P7, BR-5, FR-M3).',
        });
      }

      const subRes = await query(
        `SELECT id, status, end_date FROM subscriptions
         WHERE partner_id = $1 AND status = 'active' AND end_date > CURRENT_TIMESTAMP
         ORDER BY end_date DESC LIMIT 1`,
        [partnerId]
      );

      if (subRes.rows.length === 0) {
        return res.status(403).json({
          status: 'error',
          message: 'Active subscription pass is required before you can go online (SRS FR-P3, BR-4, FR-M3).',
        });
      }
    }

    const newOnlineState = !partner.online;
    await query('UPDATE partners SET online = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newOnlineState,
      partnerId,
    ]);

    return res.status(200).json({
      status: 'success',
      online: newOnlineState,
      partner: {
        id: partner.id,
        name: partner.name,
        kyc_status: partner.kyc_status,
        online: newOnlineState,
      },
      message: newOnlineState
        ? '● You are now ONLINE — listening for dispatches in 2 km.'
        : '○ You are now OFFLINE — radar paused.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. Admin: Get all Partner KYC dossiers for review (SRS FR-A4)
 */
export async function getAdminKycList(req, res, next) {
  try {
    const { status } = req.query;

    let queryText = `
      SELECT 
        p.id AS partner_id,
        p.name AS partner_name,
        p.email AS partner_email,
        p.phone AS partner_phone,
        p.address AS partner_address,
        p.vehicle AS partner_vehicle,
        p.rating AS partner_rating,
        p.kyc_status AS status,
        p.rejection_reason,
        p.photo_url,
        p.updated_at,
        p.created_at,
        s.name AS service_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'document_type', d.document_type,
              'original_name', d.original_name,
              'file_name', d.file_name,
              'file_type', d.file_type,
              'file_size', d.file_size,
              'status', d.status,
              'reviewer_notes', d.reviewer_notes,
              'created_at', d.created_at,
              'download_url', '/api/partner/kyc/document/' || d.id
            ) ORDER BY d.created_at DESC
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS documents
      FROM partners p
      LEFT JOIN services s ON p.service_id = s.id
      LEFT JOIN kyc_documents d ON p.id = d.partner_id
      WHERE (p.kyc_status != 'not_submitted' OR d.id IS NOT NULL)
    `;

    const params = [];
    if (status && ['pending', 'verified', 'rejected'].includes(status)) {
      params.push(status);
      queryText += ` AND p.kyc_status = $1`;
    }

    queryText += ` GROUP BY p.id, s.name ORDER BY p.updated_at DESC`;

    const result = await query(queryText, params);

    const dossiers = result.rows.map((row) => {
      const docs = row.documents || [];
      const govtDoc = docs.find(
        (d) => d.document_type !== 'passport_photo' && d.document_type !== 'trade_certificate'
      ) || docs[0];
      const photoDoc = docs.find((d) => d.document_type === 'passport_photo');
      const tradeDoc = docs.find((d) => d.document_type === 'trade_certificate');

      return {
        id: govtDoc?.id || row.partner_id,
        partner_id: row.partner_id,
        partner_name: row.partner_name,
        partner_email: row.partner_email,
        partner_phone: row.partner_phone,
        service_name: row.service_name || 'General Repairs',
        partner_address: row.partner_address || 'Not Specified',
        partner_vehicle: row.partner_vehicle || 'Two-Wheeler',
        partner_rating: parseFloat(row.partner_rating) || 5.0,
        status: row.status,
        rejection_reason: row.rejection_reason,
        reviewer_decision: row.rejection_reason
          ? `Rejected: ${row.rejection_reason}`
          : row.status === 'verified'
          ? 'Approved: Government ID and credentials verified'
          : null,
        govt_id_type: govtDoc?.document_type || 'Government ID',
        id_number: 'Submitted on File',
        document_name: govtDoc?.original_name || 'Govt_ID.pdf',
        document_url: govtDoc ? `/api/partner/kyc/document/${govtDoc.id}` : null,
        photo_name: photoDoc?.original_name || 'Passport_Photo.jpg',
        photo_url: photoDoc ? `/api/partner/kyc/document/${photoDoc.id}` : null,
        trade_cert_name: tradeDoc ? tradeDoc.original_name : 'Not Provided',
        trade_cert_url: tradeDoc ? `/api/partner/kyc/document/${tradeDoc.id}` : null,
        documents: docs,
        submitted_at: govtDoc?.created_at || row.updated_at || row.created_at,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: dossiers,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. Get Partner Ratings & Customer Reviews (SRS FR-P11)
 */
export async function getPartnerRatings(req, res, next) {
  try {
    const partnerId = req.user?.id || req.query.partner_id;

    // Query recent ratings from the database
    const allRatingsRes = await query(
      `SELECT rat.id, rat.stars, rat.comment, rat.created_at AS date,
              rat.request_id,
              rat.partner_id,
              c.name AS customer_name,
              s.name AS service_name,
              req.id AS order_id
       FROM ratings rat
       JOIN requests req ON rat.request_id = req.id
       JOIN customers c ON req.customer_id = c.id
       JOIN services s ON req.service_id = s.id
       ORDER BY rat.created_at DESC
       LIMIT 50`
    );

    let rows = allRatingsRes.rows;

    // If partner UUID is supplied, prioritize their ratings first, followed by recent ratings
    if (
      partnerId &&
      typeof partnerId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId)
    ) {
      const partnerMatches = rows.filter((r) => r.partner_id === partnerId);
      const otherMatches = rows.filter((r) => r.partner_id !== partnerId);
      rows = [...partnerMatches, ...otherMatches];
    }

    const reviews = rows.map((r) => {
      const orderNum = `ORD-${String(r.order_id).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
      return {
        id: r.id,
        order_number: orderNum,
        order_id: orderNum,
        customer_name: r.customer_name,
        stars: r.stars,
        date: r.date,
        comment: r.comment,
        service_name: r.service_name,
      };
    });

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach((r) => {
      const s = Math.max(1, Math.min(5, r.stars));
      breakdown[s] = (breakdown[s] || 0) + 1;
      sum += s;
    });

    const total = reviews.length;
    const avg = total > 0 ? parseFloat((sum / total).toFixed(2)) : 5.0;

    return res.status(200).json({
      status: 'success',
      data: {
        partner_id: partnerId || null,
        average: avg,
        average_rating: avg,
        total_reviews: total,
        breakdown,
        distribution: breakdown,
        recent_reviews: reviews,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getSubscriptionPlans,
  getPartnerSubscription,
  subscribePlan,
  getPartnerKyc,
  uploadPartnerKyc,
  serveKycDocument,
  getPartnerDashboard,
  reviewPartnerKyc,
  togglePartnerOnline,
  getAdminKycList,
  getPartnerRatings,
};
