import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import CustomerPortal from './pages/customer/CustomerPortal';
import CustomerAuthView from './pages/customer/CustomerAuthView';
import { checkServerHealth } from './services/healthService';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fixit_theme') || 'light';
  });

  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
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
    return 'landing';
  });

  const [authMode, setAuthMode] = useState(() => {
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

  const [preselectedService, setPreselectedService] = useState(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fixit_theme', theme);
  }, [theme]);

  // Sync hash changes with view states
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash === '' || hash === '/') {
        setCurrentView('landing');
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
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

  const returnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <>
      {currentView === 'landing' && (
        <LandingPage
          theme={theme}
          setTheme={setTheme}
          onOpenCustomerPortal={navigateToCustomerPortal}
          onOpenCustomerAuth={navigateToCustomerAuth}
        />
      )}

      {currentView === 'customer' && (
        <CustomerPortal
          initialTab={customerTab}
          theme={theme}
          setTheme={setTheme}
          onExitPortal={returnToLanding}
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
            FixIt Now Customer Authentication · Sample Data Mode
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
