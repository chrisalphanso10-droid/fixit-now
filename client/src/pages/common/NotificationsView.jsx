/**
 * FixIt Now - Notifications View
 * Conforms to SRS FR-C20, docs/DESIGN.md and docs/PLAN.md Phase 8.
 * Supports empty, loading, and error states.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService';

export default function NotificationsView({ userRole = 'customer' }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNotifications();
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);
      setUnreadCount(data?.unread_count ?? list.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('[NotificationsView] Load error:', err);
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkOne = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAll = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner Header */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-signal inline-block" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                ACTIVITY &amp; SYSTEM ALERTS
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Notifications
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto font-mono text-xs">
            {unreadCount > 0 && (
              <span className="px-2.5 py-1 border-2 border-signal bg-signal text-ink font-bold uppercase shadow-hard-sm">
                {unreadCount} Unread
              </span>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="px-3 py-1 border-2 border-ink bg-ink text-paper font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
              >
                {markingAll ? 'Marking...' : 'Mark All Read'}
              </button>
            )}
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Real-time updates regarding service requests, dispatch status changes, on-site OTP verification, and direct customer settlement receipts.
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4">
          <div className="p-8 text-center border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]">
            <div className="inline-block w-6 h-6 border-2 border-signal border-t-transparent animate-spin mb-2" />
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--theme-text-soft)]">
              SYNCING IN-APP ALERTS...
            </p>
          </div>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-6 border-2 border-dashed border-signal bg-[var(--theme-surface)] space-y-3 font-mono">
          <div className="flex items-center gap-2 text-signal text-xs font-bold uppercase">
            <span>[!]</span>
            <span>Failed to load notifications</span>
          </div>
          <p className="font-sans text-sm text-[var(--theme-text-main)]">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-1.5 border-2 border-ink bg-ink text-paper text-xs font-bold uppercase hover:bg-signal hover:text-ink cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="p-12 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-center space-y-4">
          <span className="stamp-badge bg-concrete text-ink border-ink mx-auto block w-max">
            INBOX ZERO
          </span>
          <p className="font-mono text-sm text-[var(--theme-text-soft)] max-w-md mx-auto">
            You have no notifications at this time. Live dispatch alerts and settlement updates will appear here automatically.
          </p>
        </div>
      ) : (
        /* Notification Cards List */
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isUnread = !notif.is_read;
            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 border-2 transition-all ${
                  isUnread
                    ? 'bg-[var(--theme-surface)] border-signal shadow-hard-sm'
                    : 'bg-[var(--theme-surface)] border-[var(--theme-border)] opacity-85'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-signal shrink-0" aria-label="Unread alert" />
                      )}
                      <h3 className="font-display font-extrabold text-base text-[var(--theme-text-main)]">
                        {notif.title}
                      </h3>
                      {isUnread && (
                        <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.2 bg-signal text-ink border border-ink">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-[var(--theme-text-main)] leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block pt-1">
                      {new Date(notif.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkOne(notif.id)}
                      className="px-2.5 py-1 border border-[var(--theme-border)] bg-[var(--theme-bg)] hover:bg-signal hover:text-ink font-mono text-[11px] font-bold uppercase shrink-0 cursor-pointer self-end sm:self-center"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
