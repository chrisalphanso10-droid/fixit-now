/**
 * FixIt Now - Admin Portal Master Controller
 * Conforms to docs/SRS.md Section 3.4 and docs/DESIGN.md:
 * - Tab navigation across all 10 Admin views:
 *   dashboard, kyc, plans, services, customers, partners, requests, subscriptions, ratings, activity-log.
 * - Session verification and logout handling.
 * - Dynamic URL hash sync.
 */

import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminLoginView from './AdminLoginView';
import AdminDashboard from './AdminDashboard';
import AdminKycReviewView from './AdminKycReviewView';
import AdminPlansView from './AdminPlansView';
import AdminServicesView from './AdminServicesView';
import AdminCustomersView from './AdminCustomersView';
import AdminPartnersView from './AdminPartnersView';
import AdminRequestsView from './AdminRequestsView';
import AdminSubscriptionsView from './AdminSubscriptionsView';
import AdminRatingsView from './AdminRatingsView';
import AdminActivityLogView from './AdminActivityLogView';
import { getAdminSession, adminLogout, getAdminKycList } from '../../services/adminService';

export default function AdminPortal({
  initialTab = 'dashboard',
  theme,
  setTheme,
  onExitPortal,
}) {
  const [session, setSession] = useState(() => getAdminSession());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingKycCount, setPendingKycCount] = useState(0);

  // Sync tab with initialTab prop if it changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load pending KYC count for sidebar badge
  useEffect(() => {
    if (session) {
      getAdminKycList('pending').then((list) => {
        setPendingKycCount(list.length);
      });
    }
  }, [session, activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    window.location.hash = `/admin/${tabId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
    setActiveTab('dashboard');
    window.location.hash = '/admin/dashboard';
  };

  const handleLogout = () => {
    adminLogout();
    setSession(null);
    if (onExitPortal) {
      onExitPortal();
    } else {
      window.location.hash = '/admin/login';
    }
  };

  // If no admin session exists, render login view
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col justify-between p-4 sm:p-8">
        <div className="max-w-md mx-auto w-full pt-4">
          <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-4">
            <a
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                if (onExitPortal) onExitPortal();
              }}
              className="flex items-center gap-2 group"
            >
              <span className="w-5 h-5 bg-signal border border-[var(--theme-border)] rotate-45 inline-block group-hover:rotate-90 transition-transform" />
              <span className="font-display font-extrabold text-xl tracking-tight text-[var(--theme-text-main)]">
                FixIt <span className="text-signal">Admin</span>
              </span>
            </a>
            <button
              type="button"
              onClick={onExitPortal}
              className="font-mono text-xs font-bold uppercase underline text-signal hover:text-[var(--theme-text-main)]"
            >
              ← Back to Board
            </button>
          </div>

          <AdminLoginView
            onSuccess={handleLoginSuccess}
            onCancel={onExitPortal}
          />
        </div>

        <div className="text-center font-mono text-xs text-[var(--theme-text-muted)] py-4">
          FixIt Now Admin Central Dispatch · SRS Section 3.4
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      currentTab={activeTab}
      onTabChange={handleTabChange}
      theme={theme}
      setTheme={setTheme}
      onLogout={handleLogout}
      pendingKycCount={pendingKycCount}
    >
      {activeTab === 'dashboard' && <AdminDashboard onNavigateTab={handleTabChange} />}
      {activeTab === 'kyc' && <AdminKycReviewView />}
      {activeTab === 'plans' && <AdminPlansView />}
      {activeTab === 'services' && <AdminServicesView />}
      {activeTab === 'customers' && <AdminCustomersView />}
      {activeTab === 'partners' && <AdminPartnersView />}
      {activeTab === 'requests' && <AdminRequestsView />}
      {activeTab === 'subscriptions' && <AdminSubscriptionsView />}
      {activeTab === 'ratings' && <AdminRatingsView />}
      {activeTab === 'activity-log' && <AdminActivityLogView />}
    </AdminLayout>
  );
}
