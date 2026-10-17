/**
 * FixIt Now - Admin Controller
 * Conforms to docs/SRS.md Section 3.4 (FR-A1 through FR-A7), Section 2.4, Section 5 (Auditability), Section 6, and BR-2.
 *
 * Requirements:
 * - Read-only monitoring of customers, partners, requests, subscriptions, ratings, and activity log (FR-A2).
 * - Admin CANNOT edit or delete any customer or partner data. Enforced on server (FR-A3, Section 2.4).
 * - KYC review: view submitted documents, approve or reject with mandatory reason (FR-A4, FR-P5).
 * - Log every decision and administrative action in activity_logs (FR-A2, Section 5).
 * - Plan price management: applies only to new subscriptions, existing subscriptions keep price paid (FR-A5, BR-2).
 * - Service category management: add, rename, update description/base price, and deactivate/activate (FR-A6).
 */

import { query } from '../config/db.js';

/**
 * Helper to log admin actions into PostgreSQL activity_logs
 * @param {string} actor - e.g. admin's email or 'admin'
 * @param {string} action - e.g. 'KYC_APPROVED', 'PLAN_PRICE_UPDATED'
 * @param {object|string} details - JSON details of the event
 */
export async function logActivity(actor, action, details) {
  try {
    const detailsJson = typeof details === 'string' ? JSON.stringify({ message: details }) : JSON.stringify(details || {});
    await query(
      `INSERT INTO activity_logs (actor, action, details, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [actor || 'admin@fixitnow.com', action, detailsJson]
    );
  } catch (err) {
    console.error('[Admin Controller] Failed to log activity:', err.message);
  }
}

/**
 * 1. Admin Dashboard Overview (FR-A2, FR-A7)
 * Returns summary counts and placeholder metrics for Phase 5.
 */
export async function getAdminDashboard(req, res, next) {
  try {
    // Parallel aggregate queries
    const [
      customersRes,
      partnersRes,
      onlinePartnersRes,
      pendingKycRes,
      requestsRes,
      activeRequestsRes,
      revenueRes,
      activeSubsRes,
      recentActivityRes,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM customers'),
      query('SELECT COUNT(*)::int AS count FROM partners'),
      query('SELECT COUNT(*)::int AS count FROM partners WHERE online = true'),
      query("SELECT COUNT(*)::int AS count FROM partners WHERE kyc_status = 'pending'"),
      query('SELECT COUNT(*)::int AS count FROM requests'),
      query("SELECT COUNT(*)::int AS count FROM requests WHERE status IN ('requested', 'accepted', 'partner_on_way', 'partner_arrived', 'service_started')"),
      query("SELECT COALESCE(SUM(price_paid), 0) AS total_revenue FROM subscriptions WHERE status = 'active'"),
      query("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active'"),
      query('SELECT id, actor, action, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 6'),
    ]);

    const stats = {
      total_customers: customersRes.rows[0]?.count || 0,
      total_partners: partnersRes.rows[0]?.count || 0,
      online_partners_count: onlinePartnersRes.rows[0]?.count || 0,
      pending_kyc_count: pendingKycRes.rows[0]?.count || 0,
      total_requests: requestsRes.rows[0]?.count || 0,
      active_jobs_count: activeRequestsRes.rows[0]?.count || 0,
      total_subscription_revenue: parseFloat(revenueRes.rows[0]?.total_revenue || 0),
      active_subscriptions_count: activeSubsRes.rows[0]?.count || 0,
      system_status: 'OPERATIONAL',
      dispatch_radar: 'ACTIVE',
    };

    return res.status(200).json({
      status: 'success',
      data: {
        stats,
        recent_activity: recentActivityRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Get Read-Only Customers List (FR-A2)
 * Strictly read-only listing of registered customers.
 */
export async function getAdminCustomers(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, email, phone, address, latitude, longitude, photo_url, created_at, updated_at
       FROM customers
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Get Read-Only Partners List (FR-A2)
 * Strictly read-only listing of partners with service, rating, kyc_status, online state.
 */
export async function getAdminPartners(req, res, next) {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.email, p.phone, p.address, p.service_id, p.online,
              p.latitude, p.longitude, p.kyc_status, p.rejection_reason, p.rating,
              p.total_jobs, p.photo_url, p.badge, p.vehicle, p.created_at, p.updated_at,
              s.name AS service_name
       FROM partners p
       LEFT JOIN services s ON p.service_id = s.id
       ORDER BY p.created_at DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Strictly Forbidden Partner / Customer Modification or Deletion (FR-A3, Section 2.4)
 * Enforces server-level rejection of any attempt by admin to alter customer or partner records.
 */
export function rejectCustomerPartnerMutation(req, res) {
  return res.status(403).json({
    status: 'error',
    message: 'Forbidden: Admin is strictly prohibited from modifying or deleting customer or partner records (SRS FR-A3, Section 2.4).',
  });
}

/**
 * 5. Get Read-Only Service Requests (FR-A2)
 */
export async function getAdminRequests(req, res, next) {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT r.id, r.customer_id, r.partner_id, r.service_id, r.problem, r.description,
             r.address, r.latitude, r.longitude, r.photo_url, r.status, r.cancel_reason,
             r.service_otp, r.created_at, r.updated_at,
             c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
             p.name AS partner_name, p.email AS partner_email, p.phone AS partner_phone,
             s.name AS service_name,
             pay.amount AS payment_amount, pay.status AS payment_status, pay.receipt_no
      FROM requests r
      JOIN customers c ON r.customer_id = c.id
      LEFT JOIN partners p ON r.partner_id = p.id
      JOIN services s ON r.service_id = s.id
      LEFT JOIN payments pay ON r.id = pay.request_id
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      queryText += ` WHERE r.status = $1`;
    }

    queryText += ` ORDER BY r.created_at DESC`;

    const result = await query(queryText, params);

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Get Read-Only Subscriptions (FR-A2)
 */
export async function getAdminSubscriptions(req, res, next) {
  try {
    const result = await query(
      `SELECT sub.id, sub.partner_id, sub.plan_id, sub.price_paid, sub.start_date, sub.end_date,
              sub.status, sub.created_at,
              p.name AS partner_name, p.email AS partner_email, p.phone AS partner_phone,
              s.name AS service_name,
              pl.name AS plan_name, pl.duration_months, pl.price AS current_plan_price
       FROM subscriptions sub
       JOIN partners p ON sub.partner_id = p.id
       JOIN plans pl ON sub.plan_id = pl.id
       LEFT JOIN services s ON p.service_id = s.id
       ORDER BY sub.created_at DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows.map((row) => ({
        ...row,
        price_paid: parseFloat(row.price_paid),
        current_plan_price: parseFloat(row.current_plan_price),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. Get Read-Only Ratings and Reviews (FR-A2)
 */
export async function getAdminRatings(req, res, next) {
  try {
    const result = await query(
      `SELECT rat.id, rat.stars, rat.comment, rat.created_at,
              p.id AS partner_id, p.name AS partner_name, p.rating AS partner_avg_rating,
              c.id AS customer_id, c.name AS customer_name,
              req.id AS request_id, req.problem,
              s.name AS service_name
       FROM ratings rat
       JOIN partners p ON rat.partner_id = p.id
       JOIN requests req ON rat.request_id = req.id
       JOIN customers c ON req.customer_id = c.id
       JOIN services s ON req.service_id = s.id
       ORDER BY rat.created_at DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. Get Activity Audit Log (FR-A2, Section 5 Auditability)
 */
export async function getAdminActivityLog(req, res, next) {
  try {
    const result = await query(
      `SELECT id, actor, action, details, created_at
       FROM activity_logs
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. Plans and Prices Management (FR-A5, BR-2)
 * Admin can view all plans and change plan prices.
 * Strict BR-2: A price change applies ONLY to new subscriptions; existing subscriptions keep price_paid!
 */
export async function getAdminPlans(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, duration_months, price, active, updated_at
       FROM plans
       ORDER BY duration_months ASC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows.map((p) => ({
        ...p,
        price: parseFloat(p.price),
        monthly_equivalent: Math.round(parseFloat(p.price) / p.duration_months),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePlanPrice(req, res, next) {
  try {
    const { id } = req.params;
    const { price } = req.body;

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid plan price greater than zero is required (SRS FR-A5).',
      });
    }

    const checkRes = await query('SELECT id, name, price FROM plans WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Subscription plan not found.' });
    }

    const currentPlan = checkRes.rows[0];
    const oldPrice = parseFloat(currentPlan.price);

    // Update the plan price (BR-2: Does NOT alter existing subscriptions table records)
    const updateRes = await query(
      `UPDATE plans
       SET price = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, duration_months, price, active, updated_at`,
      [parsedPrice, id]
    );

    const updatedPlan = updateRes.rows[0];

    // Log the price change to activity_logs
    await logActivity(
      req.user?.email || 'admin@fixitnow.com',
      'PLAN_PRICE_UPDATED',
      {
        plan_id: updatedPlan.id,
        plan_name: updatedPlan.name,
        old_price: oldPrice,
        new_price: parsedPrice,
        note: 'BR-2 enforced: applies strictly to new subscriptions. Existing subscriptions keep price_paid.',
      }
    );

    return res.status(200).json({
      status: 'success',
      message: `Plan "${updatedPlan.name}" price updated to ₹${parsedPrice}. Rule BR-2 enforced.`,
      data: {
        ...updatedPlan,
        price: parseFloat(updatedPlan.price),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. Service Categories Management (FR-A6)
 * Admin can list, add, rename, update description/price estimate, and deactivate/activate services.
 */
export async function getAdminServices(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, slug, description, base_price_estimate, active, created_at, updated_at
       FROM services
       ORDER BY id ASC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows.map((s) => ({
        ...s,
        base_price_estimate: parseFloat(s.base_price_estimate || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createServiceCategory(req, res, next) {
  try {
    const { name, description, base_price_estimate } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Category name and description are required (SRS FR-A6).',
      });
    }

    const cleanName = name.trim();
    const cleanDesc = description.trim();
    const parsedBase = base_price_estimate !== undefined ? parseFloat(base_price_estimate) : 350;

    if (isNaN(parsedBase) || parsedBase < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Base price estimate must be a non-negative number.',
      });
    }

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Check slug / name uniqueness
    const exists = await query('SELECT id FROM services WHERE LOWER(name) = LOWER($1) OR slug = $2', [
      cleanName,
      slug,
    ]);
    if (exists.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Service category "${cleanName}" or slug "${slug}" already exists.`,
      });
    }

    const insertRes = await query(
      `INSERT INTO services (name, slug, description, base_price_estimate, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, slug, description, base_price_estimate, active, created_at`,
      [cleanName, slug, cleanDesc, parsedBase]
    );

    const created = insertRes.rows[0];

    await logActivity(req.user?.email || 'admin@fixitnow.com', 'SERVICE_CREATED', {
      service_id: created.id,
      name: created.name,
      base_price_estimate: parsedBase,
    });

    return res.status(201).json({
      status: 'success',
      message: `Service category "${created.name}" created successfully.`,
      data: {
        ...created,
        base_price_estimate: parseFloat(created.base_price_estimate),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateServiceCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, base_price_estimate, active } = req.body;

    const checkRes = await query('SELECT id, name, description, base_price_estimate, active FROM services WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Service category not found.' });
    }

    const current = checkRes.rows[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newDesc = description !== undefined ? description.trim() : current.description;
    const newBase = base_price_estimate !== undefined ? parseFloat(base_price_estimate) : parseFloat(current.base_price_estimate);
    const newActive = active !== undefined ? Boolean(active) : current.active;

    if (!newName) {
      return res.status(400).json({ status: 'error', message: 'Category name cannot be empty.' });
    }
    if (isNaN(newBase) || newBase < 0) {
      return res.status(400).json({ status: 'error', message: 'Base price estimate must be a non-negative number.' });
    }

    const updateRes = await query(
      `UPDATE services
       SET name = $1, description = $2, base_price_estimate = $3, active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, slug, description, base_price_estimate, active, updated_at`,
      [newName, newDesc, newBase, newActive, id]
    );

    const updated = updateRes.rows[0];

    const action = current.active !== newActive
      ? (newActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED')
      : 'SERVICE_UPDATED';

    await logActivity(req.user?.email || 'admin@fixitnow.com', action, {
      service_id: updated.id,
      name: updated.name,
      active: updated.active,
      base_price_estimate: newBase,
    });

    return res.status(200).json({
      status: 'success',
      message: `Service category "${updated.name}" updated successfully.`,
      data: {
        ...updated,
        base_price_estimate: parseFloat(updated.base_price_estimate),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleServiceActive(req, res, next) {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT id, name, active FROM services WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Service category not found.' });
    }

    const current = checkRes.rows[0];
    const newActive = !current.active;

    const updateRes = await query(
      `UPDATE services
       SET active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, slug, description, base_price_estimate, active, updated_at`,
      [newActive, id]
    );

    const updated = updateRes.rows[0];

    await logActivity(req.user?.email || 'admin@fixitnow.com', newActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED', {
      service_id: updated.id,
      name: updated.name,
      active: newActive,
    });

    return res.status(200).json({
      status: 'success',
      message: `Service "${updated.name}" is now ${newActive ? 'ACTIVE' : 'DEACTIVATED'}.`,
      data: {
        ...updated,
        base_price_estimate: parseFloat(updated.base_price_estimate),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 11. KYC Decision with Mandatory Audit Logging (FR-A4, FR-P5, Section 5)
 */
export async function adminReviewKycDecision(req, res, next) {
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

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId);
    if (!isUuid) {
      return res.status(404).json({ status: 'error', message: 'Partner not found.' });
    }

    const check = await query('SELECT id, name, email FROM partners WHERE id = $1', [partnerId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Partner not found.' });
    }

    const partner = check.rows[0];
    const cleanReason = decision === 'rejected' ? rejection_reason.trim() : null;

    // Update partner status in PostgreSQL
    await query(
      `UPDATE partners
       SET kyc_status = $1,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [decision, cleanReason, partnerId]
    );

    // Update kyc_documents records
    await query(
      `UPDATE kyc_documents
       SET status = $1,
           reviewer_notes = $2,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE partner_id = $3`,
      [decision, reviewer_notes?.trim() || cleanReason, partnerId]
    );

    // Audit in activity_logs (Mandatory per Phase 5 prompt)
    const action = decision === 'verified' ? 'KYC_APPROVED' : 'KYC_REJECTED';
    await logActivity(req.user?.email || 'admin@fixitnow.com', action, {
      partner_id: partner.id,
      partner_name: partner.name,
      partner_email: partner.email,
      decision,
      rejection_reason: cleanReason,
      reviewer_notes: reviewer_notes?.trim() || null,
    });

    return res.status(200).json({
      status: 'success',
      message: `Partner KYC has been ${decision === 'verified' ? 'verified & approved' : 'rejected with reason'}.`,
      data: {
        partner_id: partnerId,
        partner_name: partner.name,
        kyc_status: decision,
        rejection_reason: cleanReason,
      },
    });
  } catch (err) {
    next(err);
  }
}
