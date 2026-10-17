/**
 * FixIt Now - Customer Portal Orchestrator
 * Integrates all customer views with responsive shell and state transitions.
 * Conforms to SRS Section 3.2 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import CustomerLayout from '../../components/customer/CustomerLayout';
import CustomerDashboard from './CustomerDashboard';
import CreateRequestView from './CreateRequestView';
import SearchingView from './SearchingView';
import LiveTrackingView from './LiveTrackingView';
import RateAndPayView from './RateAndPayView';
import RequestHistoryView from './RequestHistoryView';
import CustomerProfileView from './CustomerProfileView';
import SavedAddressesView from './SavedAddressesView';
import NotificationsView from '../common/NotificationsView';
import SupportView from '../common/SupportView';
import { getCurrentCustomer, customerLogout } from '../../services/authService';
import { getActiveRequest, setActiveRequest, getRequestHistory } from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';

export default function CustomerPortal({
  initialTab = 'dashboard',
  theme,
  setTheme,
  onExitPortal,
  preselectedService = null,
}) {
  const { user: authUser } = useAuth() || {};
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customer, setCustomer] = useState(authUser || null);
  const [activeRequest, setActiveRequestState] = useState(null);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(preselectedService);

  // Load customer session & active job
  useEffect(() => {
    const cur = authUser || getCurrentCustomer();
    setCustomer(cur);
    if (cur?.id) {
      socketService.registerCustomer(cur.id);
    }

    const existingActive = getActiveRequest();
    if (existingActive) {
      setActiveRequestState(existingActive);
      if (existingActive.id) {
        socketService.joinRequest(existingActive.id);
      }
      if (
        ['accepted', 'partner_on_way', 'partner_arrived', 'service_started', 'on_the_way', 'arrived', 'in_progress'].includes(
          existingActive.status
        )
      ) {
        setActiveTab('tracking');
        window.location.hash = '/customer/tracking';
      } else if (existingActive.status === 'requested') {
        setActiveTab('searching');
        window.location.hash = '/customer/searching';
      }
    }

    // Sync in-flight requests from server
    async function syncActiveWithServer() {
      try {
        const history = await getRequestHistory('all');
        const activeJob = (history || []).find((r) =>
          [
            'requested',
            'accepted',
            'partner_on_way',
            'partner_arrived',
            'service_started',
            'on_the_way',
            'arrived',
            'in_progress',
          ].includes(r.status)
        );
        if (activeJob) {
          const stepMap = {
            requested: 0,
            accepted: 1,
            partner_on_way: 2,
            on_the_way: 2,
            partner_arrived: 3,
            arrived: 3,
            service_started: 4,
            in_progress: 4,
          };
          const formatted = {
            ...activeJob,
            order_number: activeJob.order_number || `ORD-${String(activeJob.id || '').replace(/-/g, '').slice(0, 4).toUpperCase()}`,
            step_index: stepMap[activeJob.status] ?? 1,
            partner: (activeJob.partner && activeJob.partner.name)
              ? activeJob.partner
              : (activeJob.partner_id ? {
                  id: activeJob.partner_id,
                  name: activeJob.partner_name || 'Assigned Partner',
                  phone: activeJob.partner_phone || '+91 98450 11223',
                  rating: activeJob.partner_rating || 4.9,
                  vehicle: activeJob.partner_vehicle || 'Service Vehicle',
                  service_name: activeJob.service_name || 'Home Repair',
                } : null),
          };
          setActiveRequestState(formatted);
          setActiveRequest(formatted);
          socketService.joinRequest(formatted.id);

          const hash = window.location.hash.replace('#/', '').replace('#', '');
          if (!hash.includes('history') && !hash.includes('profile') && !hash.includes('addresses')) {
            if (formatted.status === 'requested') {
              setActiveTab('searching');
              window.location.hash = '/customer/searching';
            } else {
              setActiveTab('tracking');
              window.location.hash = '/customer/tracking';
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }
    syncActiveWithServer();

    // If an initial preselected service was passed from landing page, jump to new-request
    if (preselectedService) {
      setSelectedServiceForBooking(preselectedService);
      setActiveTab('new-request');
    }
  }, [preselectedService, authUser]);

  // Global socket listener: immediately show tracking screen upon partner accept
  useEffect(() => {
    const unsubAccepted = socketService.onRequestAccepted((data) => {
      if (data && data.requestId) {
        const updated = {
          id: data.requestId,
          order_number: data.order_number,
          partner: data.partner,
          partner_id: data.partner?.id,
          status: data.status || 'accepted',
          service_otp: data.service_otp,
          address: data.address,
          problem: data.problem,
          service_name: data.service_name,
          step_index: data.step_index || 1,
        };
        setActiveRequestState(updated);
        setActiveRequest(updated);
        socketService.joinRequest(data.requestId);
        setActiveTab('tracking');
        window.location.hash = '/customer/tracking';
      }
    });

    const unsubCancelled = socketService.onRequestCancelled((data) => {
      setActiveRequestState(null);
      setActiveRequest(null);
      setActiveTab('history');
      window.location.hash = '/customer/history';
    });

    return () => {
      unsubAccepted();
      unsubCancelled();
    };
  }, []);

  // Sync with URL hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash.startsWith('customer/')) {
        const tab = hash.replace('customer/', '');
        if (
          [
            'dashboard',
            'new-request',
            'searching',
            'tracking',
            'rate-receipt',
            'history',
            'notifications',
            'support',
            'profile',
            'addresses',
          ].includes(tab)
        ) {
          setActiveTab(tab);
        }
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    window.location.hash = `/customer/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    customerLogout();
    if (onExitPortal) onExitPortal();
  };

  const handleRequestCreated = (request) => {
    setActiveRequestState(request);
    setActiveRequest(request);
  };

  const handlePartnerMatched = (updatedRequest) => {
    setActiveRequestState(updatedRequest);
    setActiveRequest(updatedRequest);
  };

  const handleCancelActiveJob = () => {
    setActiveRequestState(null);
    setActiveRequest(null);
  };

  return (
    <CustomerLayout
      activeTab={activeTab}
      onNavigate={handleNavigate}
      activeRequest={activeRequest}
      customer={customer}
      theme={theme}
      setTheme={setTheme}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && (
        <CustomerDashboard
          customer={customer}
          activeRequest={activeRequest}
          onNavigate={handleNavigate}
          onSelectService={(service) => {
            setSelectedServiceForBooking(service);
            handleNavigate('new-request');
          }}
        />
      )}

      {activeTab === 'new-request' && (
        <CreateRequestView
          customer={customer}
          initialService={selectedServiceForBooking}
          onNavigate={handleNavigate}
          onRequestCreated={handleRequestCreated}
        />
      )}

      {activeTab === 'searching' && (
        <SearchingView
          activeRequest={activeRequest}
          onPartnerMatched={handlePartnerMatched}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'tracking' && (
        <LiveTrackingView
          activeRequest={activeRequest}
          onNavigate={handleNavigate}
          onCancel={handleCancelActiveJob}
        />
      )}

      {activeTab === 'rate-receipt' && (
        <RateAndPayView
          activeRequest={activeRequest}
          onNavigate={handleNavigate}
          onRatingSubmitted={handleCancelActiveJob}
        />
      )}

      {activeTab === 'history' && (
        <RequestHistoryView onNavigate={handleNavigate} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsView userRole="customer" />
      )}

      {activeTab === 'support' && (
        <SupportView userRole="customer" />
      )}

      {activeTab === 'profile' && (
        <CustomerProfileView
          onProfileUpdated={(updated) => setCustomer(updated)}
        />
      )}

      {activeTab === 'addresses' && (
        <SavedAddressesView onNavigate={handleNavigate} />
      )}
    </CustomerLayout>
  );
}
