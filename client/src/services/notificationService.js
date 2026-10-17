/**
 * FixIt Now - Notification Service
 * Conforms to docs/SRS.md FR-C20 and docs/PLAN.md Phase 8.
 */

import { get, put } from './api';

export async function getNotifications() {
  try {
    const res = await get('/api/notifications');
    if (res && res.status === 'success' && res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[NotificationService] getNotifications error:', err.message);
  }
  return { notifications: [], unread_count: 0 };
}

export async function markNotificationAsRead(id) {
  try {
    const res = await put(`/api/notifications/${id}/read`);
    return res.data;
  } catch (err) {
    console.warn('[NotificationService] markNotificationAsRead error:', err.message);
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const res = await put('/api/notifications/read-all');
    return res.data;
  } catch (err) {
    console.warn('[NotificationService] markAllNotificationsAsRead error:', err.message);
  }
}

export default {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
