/**
 * FixIt Now - Partner Portal Master Coordinator
 * Phone-first bottom navigation under 1024px; left sidebar navigation on lg and up (1024px+).
 * Coordinates all 11 partner screens, incoming request popup, demo state switcher, and active job state progression.
 * Conforms to SRS Section 3.3 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import PartnerLayout from '../../components/partner/PartnerLayout';
import PartnerDashboard from './PartnerDashboard';
import ActiveJobView from './ActiveJobView';
import EarningsView from './EarningsView';
import PartnerHistoryView from './PartnerHistoryView';
import PartnerRatingsView from './PartnerRatingsView';
import PlanDetailsView from './PlanDetailsView';
import PlanSelectionView from './PlanSelectionView';
import KycUploadView from './KycUploadView';
import PartnerProfileView from './PartnerProfileView';
import IncomingRequestPopup from './IncomingRequestPopup';
import {
  getActivePartner,
  getPartnerDashboardData,
  getPartnerSubscription,
  getActiveJob,
  togglePartnerOnline,
  switchDemoPartnerAccount,
  getMockIncomingJob,
  acceptIncomingJob,
  declineIncomingJob,
} from '../../services/partnerService';
import { logoutPartner } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';

export default function PartnerPortal({
  initialTab = 'dashboard',
  theme,
  setTheme,
  onExitPortal,
}) {
  const { user: authUser } = useAuth() || {};
  const [activeTab, setActiveTab] = useState(initialTab);
  const [partner, setPartner] = useState(() => authUser || getActivePartner());
  const [subscription, setSubscription] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeJob, setActiveJobState] = useState(null);
  const [online, setOnline] = useState(() => (authUser?.online !== undefined ? Boolean(authUser.online) : Boolean(getActivePartner()?.online)));
  const [incomingJob, setIncomingJob] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync when authUser updates from AuthContext (/api/auth/me)
  useEffect(() => {
    if (authUser && authUser.role === 'partner') {
      setPartner((prev) => ({ ...(prev || {}), ...authUser }));
      if (authUser.online !== undefined) {
        setOnline(Boolean(authUser.online));
      }
    }
  }, [authUser]);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash.startsWith('partner/')) {
        const sub = hash.replace('partner/', '');
        const validTabs = [
          'dashboard',
          'active-job',
          'earnings',
          'history',
          'ratings',
          'plan',
          'plan-selection',
          'kyc',
          'profile',
        ];
        if (validTabs.includes(sub)) {
          setActiveTab(sub);
        }
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Load partner session data
  const refreshPartnerData = async () => {
    const currentPartner = authUser || getActivePartner();
    setPartner(currentPartner);
    setOnline(Boolean(currentPartner?.online));

    const sub = await getPartnerSubscription(currentPartner.id);
    setSubscription(sub);

    const dash = await getPartnerDashboardData(currentPartner.id);
    setDashboardData(dash);

    if (dash?.partner) {
      const mergedPartner = { ...currentPartner, ...dash.partner };
      setPartner(mergedPartner);
      setOnline(Boolean(dash.partner.online));
      setActivePartner(mergedPartner);
    }
    if (dash?.subscription) {
      setSubscription(dash.subscription);
    }

    const job = getActiveJob();
    setActiveJobState(job);
  };

  useEffect(() => {
    refreshPartnerData();
  }, []);

  // Real-time Socket.IO dispatch integration (Phase 6)
  useEffect(() => {
    if (!partner?.id) return;

    socketService.registerPartner(partner.id);

    const unsubIncoming = socketService.onIncomingRequest((data) => {
      // Only show popup if online
      if (online && data?.job) {
        setIncomingJob(data.job);
      }
    });

    const unsubTimeout = socketService.onRequestTimeout((data) => {
      setIncomingJob((cur) => {
        if (
          cur &&
          (String(cur.id) === String(data?.requestId) ||
            String(cur.request_id) === String(data?.requestId))
        ) {
          showToast('Job offer timed out. You remain online.');
          return null;
        }
        return cur;
      });
    });

    const unsubCancelled = socketService.onRequestCancelled((data) => {
      setIncomingJob((cur) => {
        if (
          cur &&
          (String(cur.id) === String(data?.requestId) ||
            String(cur.request_id) === String(data?.requestId))
        ) {
          showToast('Customer cancelled the request.');
          return null;
        }
        return cur;
      });
    });

    return () => {
      unsubIncoming();
      unsubTimeout();
      unsubCancelled();
    };
  }, [partner?.id, online]);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    window.location.hash = `/partner/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Online / Offline toggle
  const handleToggleOnline = async () => {
    try {
      const updated = await togglePartnerOnline(partner?.id || 101);
      const merged = { ...(partner || {}), ...updated };
      setPartner(merged);
      setOnline(Boolean(updated.online));
      setDashboardData((prev) => (prev ? {
        ...prev,
        partner: { ...(prev.partner || {}), ...merged },
      } : prev));
      showToast(updated.online ? '● You are now ONLINE — listening for dispatches in 2 km.' : '○ You are now OFFLINE — radar paused.');
    } catch (err) {
      showToast(err.message || 'Unable to toggle online status.', true);
    }
  };

  // Demo Switcher
  const handleDemoSwitch = async (type) => {
    const switched = await switchDemoPartnerAccount(type);
    setPartner(switched);
    setOnline(Boolean(switched.online));
    const sub = await getPartnerSubscription(switched.id);
    setSubscription(sub);
    const dash = await getPartnerDashboardData(switched.id);
    setDashboardData(dash);
    showToast(`Switched demo account to: ${switched.name} (${switched.service_name})`);

    // If switched to pending or rejected kyc, direct to kyc tab
    if (type === 'pending_kyc' || type === 'rejected_kyc') {
      handleSelectTab('kyc');
    } else if (type === 'warning_plan' || type === 'expired_plan') {
      handleSelectTab('plan');
    } else {
      handleSelectTab('dashboard');
    }
  };

  // Simulate Incoming Request
  const handleSimulateIncomingRequest = () => {
    if (!online) {
      showToast('! Turn on your dispatch radar to receive incoming jobs.', true);
      return;
    }
    const mock = getMockIncomingJob();
    setIncomingJob(mock);
  };

  // Accept incoming job (SRS FR-P9)
  const handleAcceptIncomingJob = async (job) => {
    const reqId = job.id || job.request_id;
    setIncomingJob(null);
    try {
      if (partner?.id && reqId) {
        socketService.respondToJob(reqId, partner.id, 'accept');
      }
    } catch (socketErr) {
      console.warn('[Socket Accept Warning]:', socketErr.message);
    }
    const accepted = await acceptIncomingJob(job);
    setActiveJobState(accepted);
    showToast(`✓ Work order ${accepted.order_number} accepted! Navigating to active trip.`);
    handleSelectTab('active-job');
  };

  // Decline incoming job (SRS FR-P7)
  const handleDeclineIncomingJob = async (reason) => {
    const currentJob = incomingJob;
    const reqId = currentJob?.id || currentJob?.request_id;
    setIncomingJob(null);
    if (currentJob && reqId && partner?.id) {
      try {
        socketService.respondToJob(reqId, partner.id, 'decline', reason);
      } catch (socketErr) {
        console.warn('[Socket Decline Warning]:', socketErr.message);
      }
      await declineIncomingJob(reqId);
    }
    showToast(reason === 'TIMEOUT_EXPIRED' ? 'Job request timed out. You remain online.' : 'Job request declined.');
  };

  // Active Job Updated
  const handleJobUpdated = (updated) => {
    setActiveJobState(updated);
  };

  // Active Job Closed
  const handleJobClosed = (settlement) => {
    setActiveJobState(null);
    refreshPartnerData();
    if (settlement) {
      showToast('✓ Work order closed. Payment received and job completed.');
    }
  };

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleLogout = () => {
    logoutPartner();
    if (onExitPortal) onExitPortal();
  };

  return (
    <>
      <PartnerLayout
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        partner={partner}
        subscription={subscription}
        online={online}
        onToggleOnline={handleToggleOnline}
        onDemoSwitch={handleDemoSwitch}
        onSimulateIncomingRequest={handleSimulateIncomingRequest}
        activeJob={activeJob}
        theme={theme}
        setTheme={setTheme}
        onExitPortal={handleLogout}
      >
        {activeTab === 'dashboard' && (
          <PartnerDashboard
            partner={partner}
            subscription={subscription}
            dashboardData={dashboardData}
            online={online}
            onToggleOnline={handleToggleOnline}
            onSimulateIncomingRequest={handleSimulateIncomingRequest}
            activeJob={activeJob}
            onNavigate={handleSelectTab}
          />
        )}

        {activeTab === 'active-job' && (
          <ActiveJobView
            activeJob={activeJob}
            onJobUpdated={handleJobUpdated}
            onJobClosed={handleJobClosed}
            onNavigateToDashboard={() => handleSelectTab('dashboard')}
          />
        )}

        {activeTab === 'earnings' && (
          <EarningsView partner={partner} />
        )}

        {activeTab === 'history' && (
          <PartnerHistoryView partner={partner} />
        )}

        {activeTab === 'ratings' && (
          <PartnerRatingsView partner={partner} />
        )}

        {activeTab === 'plan' && (
          <PlanDetailsView
            partner={partner}
            subscription={subscription}
            onPlanRenewed={(renewed) => {
              setSubscription(renewed);
              refreshPartnerData();
            }}
            onNavigateToDashboard={() => handleSelectTab('dashboard')}
          />
        )}

        {activeTab === 'plan-selection' && (
          <PlanSelectionView
            partner={partner}
            onPlanSelected={(newSub) => {
              setSubscription(newSub);
              refreshPartnerData();
            }}
            onProceedToKyc={() => handleSelectTab('kyc')}
          />
        )}

        {activeTab === 'kyc' && (
          <KycUploadView
            partner={partner}
            onKycUpdated={(_newKyc) => {
              refreshPartnerData();
            }}
            onNavigateToDashboard={() => handleSelectTab('dashboard')}
          />
        )}

        {activeTab === 'profile' && (
          <PartnerProfileView
            partner={partner}
            onProfileUpdated={(updated) => {
              setPartner(updated);
              showToast('✓ Partner profile updated.');
            }}
          />
        )}
      </PartnerLayout>

      {/* Incoming Request Popup (30-second Countdown Ring) */}
      {incomingJob && (
        <IncomingRequestPopup
          job={incomingJob}
          onAccept={handleAcceptIncomingJob}
          onDecline={handleDeclineIncomingJob}
        />
      )}

      {/* Floating Work Order Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-8 z-50 p-4 border-2 shadow-hard font-mono text-xs font-bold transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.isError
              ? 'border-signal bg-paper text-ink'
              : 'border-done bg-paper text-ink'
          }`}
          style={{ borderRadius: 0, maxWidth: '380px' }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 ${
                toastMessage.isError ? 'bg-signal' : 'bg-done'
              }`}
            />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </>
  );
}
