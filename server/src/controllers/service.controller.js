/**
 * FixIt Now - Services Controller
 * Provides service categories from PostgreSQL.
 * Conforms to docs/SRS.md Section 3.1 & Section 6.
 */

import { query } from '../config/db.js';

/**
 * Get all active service categories
 */
export async function getActiveServices(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, slug, description, active
       FROM services
       WHERE active = true
       ORDER BY id ASC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getActiveServices,
};
