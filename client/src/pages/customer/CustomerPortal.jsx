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
import { getCurrentCustomer, customerLogout } from '../../services/authService';
import { getActiveRequest, setActiveRequest } from '../../services/requestService';

export default function CustomerPortal({
  initialTab = 'dashboard',
  theme,
  setTheme,
  onExitPortal,
  preselectedService = null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customer, setCustomer] = useState(null);
  const [activeRequest, setActiveRequestState] = useState(null);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(preselectedService);

  // Load customer session & active job
  useEffect(() => {
    const cur = getCurrentCustomer();
    setCustomer(cur);
    const existingActive = getActiveRequest();
    setActiveRequestState(existingActive);

    // If an initial preselected service was passed from landing page, jump to new-request
    if (preselectedService) {
      setSelectedServiceForBooking(preselectedService);
      setActiveTab('new-request');
    }
  }, [preselectedService]);

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
  };

  const handleCancelActiveJob = () => {
    setActiveRequestState(null);
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
