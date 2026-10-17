/**
 * FixIt Now - Notification Controller
 * Conforms to docs/SRS.md FR-C20, Section 6 and docs/PLAN.md Phase 8.
 */

import { query } from '../config/db.js';

/**
 * Internal helper to create in-app notification
 */
export async function createNotification({ recipientType, recipientId, title, message }) {
  try {
    const res = await query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, read_flag)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [recipientType, recipientId, title, message]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('[Notification create error]:', err.message);
    return null;
  }
}

/**
 * 1. Get User Notifications (SRS FR-C20)
 * GET /api/notifications
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await query(
      `SELECT id, recipient_type, recipient_id, title, message, read_flag, created_at
       FROM notifications
       WHERE recipient_id = $1 OR (recipient_id IS NULL AND recipient_type = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, userRole]
    );

    const unreadCount = result.rows.filter((n) => !n.read_flag).length;

    return res.status(200).json({
      status: 'success',
      data: {
        notifications: result.rows,
        unread_count: unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Mark Specific Notification as Read
 * PUT /api/notifications/:id/read
 */
export async function markAsRead(req, res, next) {
  try {
    const notifId = req.params.id;
    const userId = req.user.id;

    const result = await query(
      `UPDATE notifications
       SET read_flag = true
       WHERE id = $1 AND (recipient_id = $2 OR recipient_id IS NULL)
       RETURNING *`,
      [notifId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Notification not found.' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Notification marked as read.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Mark All User Notifications as Read
 * PUT /api/notifications/read-all
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    await query(
      `UPDATE notifications
       SET read_flag = true
       WHERE recipient_id = $1 OR (recipient_id IS NULL AND recipient_type = $2)`,
      [userId, userRole]
    );

    return res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
