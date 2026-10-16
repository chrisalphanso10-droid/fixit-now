/**
 * FixIt Now - Customer Portal Shell / Layout
 * Phone-first with bottom navigation (<1024px); left sidebar on lg and up (1024px+).
 * Conforms to docs/DESIGN.md Section 10 (Responsive rules).
 */

export default function CustomerLayout({
  activeTab,
  onNavigate,
  activeRequest,
  customer,
  theme,
  setTheme,
  onLogout,
  children,
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: 'new-request',
      label: 'New Request',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <polygon points="4,2 20,2 20,22 16,19 12,22 8,19 4,22" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="16" y2="11" />
          <line x1="8" y1="15" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      id: 'addresses',
      label: 'Addresses',
      desktopOnly: true,
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <path d="M12 2L3 9v13h18V9L12 2z" />
          <rect x="9" y="13" width="6" height="9" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <rect x="4" y="4" width="16" height="16" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6 18c0-2.5 3-4 6-4s6 1.5 6 4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col lg:flex-row">
      {/* ============================================================== */}
      {/* DESKTOP SIDEBAR (1024px and up)                                */}
      {/* ============================================================== */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-[var(--theme-surface)] border-r-2 border-[var(--theme-border)] min-h-screen p-6 justify-between z-30">
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 border-b-2 border-[var(--theme-border)] pb-5">
            <span
              className="w-7 h-7 bg-signal border-2 border-[var(--theme-border)] rotate-45 inline-block shrink-0"
              aria-hidden="true"
            />
            <div>
              <span className="font-display font-extrabold text-2xl tracking-tight block leading-none">
                FixIt Now
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal block mt-1">
                CUSTOMER PORTAL
              </span>
            </div>
          </div>

          {/* Ticket Header Metadata */}
          <div className="p-3 bg-[var(--theme-surface-sub)] border-2 border-[var(--theme-border)] shadow-hard-sm font-mono text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-current/20 mb-1.5">
              <span className="text-[var(--theme-text-muted)] uppercase">WORK ORDER</span>
              <span className="font-bold text-signal">CUSTOMER COPY</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text-muted)]">NO.</span>
              <span className="font-bold">
                {activeRequest ? activeRequest.order_number : '0427'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Customer Sidebar">
            {navItems.map((item) => {
              const isActive =
                activeTab === item.id ||
                (item.id === 'new-request' &&
                  (activeTab === 'searching' || activeTab === 'tracking'));
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 border-2 font-mono text-xs font-bold uppercase tracking-wider transition-all text-left ${
                    isActive
                      ? 'bg-signal text-ink border-[var(--theme-border)] shadow-hard-sm'
                      : 'border-transparent text-[var(--theme-text-main)] hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-sub)]'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Job Quick Ticker (if job in progress) */}
          {activeRequest && activeRequest.status !== 'cancelled' && (
            <div className="p-3.5 bg-paper border-2 border-signal shadow-hard-sm space-y-2 text-ink">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase bg-signal text-ink px-1.5 py-0.5">
                  LIVE DISPATCH
                </span>
                <span className="w-2 h-2 rounded-full bg-signal animate-ping" />
              </div>
              <div>
                <span className="font-display font-extrabold text-sm block leading-tight">
                  {activeRequest.service_name}
                </span>
                <span className="font-mono text-[11px] text-soft block uppercase mt-0.5">
                  STATUS: {activeRequest.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onNavigate(activeRequest.status === 'searching' ? 'searching' : 'tracking')
                }
                className="w-full bg-ink text-paper text-xs font-mono font-bold uppercase py-1.5 border border-ink hover:bg-signal hover:text-ink transition-colors"
              >
                Open Tracker →
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer: Customer Info & Logout */}
        <div className="pt-6 border-t-2 border-[var(--theme-border)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <span className="font-display font-bold text-sm block truncate">
                {customer?.name || 'Customer'}
              </span>
              <span className="font-mono text-[11px] text-[var(--theme-text-muted)] truncate block">
                {customer?.phone || '+91 98765 43210'}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-mono font-bold uppercase text-signal hover:underline shrink-0"
              title="Return to Public Landing"
            >
              LOGOUT
            </button>
          </div>

          {/* Theme Switcher in Sidebar */}
          <div className="flex items-center gap-1 border-2 border-[var(--theme-border)] p-1 bg-[var(--theme-surface-sub)]">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex-1 py-1 font-mono text-[10px] font-bold uppercase text-center ${
                theme === 'light' ? 'bg-signal text-ink' : 'text-[var(--theme-text-muted)]'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex-1 py-1 font-mono text-[10px] font-bold uppercase text-center ${
                theme === 'dark' ? 'bg-signal text-ink' : 'text-[var(--theme-text-muted)]'
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme('contrast')}
              className={`flex-1 py-1 font-mono text-[10px] font-bold uppercase text-center ${
                theme === 'contrast' ? 'bg-signal text-ink' : 'text-[var(--theme-text-muted)]'
              }`}
            >
              High
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN CONTENT AREA                                              */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-6 bg-[var(--theme-surface)] border-b-2 border-[var(--theme-border)] flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Brand Mark */}
            <div className="flex items-center gap-2 lg:hidden">
              <span
                className="w-5 h-5 bg-signal border border-[var(--theme-border)] rotate-45 inline-block shrink-0"
                aria-hidden="true"
              />
              <span className="font-display font-extrabold text-lg tracking-tight">FixIt Now</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-[var(--theme-text-muted)]">
              <span className="uppercase">PORTAL</span>
              <span>/</span>
              <span className="font-bold text-[var(--theme-text-main)] uppercase">
                {activeTab.replace(/-/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Job Tracker Button for Mobile */}
            {activeRequest && (
              <button
                type="button"
                onClick={() =>
                  onNavigate(activeRequest.status === 'searching' ? 'searching' : 'tracking')
                }
                className="lg:hidden flex items-center gap-1.5 px-2.5 py-1 bg-signal text-ink border border-ink font-mono text-[11px] font-bold uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ink animate-ping" />
                <span>TRACK JOB</span>
              </button>
            )}

            {/* Work Order Copy Badge */}
            <span className="hidden md:inline-block font-mono text-xs font-bold uppercase px-2 py-0.5 border border-[var(--theme-border)] bg-[var(--theme-surface-sub)]">
              CUSTOMER COPY No. 0427
            </span>

            {/* Theme Toggle (Mobile & Tablet) */}
            <div className="lg:hidden flex items-center gap-1 border border-[var(--theme-border)] p-0.5 bg-[var(--theme-surface-sub)]">
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'contrast' : 'light')}
                className="px-2 py-0.5 font-mono text-[10px] font-bold uppercase bg-signal text-ink"
                title="Switch Theme"
              >
                {theme.toUpperCase()}
              </button>
            </div>

            {/* Logout / Exit Portal */}
            <button
              type="button"
              onClick={onLogout}
              className="font-mono text-xs font-bold uppercase underline hover:text-signal text-[var(--theme-text-main)]"
            >
              EXIT
            </button>
          </div>
        </header>

        {/* Dynamic Screen Content (padded for mobile bottom navigation) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* ============================================================== */}
        {/* MOBILE BOTTOM NAVIGATION BAR (<1024px)                        */}
        {/* ============================================================== */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--theme-surface)] border-t-2 border-[var(--theme-border)] flex items-center justify-around z-30 px-2 pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile Bottom Navigation"
        >
          {navItems
            .filter((item) => !item.desktopOnly)
            .map((item) => {
              const isActive =
                activeTab === item.id ||
                (item.id === 'new-request' &&
                  (activeTab === 'searching' || activeTab === 'tracking'));
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'text-signal border-t-2 border-signal -mt-[2px]'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
