import { useState, useEffect } from 'react';
import { checkServerHealth } from './services/healthService';

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [latency, setLatency] = useState(null);
  const [pingHistory, setPingHistory] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Theme Management: 'light' (Field Clipboard), 'dark' (Workshop Night), 'contrast' (Blueprint Contrast)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fixit_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fixit_theme', theme);
  }, [theme]);

  // Live station clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const data = await checkServerHealth();
      const end = performance.now();
      const roundtrip = Math.round(end - start);
      setLatency(roundtrip);
      setHealthData(data);
      const timeStr = new Date().toLocaleTimeString();
      setLastChecked(timeStr);
      setPingHistory((prev) => [
        { time: timeStr, latency: roundtrip, status: '200 OK', uptime: data.uptime },
        ...prev.slice(0, 3),
      ]);
    } catch (err) {
      setError(err.message || 'Unable to connect to FixIt Now backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col font-sans selection:bg-signal selection:text-ink transition-colors duration-150"
    >
      {/* Top Banner & Navigation */}
      <header className="border-b-2 border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 sm:px-8 transition-colors duration-150">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Geometric Tool Mark (2px stroke, square caps) */}
            <div className="w-11 h-11 bg-ink border-2 border-[var(--theme-border)] flex items-center justify-center p-2 shadow-hard-sm">
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full text-paper"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
                aria-hidden="true"
              >
                <path
                  d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                  stroke="#FF5B14"
                />
                <path d="m3 3 6 6" stroke="#FBFAF6" />
                <path d="m15 15 6 6" stroke="#FBFAF6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-none">
                  FIXIT<span className="text-signal">NOW</span>
                </span>
                <span className="font-mono text-[11px] font-bold bg-ink text-paper px-1.5 py-0.5 tracking-wider uppercase border border-ink">
                  DEV-BUILD
                </span>
              </div>
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--theme-text-soft)] block mt-0.5">
                ON-DEMAND TRADESPERSON WORK ORDER SYSTEM
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Theme Selector Segmented Control */}
            <div
              className="flex items-center border-2 border-[var(--theme-border)] bg-[var(--theme-surface)]"
              role="group"
              aria-label="Theme selector"
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1 font-mono text-xs font-bold uppercase transition-colors ${
                  theme === 'light'
                    ? 'bg-signal text-ink'
                    : 'text-[var(--theme-text-soft)] hover:bg-[var(--theme-surface-sub)]'
                }`}
                title="Field Clipboard Theme (Light)"
              >
                LIGHT
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1 font-mono text-xs font-bold uppercase border-l-2 border-[var(--theme-border)] transition-colors ${
                  theme === 'dark'
                    ? 'bg-signal text-ink'
                    : 'text-[var(--theme-text-soft)] hover:bg-[var(--theme-surface-sub)]'
                }`}
                title="Workshop Theme (Dark)"
              >
                DARK
              </button>
              <button
                type="button"
                onClick={() => setTheme('contrast')}
                className={`px-3 py-1 font-mono text-xs font-bold uppercase border-l-2 border-[var(--theme-border)] transition-colors ${
                  theme === 'contrast'
                    ? 'bg-signal text-ink'
                    : 'text-[var(--theme-text-soft)] hover:bg-[var(--theme-surface-sub)]'
                }`}
                title="High Contrast Blueprint Theme"
              >
                CONTRAST
              </button>
            </div>

            <div className="hidden sm:flex flex-col items-end font-mono text-xs">
              <span className="text-[var(--theme-text-muted)] tracking-wider">STATION TIME</span>
              <span className="font-bold text-[var(--theme-text-main)]">{currentTime}</span>
            </div>

            <div
              className={`stamp-badge ${
                healthData?.status === 'ok'
                  ? 'bg-done text-paper border-[var(--theme-border)] animate-stamp-in'
                  : error
                    ? 'bg-ink text-signal border-[var(--theme-border)]'
                    : 'bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)]'
              }`}
            >
              <span
                className={`w-2 h-2 inline-block ${
                  healthData?.status === 'ok'
                    ? 'bg-paper'
                    : error
                      ? 'bg-signal'
                      : 'bg-[var(--theme-text-muted)]'
                }`}
              />
              {healthData?.status === 'ok'
                ? 'SYSTEM ONLINE'
                : error
                  ? 'LINK OFFLINE'
                  : 'CHECKING...'}
            </div>
          </div>
        </div>
      </header>

      {/* Repeating Tape-Measure Ruler Band */}
      <div className="ruler-strip" role="presentation" aria-hidden="true" />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-8 sm:px-8 sm:py-12">
        {/* Intro Subtitle Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-3 mb-8">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-signal border border-[var(--theme-border)]" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--theme-text-main)]">
              WORK ORDER #0001 · ARCHITECTURE SKELETON
            </span>
          </div>
          <span className="font-mono text-xs text-[var(--theme-text-muted)] tracking-wider uppercase">
            ACTIVE THEME: <strong className="text-signal font-bold">{theme}</strong> ·
            DOCS/DESIGN.MD
          </span>
        </div>

        {/* Dual Ticket Work Order Layout: Customer Copy & Partner Copy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ============================================================== */}
          {/* TICKET 1: CUSTOMER COPY                                        */}
          {/* ============================================================== */}
          <section
            className="lg:col-span-7 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] relative flex flex-col transition-colors duration-150"
            style={{ boxShadow: 'var(--theme-shadow-hard)' }}
            aria-labelledby="customer-ticket-heading"
          >
            {/* Top Ticket Punch Hole Marks */}
            <div className="border-b-2 border-[var(--theme-border)] px-6 py-3 bg-[var(--theme-surface-sub)] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] inline-block" />
                <span className="font-bold tracking-widest text-[var(--theme-text-main)]">
                  CUSTOMER COPY
                </span>
              </div>
              <span className="font-bold text-[var(--theme-text-soft)] bg-[var(--theme-surface)] px-2 py-0.5 border border-[var(--theme-border)] tracking-wider">
                NO. 0001 / REQ-INIT
              </span>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Ticket Headline */}
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-signal font-bold block mb-1">
                  PHASE 1 FOUNDATION DISPATCH
                </span>
                <h1
                  id="customer-ticket-heading"
                  className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-[var(--theme-text-main)]"
                >
                  SERVICE SKELETON READY
                </h1>
                <p className="text-[var(--theme-text-soft)] text-base sm:text-lg mt-2 leading-relaxed">
                  The client workspace is established with modern React, Vite, and strict
                  tradesperson Tailwind tokens. Handshake verified with the Express REST API.
                </p>
              </div>

              {/* Tear Line Divider */}
              <div className="tear-line" role="separator" />

              {/* Health Diagnostic Telemetry Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--theme-text-main)] flex items-center gap-2">
                    <span className="w-2 h-2 bg-signal inline-block" />
                    SERVER STATUS TELEMETRY (GET /api/health)
                  </h2>
                  {lastChecked && (
                    <span className="font-mono text-xs text-[var(--theme-text-muted)]">
                      PING: <strong className="text-[var(--theme-text-main)]">{latency}ms</strong> @{' '}
                      {lastChecked}
                    </span>
                  )}
                </div>

                {loading && !healthData ? (
                  <div className="p-6 bg-[var(--theme-surface-sub)] border-2 border-[var(--theme-border)] text-center">
                    <span className="font-mono text-sm uppercase tracking-wider text-[var(--theme-text-main)] font-bold animate-pulse">
                      ESTABLISHING WORK ORDER CONNECTION...
                    </span>
                  </div>
                ) : error ? (
                  <div className="p-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm">
                    <div className="flex items-start gap-3">
                      <span className="font-display font-extrabold text-3xl text-signal leading-none">
                        !
                      </span>
                      <div>
                        <h3 className="font-display font-bold text-lg text-[var(--theme-text-main)]">
                          Server Connection Failed
                        </h3>
                        <p className="text-[var(--theme-text-soft)] text-sm mt-1">{error}</p>
                        <div className="mt-3 p-3 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)] font-mono text-xs">
                          <span className="text-[var(--theme-text-muted)] block mb-1">
                            START BACKEND DAEMON:
                          </span>
                          <code className="text-[var(--theme-text-main)] font-bold">
                            cd server &amp;&amp; npm run dev
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] divide-y-2 divide-[var(--theme-border)]">
                    {/* Live Connection Banner */}
                    <div className="p-3 sm:p-4 bg-[var(--theme-surface)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-done flex items-center justify-center text-paper font-bold text-[10px]">
                          ✓
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-[var(--theme-text-main)]">
                          LINK OPERATIONAL — HTTP 200 OK
                        </span>
                      </div>
                      <span className="font-mono text-xs bg-[var(--theme-surface-sub)] px-2 py-0.5 border border-[var(--theme-border)] text-[var(--theme-text-soft)]">
                        ROUNDTRIP: {latency}ms
                      </span>
                    </div>

                    {/* Metadata Specs */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                      <div>
                        <span className="text-[var(--theme-text-muted)] block uppercase">
                          SERVICE
                        </span>
                        <span className="text-[var(--theme-text-main)] font-bold">
                          {healthData?.service}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--theme-text-muted)] block uppercase">
                          VERSION
                        </span>
                        <span className="text-[var(--theme-text-main)] font-bold">
                          v{healthData?.version}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--theme-text-muted)] block uppercase">
                          UPTIME
                        </span>
                        <span className="text-[var(--theme-text-main)] font-bold">
                          {healthData?.uptime}s
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--theme-text-muted)] block uppercase">ENV</span>
                        <span className="text-[var(--theme-text-main)] font-bold uppercase">
                          {healthData?.environment}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-4 pt-1">
                        <span className="text-[var(--theme-text-muted)] block uppercase">
                          SERVER TIME (UTC)
                        </span>
                        <span className="text-[var(--theme-text-main)] font-medium break-all">
                          {healthData?.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tactical Buttons */}
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={fetchHealth}
                    disabled={loading}
                    className="btn-primary"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="square"
                      aria-hidden="true"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    {loading ? 'TESTING LINK...' : 'EXECUTE HEALTH PING'}
                  </button>

                  <a href="/api/health" target="_blank" rel="noreferrer" className="btn-secondary">
                    INSPECT RAW API
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="square"
                      aria-hidden="true"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Tear Line Divider */}
              <div className="tear-line" role="separator" />

              {/* 6-Step Foundation Verification Ladder */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-soft)]">
                    DISPATCH VERIFICATION LADDER
                  </h3>
                  <span className="font-mono text-xs text-[var(--theme-text-muted)]">
                    5 OF 6 STEPS COMPLETED
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-done rounded-full flex items-center justify-center text-paper font-bold text-xs">
                        ✓
                      </span>
                      <span className="text-[var(--theme-text-main)] font-bold">
                        1. Express Backend REST Server
                      </span>
                    </div>
                    <span className="text-done font-bold tracking-wider uppercase">MOUNTED</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-done rounded-full flex items-center justify-center text-paper font-bold text-xs">
                        ✓
                      </span>
                      <span className="text-[var(--theme-text-main)] font-bold">
                        2. Health Diagnostic Route (GET /api/health)
                      </span>
                    </div>
                    <span className="text-done font-bold tracking-wider uppercase">ONLINE</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-done rounded-full flex items-center justify-center text-paper font-bold text-xs">
                        ✓
                      </span>
                      <span className="text-[var(--theme-text-main)] font-bold">
                        3. React 19 + Vite HMR Dev Server
                      </span>
                    </div>
                    <span className="text-done font-bold tracking-wider uppercase">ACTIVE</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-done rounded-full flex items-center justify-center text-paper font-bold text-xs">
                        ✓
                      </span>
                      <span className="text-[var(--theme-text-main)] font-bold">
                        4. Tailwind CSS Trade Tokens &amp; Google Fonts
                      </span>
                    </div>
                    <span className="text-done font-bold tracking-wider uppercase">VERIFIED</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface-sub)] border border-[var(--theme-border)]">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-done rounded-full flex items-center justify-center text-paper font-bold text-xs">
                        ✓
                      </span>
                      <span className="text-[var(--theme-text-main)] font-bold">
                        5. Dynamic Localhost CORS &amp; Proxy Fallback
                      </span>
                    </div>
                    <span className="text-done font-bold tracking-wider uppercase">PASSED</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--theme-surface)] border border-dashed border-[var(--theme-border)] opacity-80">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 border-2 border-[var(--theme-text-muted)] rounded-full inline-block" />
                      <span className="text-[var(--theme-text-soft)]">
                        6. PostgreSQL Relational Schema &amp; Seed
                      </span>
                    </div>
                    <span className="text-[var(--theme-text-muted)] tracking-wider uppercase font-medium">
                      PHASE 1 NEXT
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* TICKET 2: PARTNER COPY (Dark Ink Ticket with Signal Shadow)    */}
          {/* ============================================================== */}
          <section
            className="lg:col-span-5 bg-ink text-paper border-2 border-[var(--theme-border)] relative flex flex-col transform lg:rotate-[0.5deg]"
            style={{ boxShadow: '9px 9px 0 #FF5B14' }}
            aria-labelledby="partner-ticket-heading"
          >
            {/* Dark Ticket Header Row */}
            <div className="border-b-2 border-[#3A3F47] px-6 py-3 bg-[#1B1F24] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-signal bg-signal inline-block" />
                <span className="font-bold tracking-widest text-paper">PARTNER COPY</span>
              </div>
              <span className="font-bold text-signal bg-ink px-2 py-0.5 border border-signal tracking-wider">
                TRADE SPECIFICATION
              </span>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Partner Section Header */}
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-on-dark font-medium block mb-1">
                  SERVICE SUITE MANIFEST
                </span>
                <h2
                  id="partner-ticket-heading"
                  className="text-2xl sm:text-3xl font-display font-extrabold text-paper tracking-tight"
                >
                  HANDYMAN PORTAL SPEC
                </h2>
                <p className="text-on-dark text-sm mt-2">
                  Trade categories ready for Section 6 matching algorithms and 2 km proximity
                  dispatch.
                </p>
              </div>

              {/* Tear Line Dark */}
              <div className="tear-line-dark" role="separator" />

              {/* Trade Icons & Category Grid */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-on-dark mb-3 font-bold">
                  SERVICE DISCIPLINES (SINGLE CATEGORY PER PARTNER)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Category 1: Electrical */}
                  <div className="border-2 border-[#3A3F47] bg-[#1B1F24] p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-ink border border-signal flex items-center justify-center shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 stroke-signal fill-none stroke-[2.5]"
                        strokeLinecap="square"
                      >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-display font-bold text-sm block leading-none text-paper">
                        Electrical
                      </span>
                      <span className="font-mono text-[11px] text-on-dark">Est. ₹350.00</span>
                    </div>
                  </div>

                  {/* Category 2: Plumbing */}
                  <div className="border-2 border-[#3A3F47] bg-[#1B1F24] p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-ink border border-signal flex items-center justify-center shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 stroke-signal fill-none stroke-[2.5]"
                        strokeLinecap="square"
                      >
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-display font-bold text-sm block leading-none text-paper">
                        Plumbing
                      </span>
                      <span className="font-mono text-[11px] text-on-dark">Est. ₹300.00</span>
                    </div>
                  </div>

                  {/* Category 3: Carpentry */}
                  <div className="border-2 border-[#3A3F47] bg-[#1B1F24] p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-ink border border-signal flex items-center justify-center shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 stroke-signal fill-none stroke-[2.5]"
                        strokeLinecap="square"
                      >
                        <rect x="2" y="6" width="20" height="12" />
                        <line x1="6" y1="6" x2="6" y2="10" />
                        <line x1="10" y1="6" x2="10" y2="12" />
                        <line x1="14" y1="6" x2="14" y2="10" />
                        <line x1="18" y1="6" x2="18" y2="12" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-display font-bold text-sm block leading-none text-paper">
                        Carpentry
                      </span>
                      <span className="font-mono text-[11px] text-on-dark">Est. ₹400.00</span>
                    </div>
                  </div>

                  {/* Category 4: Appliance */}
                  <div className="border-2 border-[#3A3F47] bg-[#1B1F24] p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-ink border border-signal flex items-center justify-center shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 stroke-signal fill-none stroke-[2.5]"
                        strokeLinecap="square"
                      >
                        <rect x="4" y="2" width="16" height="20" />
                        <circle cx="12" cy="14" r="4" />
                        <line x1="12" y1="6" x2="12.01" y2="6" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-display font-bold text-sm block leading-none text-paper">
                        Appliance
                      </span>
                      <span className="font-mono text-[11px] text-on-dark">Est. ₹450.00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tear Line Dark */}
              <div className="tear-line-dark" role="separator" />

              {/* Live Ping Telemetry Feed */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-on-dark mb-3 font-bold flex items-center justify-between">
                  <span>TELEMETRY HISTORY</span>
                  <span className="text-signal text-[11px]">LIVE UPDATES</span>
                </h3>

                {pingHistory.length === 0 ? (
                  <div className="p-3 bg-[#1B1F24] border border-[#3A3F47] font-mono text-xs text-on-dark text-center">
                    Awaiting first diagnostic ping...
                  </div>
                ) : (
                  <div className="space-y-2 font-mono text-xs">
                    {pingHistory.map((item, index) => (
                      <div
                        key={index}
                        className="p-2.5 bg-[#1B1F24] border border-[#3A3F47] flex items-center justify-between text-on-dark"
                      >
                        <span className="text-paper">{item.time}</span>
                        <span className="text-done font-bold">{item.status}</span>
                        <span className="text-signal font-bold">{item.latency}ms</span>
                        <span>up: {item.uptime}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outline Number Callout */}
              <div className="border-t-2 border-[#3A3F47] pt-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] text-on-dark uppercase block">
                    MATCHING RADIUS
                  </span>
                  <span className="font-mono text-sm text-paper font-bold">
                    SRS SECTION 3.5 (FR-M3)
                  </span>
                </div>
                <div className="text-right">
                  <span className="outline-numeral-dark text-5xl">2.0</span>
                  <span className="font-mono text-xs text-signal font-bold block uppercase tracking-wider">
                    KILOMETRES
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ============================================================== */}
        {/* DESIGN SYSTEM TOKEN INSPECTION BENCH                           */}
        {/* ============================================================== */}
        <section
          className="mt-12 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 transition-colors duration-150"
          style={{ boxShadow: 'var(--theme-shadow-hard)' }}
          aria-labelledby="bench-heading"
        >
          <div className="flex flex-wrap items-center justify-between border-b-2 border-[var(--theme-border)] pb-3 mb-6 gap-2">
            <div>
              <h2
                id="bench-heading"
                className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-tight text-[var(--theme-text-main)]"
              >
                DESIGN SYSTEM TOKENS BENCH
              </h2>
              <span className="font-mono text-xs uppercase text-[var(--theme-text-soft)]">
                HARD CODED SPECIFICATION COMPLIANCE (DOCS/DESIGN.MD SECTION 12)
              </span>
            </div>
            <span className="stamp-badge bg-[var(--theme-surface)] text-[var(--theme-text-main)] border-[var(--theme-border)]">
              THEME: {theme.toUpperCase()}
            </span>
          </div>

          {/* Token Color Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            <div className="border-2 border-ink p-3 bg-ink text-paper">
              <span className="font-mono text-xs font-bold block">ink</span>
              <span className="font-mono text-[11px] text-on-dark block">#111418</span>
            </div>
            <div className="border-2 border-ink p-3 bg-concrete text-ink">
              <span className="font-mono text-xs font-bold block">concrete</span>
              <span className="font-mono text-[11px] text-soft block">#EDEEE9</span>
            </div>
            <div className="border-2 border-ink p-3 bg-paper text-ink">
              <span className="font-mono text-xs font-bold block">paper</span>
              <span className="font-mono text-[11px] text-soft block">#FBFAF6</span>
            </div>
            <div className="border-2 border-ink p-3 bg-signal text-ink">
              <span className="font-mono text-xs font-bold block">signal</span>
              <span className="font-mono text-[11px] text-ink block">#FF5B14</span>
            </div>
            <div className="border-2 border-ink p-3 bg-soft text-paper">
              <span className="font-mono text-xs font-bold block">soft</span>
              <span className="font-mono text-[11px] text-on-dark block">#3A3F47</span>
            </div>
            <div className="border-2 border-ink p-3 bg-muted text-paper">
              <span className="font-mono text-xs font-bold block">muted</span>
              <span className="font-mono text-[11px] text-paper block">#6B7079</span>
            </div>
            <div className="border-2 border-ink p-3 bg-on-dark text-ink">
              <span className="font-mono text-xs font-bold block">on-dark</span>
              <span className="font-mono text-[11px] text-ink block">#C9CBC4</span>
            </div>
            <div className="border-2 border-ink p-3 bg-done text-paper">
              <span className="font-mono text-xs font-bold block">done</span>
              <span className="font-mono text-[11px] text-paper block">#1E8C4E</span>
            </div>
          </div>

          {/* Negative Constraints Checklist (Section 13 of DESIGN.md) */}
          <div className="border-2 border-[var(--theme-border)] bg-[var(--theme-surface-sub)] p-4 sm:p-6 transition-colors duration-150">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-3">
              ZERO-COMPROMISE DESIGN AUDIT (SECTION 13: &quot;NEVER DO THIS&quot;)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO gradients or glassmorphism</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO rounded pill buttons (100% square)</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO identical icon-in-circle cards</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO emoji icons (strict inline SVGs)</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO default Tailwind blues or purples</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--theme-text-main)]">
                <span className="w-4 h-4 bg-done text-paper flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>NO lorem ipsum or fake stats</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Repeating Tape-Measure Ruler Band */}
      <div className="ruler-strip" role="presentation" aria-hidden="true" />

      {/* Bottom Footer */}
      <footer className="border-t-2 border-[var(--theme-border)] bg-[var(--theme-surface)] py-6 px-4 font-mono text-xs text-[var(--theme-text-soft)] transition-colors duration-150">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-bold text-[var(--theme-text-main)]">FIXIT NOW</span> · ON-DEMAND
            NEIGHBOURHOOD HOME SERVICES
          </div>
          <div className="text-[var(--theme-text-muted)]">
            THEMES: LIGHT (FIELD) · DARK (WORKSHOP) · CONTRAST (BLUEPRINT)
          </div>
        </div>
      </footer>
    </div>
  );
}
