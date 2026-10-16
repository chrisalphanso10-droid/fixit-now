import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import CustomerPortal from './pages/customer/CustomerPortal';
import CustomerAuthView from './pages/customer/CustomerAuthView';
import PartnerPortal from './pages/partner/PartnerPortal';
import PartnerAuthView from './pages/partner/PartnerAuthView';
import AdminPortal from './pages/admin/AdminPortal';
import AdminLoginView from './pages/admin/AdminLoginView';
import { checkServerHealth } from './services/healthService';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { role, isAuthenticated, loading, logout } = useAuth();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fixit_theme') || 'light';
  });

  const [authNotice, setAuthNotice] = useState(null);

  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash === 'admin/login') {
      return 'admin-login';
    }
    if (hash.startsWith('admin')) {
      return 'admin';
    }
    if (
      hash.startsWith('customer/login') ||
      hash.startsWith('customer/register') ||
      hash.startsWith('customer/forgot')
    ) {
      return 'customer-auth';
    }
    if (hash.startsWith('customer')) {
      return 'customer';
    }
    if (
      hash.startsWith('partner/login') ||
      hash.startsWith('partner/register') ||
      hash.startsWith('partner/forgot')
    ) {
      return 'partner-auth';
    }
    if (hash.startsWith('partner')) {
      return 'partner';
    }
    return 'landing';
  });

  const [authMode, setAuthMode] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash.includes('register')) return 'register';
    if (hash.includes('forgot')) return 'forgot';
    return 'login';
  });

  const [partnerAuthMode, setPartnerAuthMode] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash.includes('register')) return 'register';
    if (hash.includes('forgot')) return 'forgot';
    return 'login';
  });

  const [customerTab, setCustomerTab] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash.startsWith('customer/')) {
      const sub = hash.replace('customer/', '');
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
        ].includes(sub)
      ) {
        return sub;
      }
    }
    return 'dashboard';
  });

  const [partnerTab, setPartnerTab] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash.startsWith('partner/')) {
      const sub = hash.replace('partner/', '');
      const valid = [
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
      if (valid.includes(sub)) {
        return sub;
      }
    }
    return 'dashboard';
  });

  const [adminTab, setAdminTab] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash.startsWith('admin/')) {
      const sub = hash.replace('admin/', '');
      const valid = [
        'dashboard',
        'kyc',
        'plans',
        'services',
        'customers',
        'partners',
        'requests',
        'subscriptions',
        'ratings',
        'activity-log',
      ];
      if (valid.includes(sub)) {
        return sub;
      }
    }
    return 'dashboard';
  });

  const [preselectedService, setPreselectedService] = useState(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fixit_theme', theme);
  }, [theme]);

  // Auto-dismiss auth security notice after 5 seconds
  useEffect(() => {
    if (authNotice) {
      const timer = setTimeout(() => setAuthNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [authNotice]);

  // Synchronize hash changes with views
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash === '' || hash === '/') {
        setCurrentView('landing');
      } else if (hash === 'admin/login') {
        setCurrentView('admin-login');
      } else if (hash.startsWith('admin/')) {
        const sub = hash.replace('admin/', '');
        setCurrentView('admin');
        setAdminTab(sub);
      } else if (hash === 'admin') {
        setCurrentView('admin');
        setAdminTab('dashboard');
      } else if (hash === 'customer/login') {
        setCurrentView('customer-auth');
        setAuthMode('login');
      } else if (hash === 'customer/register') {
        setCurrentView('customer-auth');
        setAuthMode('register');
      } else if (hash === 'customer/forgot-password' || hash === 'customer/forgot') {
        setCurrentView('customer-auth');
        setAuthMode('forgot');
      } else if (hash.startsWith('customer/')) {
        const sub = hash.replace('customer/', '');
        setCurrentView('customer');
        setCustomerTab(sub);
      } else if (hash === 'customer') {
        setCurrentView('customer');
        setCustomerTab('dashboard');
      } else if (hash === 'partner/login') {
        setCurrentView('partner-auth');
        setPartnerAuthMode('login');
      } else if (hash === 'partner/register') {
        setCurrentView('partner-auth');
        setPartnerAuthMode('register');
      } else if (hash === 'partner/forgot-password' || hash === 'partner/forgot') {
        setCurrentView('partner-auth');
        setPartnerAuthMode('forgot');
      } else if (hash.startsWith('partner/')) {
        const sub = hash.replace('partner/', '');
        setCurrentView('partner');
        setPartnerTab(sub);
      } else if (hash === 'partner') {
        setCurrentView('partner');
        setPartnerTab('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // =============================================================================
  // Role-Based Route Guards & Cross-Portal Access Prevention
  // Conforms to Task requirement: "all three roles can log in and cannot open each other's pages"
  // =============================================================================
  useEffect(() => {
    if (loading) return;

    const rawHash = window.location.hash.replace('#/', '').replace('#', '');

    // 1. Customer Portal Access Protection
    const isCustomerPortalRoute =
      (rawHash.startsWith('customer/') &&
        !['customer/login', 'customer/register', 'customer/forgot', 'customer/forgot-password'].includes(
          rawHash
        )) ||
      rawHash === 'customer';

    if (isCustomerPortalRoute) {
      if (!isAuthenticated) {
        setAuthNotice('! Authentication Required: Please log in as Customer to access your portal.');
        setCurrentView('customer-auth');
        setAuthMode('login');
        window.location.hash = '/customer/login';
      } else if (role !== 'customer') {
        const targetDesc = role === 'partner' ? 'Partner Dashboard' : 'Admin Portal';
        const targetHash = role === 'partner' ? '/partner/dashboard' : '/admin/dashboard';
        setAuthNotice(
          `! Access Denied: ${
            role === 'partner' ? 'Partner' : 'Administrator'
          } accounts cannot access the Customer Portal. Redirected to ${targetDesc}.`
        );
        setCurrentView(role === 'partner' ? 'partner' : 'admin');
        window.location.hash = targetHash;
      }
    }

    // 2. Partner Portal Access Protection
    const isPartnerPortalRoute =
      (rawHash.startsWith('partner/') &&
        !['partner/login', 'partner/register', 'partner/forgot', 'partner/forgot-password'].includes(
          rawHash
        )) ||
      rawHash === 'partner';

    if (isPartnerPortalRoute) {
      if (!isAuthenticated) {
        setAuthNotice('! Authentication Required: Please log in as Partner to access the dispatch portal.');
        setCurrentView('partner-auth');
        setPartnerAuthMode('login');
        window.location.hash = '/partner/login';
      } else if (role !== 'partner') {
        const targetDesc = role === 'customer' ? 'Customer Dashboard' : 'Admin Portal';
        const targetHash = role === 'customer' ? '/customer/dashboard' : '/admin/dashboard';
        setAuthNotice(
          `! Access Denied: ${
            role === 'customer' ? 'Customer' : 'Administrator'
          } accounts cannot access the Partner Portal. Redirected to ${targetDesc}.`
        );
        setCurrentView(role === 'customer' ? 'customer' : 'admin');
        window.location.hash = targetHash;
      }
    }

    // 3. Admin Portal Access Protection (SRS FR-A1)
    const isAdminPortalRoute = (rawHash.startsWith('admin/') && rawHash !== 'admin/login') || rawHash === 'admin';

    if (isAdminPortalRoute) {
      if (!isAuthenticated) {
        setAuthNotice('! Authentication Required: Please log in as Administrator.');
        setCurrentView('admin-login');
        window.location.hash = '/admin/login';
      } else if (role !== 'admin') {
        const targetDesc = role === 'customer' ? 'Customer Dashboard' : 'Partner Dashboard';
        const targetHash = role === 'customer' ? '/customer/dashboard' : '/partner/dashboard';
        setAuthNotice(
          `! Access Denied: ${
            role === 'customer' ? 'Customer' : 'Partner'
          } accounts cannot access the Admin Portal. Redirected to ${targetDesc}.`
        );
        setCurrentView(role === 'customer' ? 'customer' : 'partner');
        window.location.hash = targetHash;
      }
    }

    // 4. Redirect logged-in users away from auth pages to their respective portals
    if (['customer/login', 'customer/register'].includes(rawHash)) {
      if (isAuthenticated) {
        if (role === 'customer') {
          setCurrentView('customer');
          window.location.hash = '/customer/dashboard';
        } else {
          setAuthNotice(`! You are currently logged in as ${role}. Please log out to change accounts.`);
          setCurrentView(role === 'partner' ? 'partner' : 'admin');
          window.location.hash = role === 'partner' ? '/partner/dashboard' : '/admin/dashboard';
        }
      }
    }

    if (['partner/login', 'partner/register'].includes(rawHash)) {
      if (isAuthenticated) {
        if (role === 'partner') {
          setCurrentView('partner');
          window.location.hash = '/partner/dashboard';
        } else {
          setAuthNotice(`! You are currently logged in as ${role}. Please log out to change accounts.`);
          setCurrentView(role === 'customer' ? 'customer' : 'admin');
          window.location.hash = role === 'customer' ? '/customer/dashboard' : '/admin/dashboard';
        }
      }
    }

    if (rawHash === 'admin/login') {
      if (isAuthenticated) {
        if (role === 'admin') {
          setCurrentView('admin');
          window.location.hash = '/admin/dashboard';
        } else {
          setAuthNotice(`! You are currently logged in as ${role}. Please log out to access admin.`);
          setCurrentView(role === 'customer' ? 'customer' : 'partner');
          window.location.hash = role === 'customer' ? '/customer/dashboard' : '/partner/dashboard';
        }
      }
    }
  }, [loading, isAuthenticated, role, currentView]);

  const navigateToCustomerPortal = (tab = 'dashboard', service = null) => {
    setPreselectedService(service);
    setCustomerTab(tab);
    setCurrentView('customer');
    window.location.hash = `/customer/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToCustomerAuth = (mode = 'login') => {
    setAuthMode(mode);
    setCurrentView('customer-auth');
    window.location.hash = `/customer/${mode}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPartnerPortal = (tab = 'dashboard') => {
    setPartnerTab(tab);
    setCurrentView('partner');
    window.location.hash = `/partner/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPartnerAuth = (mode = 'login') => {
    setPartnerAuthMode(mode);
    setCurrentView('partner-auth');
    window.location.hash = `/partner/${mode}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAdminPortal = (tab = 'dashboard') => {
    setAdminTab(tab);
    setCurrentView('admin');
    window.location.hash = `/admin/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAdminLogin = () => {
    setCurrentView('admin-login');
    window.location.hash = '/admin/login';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePortalLogout = () => {
    logout();
    returnToLanding();
  };

  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await checkServerHealth();
      setHealthData(data);
    } catch {
      setHealthData({ status: 'offline' });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] flex items-center justify-center p-4 font-mono text-sm text-[var(--theme-text-main)]">
        <div className="p-6 bg-paper border-2 border-ink shadow-hard space-y-3 text-center max-w-sm">
          <div className="w-6 h-6 bg-signal border-2 border-ink rotate-45 mx-auto animate-spin" />
          <div className="font-bold text-signal uppercase tracking-widest text-xs">
            FIXIT NOW · SECURITY DISPATCH
          </div>
          <div className="text-xs text-muted">
            Verifying encrypted JWT authentication session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Role-Based Guard Notification Banner */}
      {authNotice && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] bg-paper border-2 border-signal shadow-hard p-3 font-mono text-xs font-bold text-ink flex items-center justify-between gap-3 animate-bounce"
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-signal text-ink font-extrabold flex items-center justify-center flex-shrink-0">
              !
            </span>
            <span>{authNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAuthNotice(null)}
            className="text-signal hover:underline uppercase text-[11px] font-bold"
          >
            [DISMISS]
          </button>
        </div>
      )}

      {currentView === 'landing' && (
        <LandingPage
          theme={theme}
          setTheme={setTheme}
          onOpenCustomerPortal={navigateToCustomerPortal}
          onOpenCustomerAuth={navigateToCustomerAuth}
          onOpenPartnerPortal={navigateToPartnerPortal}
          onOpenPartnerAuth={navigateToPartnerAuth}
          onOpenAdminPortal={navigateToAdminPortal}
          onOpenAdminLogin={navigateToAdminLogin}
        />
      )}

      {currentView === 'customer' && (
        <CustomerPortal
          initialTab={customerTab}
          theme={theme}
          setTheme={setTheme}
          onExitPortal={handlePortalLogout}
          preselectedService={preselectedService}
        />
      )}

      {currentView === 'customer-auth' && (
        <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col justify-between p-4 sm:p-8">
          <div className="max-w-md mx-auto w-full pt-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-4">
              <a
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  returnToLanding();
                }}
                className="flex items-center gap-2 group"
              >
                <span className="w-5 h-5 bg-signal border border-[var(--theme-border)] rotate-45 inline-block group-hover:rotate-90 transition-transform" />
                <span className="font-display font-extrabold text-xl tracking-tight text-[var(--theme-text-main)]">
                  FixIt <span className="text-signal">Now</span>
                </span>
              </a>
              <button
                type="button"
                onClick={returnToLanding}
                className="font-mono text-xs font-bold uppercase underline text-signal hover:text-[var(--theme-text-main)]"
              >
                ← Back to Board
              </button>
            </div>

            <CustomerAuthView
              initialMode={authMode}
              onSuccess={() => navigateToCustomerPortal('dashboard')}
              onCancel={returnToLanding}
            />
          </div>

          <div className="text-center font-mono text-xs text-[var(--theme-text-muted)] py-4">
            FixIt Now Customer Authentication · Verified JWT Session
          </div>
        </div>
      )}

      {currentView === 'partner' && (
        <PartnerPortal
          initialTab={partnerTab}
          theme={theme}
          setTheme={setTheme}
          onExitPortal={handlePortalLogout}
        />
      )}

      {currentView === 'partner-auth' && (
        <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col justify-between p-4 sm:p-8">
          <div className="max-w-2xl mx-auto w-full pt-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-4">
              <a
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  returnToLanding();
                }}
                className="flex items-center gap-2 group"
              >
                <span className="w-5 h-5 bg-signal border border-[var(--theme-border)] rotate-45 inline-block group-hover:rotate-90 transition-transform" />
                <span className="font-display font-extrabold text-xl tracking-tight text-[var(--theme-text-main)]">
                  FixIt <span className="text-signal">Now</span>
                </span>
              </a>
              <button
                type="button"
                onClick={returnToLanding}
                className="font-mono text-xs font-bold uppercase underline text-signal hover:text-[var(--theme-text-main)]"
              >
                ← Back to Board
              </button>
            </div>

            <PartnerAuthView
              initialMode={partnerAuthMode}
              onSuccess={(partnerUser, nextStep) => {
                if (nextStep === 'plan-selection') {
                  navigateToPartnerPortal('plan-selection');
                } else {
                  navigateToPartnerPortal('dashboard');
                }
              }}
              onNavigateToCustomerAuth={() => navigateToCustomerAuth('login')}
              onCancel={returnToLanding}
            />
          </div>

          <div className="text-center font-mono text-xs text-[var(--theme-text-muted)] py-4">
            FixIt Now Partner Dispatch &amp; Authentication · Verified JWT Session
          </div>
        </div>
      )}

      {currentView === 'admin' && (
        <AdminPortal
          initialTab={adminTab}
          theme={theme}
          setTheme={setTheme}
          onExitPortal={handlePortalLogout}
        />
      )}

      {currentView === 'admin-login' && (
        <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col justify-between p-4 sm:p-8">
          <div className="max-w-md mx-auto w-full pt-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-4">
              <a
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  returnToLanding();
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
                onClick={returnToLanding}
                className="font-mono text-xs font-bold uppercase underline text-signal hover:text-[var(--theme-text-main)]"
              >
                ← Back to Board
              </button>
            </div>

            <AdminLoginView
              onSuccess={() => navigateToAdminPortal('dashboard')}
              onCancel={returnToLanding}
            />
          </div>

          <div className="text-center font-mono text-xs text-[var(--theme-text-muted)] py-4">
            FixIt Now Central Administration · Verified JWT Session
          </div>
        </div>
      )}

      {/* Floating System Health Diagnostic Capsule (Keeps Prompt 0 Health Test Accessible) */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            loadHealth();
            setDiagnosticsOpen(true);
          }}
          className="border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 shadow-hard-sm font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-signal hover:text-ink transition-colors"
          title="Inspect Server Health Diagnostics"
        >
          <span
            className={`w-2 h-2 ${
              healthData?.status === 'ok' ? 'bg-done' : 'bg-signal animate-pulse'
            }`}
          />
          <span>API: {healthData?.status === 'ok' ? 'ONLINE' : 'CHECK'}</span>
        </button>
      </div>

      {/* Diagnostics Modal */}
      {diagnosticsOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-6 max-w-lg w-full shadow-hard relative font-mono text-xs text-ink"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <span className="font-bold text-signal uppercase tracking-widest">
                SYSTEM DIAGNOSTIC WORK ORDER
              </span>
              <button
                type="button"
                onClick={() => setDiagnosticsOpen(false)}
                className="w-7 h-7 border border-ink bg-concrete font-bold text-ink hover:bg-signal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-concrete border border-ink space-y-1">
                <div>
                  <span className="text-muted block">STATUS:</span>
                  <span
                    className={`font-bold ${
                      healthData?.status === 'ok' ? 'text-done' : 'text-signal'
                    }`}
                  >
                    {healthData?.status === 'ok'
                      ? 'HTTP 200 OK — CONNECTED'
                      : 'OFFLINE / UNREACHABLE'}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">SERVICE:</span>
                  <span className="font-bold">{healthData?.service || 'FixIt Now API'}</span>
                </div>
                <div>
                  <span className="text-muted block">TIMESTAMP:</span>
                  <span className="break-all">{healthData?.timestamp || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted block">UPTIME:</span>
                  <span>{healthData?.uptime ?? 0} seconds</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={loadHealth}
                  disabled={loadingHealth}
                  className="btn-primary w-full min-h-[44px]"
                >
                  {loadingHealth ? 'PINGING...' : 'RE-TEST /api/health'}
                </button>
                <button
                  type="button"
                  onClick={() => setDiagnosticsOpen(false)}
                  className="btn-secondary w-full min-h-[44px]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
