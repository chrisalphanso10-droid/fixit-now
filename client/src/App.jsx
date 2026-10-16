import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import { checkServerHealth } from './services/healthService';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fixit_theme') || 'light';
  });

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fixit_theme', theme);
  }, [theme]);

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
      <LandingPage theme={theme} setTheme={setTheme} />

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
