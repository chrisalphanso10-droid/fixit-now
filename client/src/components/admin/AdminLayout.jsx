/**
 * FixIt Now - Admin Layout Component
 * Conforms to docs/DESIGN.md:
 * - Desktop-first layout with collapsible sidebar in `ink` (#111418)
 * - Content area on `concrete` / `paper`
 * - Hard shadows, 2px borders, DM Mono labels, DM Sans body
 * - Mobile responsive drawer/menu (< 1024px)
 * - Real `<button>` and accessible interactive controls
 */

import { useState } from 'react';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Operations & Charts',
    short: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'kyc',
    label: 'KYC Verification',
    short: 'KYC',
    hasBadge: true,
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="0" />
        <circle cx="9" cy="10" r="2" />
        <line x1="14" y1="9" x2="18" y2="9" />
        <line x1="14" y1="13" x2="18" y2="13" />
      </svg>
    ),
  },
  {
    id: 'plans',
    label: 'Plans & Pricing',
    short: 'Plans',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="0" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: 'services',
    label: 'Service Categories',
    short: 'Services',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'customers',
    label: 'Customers (Read-Only)',
    short: 'Customers',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'partners',
    label: 'Partners (Read-Only)',
    short: 'Partners',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    id: 'requests',
    label: 'Service Requests',
    short: 'Requests',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    short: 'Subscriptions',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="0" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="7" y1="15" x2="11" y2="15" />
      </svg>
    ),
  },
  {
    id: 'ratings',
    label: 'Ratings & Reviews',
    short: 'Reviews',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: 'activity-log',
    label: 'Activity Audit Log',
    short: 'Audit',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

export default function AdminLayout({
  currentTab,
  onTabChange,
  theme,
  setTheme,
  onLogout,
  pendingKycCount = 0,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'contrast' : 'light';
    setTheme(next);
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col lg:flex-row">
      {/* ============================================================== */}
      {/* 1. DESKTOP COLLAPSIBLE SIDEBAR                                */}
      {/* ============================================================== */}
      <aside
        className={`hidden lg:flex flex-col justify-between bg-ink text-paper border-r-2 border-ink transition-all duration-200 z-30 shrink-0 ${
          collapsed ? 'w-20' : 'w-72'
        }`}
        style={{ minHeight: '100vh' }}
      >
        <div>
          {/* Brand & Portal Stamp */}
          <div className="p-4 border-b-2 border-[#2A2E35]">
            <div className="flex items-center justify-between">
              <a
                href="#/"
                className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
                title="Return to FixIt Now Home"
              >
                <span className="w-5 h-5 bg-signal border border-paper rotate-45 shrink-0" />
                {!collapsed && (
                  <span className="font-display font-extrabold text-xl tracking-tight text-paper truncate">
                    FixIt <span className="text-signal">Admin</span>
                  </span>
                )}
              </a>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(!collapsed)}
                  className="p-1 border border-[#3A3F47] hover:border-signal text-paper font-mono text-xs"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  ◀
                </button>
              )}
            </div>

            {collapsed ? (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="font-mono text-[10px] text-signal font-bold hover:underline"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  ▶ EXPAND
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#9BA3AF]">
                  ROOT DISPATCH CTRL
                </span>
                <span className="stamp-badge border-signal text-signal text-[9px] px-1.5 py-0 bg-ink">
                  LIVE SEC. 3.4
                </span>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1" aria-label="Admin Navigation">
            {NAV_ITEMS.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  title={item.label}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors min-h-[44px] ${
                    active
                      ? 'bg-signal text-paper font-bold shadow-hard-sm'
                      : 'text-on-dark hover:bg-[#1E232B] hover:text-paper'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="truncate flex-1 font-medium">{item.label}</span>
                  )}
                  {!collapsed && item.hasBadge && pendingKycCount > 0 && (
                    <span className="bg-[#B83A14] text-paper text-[10px] font-bold px-1.5 py-0.2 border border-paper">
                      {pendingKycCount}
                    </span>
                  )}
                  {collapsed && item.hasBadge && pendingKycCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-signal border border-paper rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t-2 border-[#2A2E35] bg-[#0E1114]">
          {!collapsed && (
            <div className="mb-3 font-mono text-[11px] text-[#9BA3AF]">
              <div className="text-paper font-bold truncate">admin@fixitnow.local</div>
              <div>Chief Dispatcher · Role Admin</div>
            </div>
          )}

          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
            <button
              type="button"
              onClick={cycleTheme}
              className="btn-secondary w-full py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 min-h-[38px]"
              title="Cycle theme (light / dark / contrast)"
            >
              <span>◐</span>
              {!collapsed && (
                <span className="capitalize">{theme} Theme</span>
              )}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full border-2 border-[#3A3F47] hover:border-signal bg-ink hover:bg-signal hover:text-ink text-paper py-2 font-mono text-xs font-bold transition-colors min-h-[38px] text-center"
              title="Exit to main board"
            >
              {collapsed ? '✕' : 'Exit Admin'}
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE HEADER & NAVIGATION (< 1024px)                      */}
      {/* ============================================================== */}
      <header className="lg:hidden bg-ink text-paper border-b-2 border-ink px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-signal border border-paper rotate-45 shrink-0" />
            <span className="font-display font-extrabold text-lg text-paper">
              FixIt <span className="text-signal">Admin</span>
            </span>
            <span className="stamp-badge text-[9px] px-1 py-0 bg-ink border-signal text-signal">
              SEC. 3.4
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              className="px-2.5 py-1.5 border border-[#3A3F47] font-mono text-xs text-paper"
              aria-label="Toggle theme"
            >
              ◐ {theme}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-primary px-3 py-1.5 text-xs font-mono font-bold min-h-[36px]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? 'CLOSE ✕' : 'MENU ☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="mt-3 pt-3 border-t border-[#2A2E35] grid grid-cols-2 gap-1.5 max-h-[70vh] overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2 font-mono text-[11px] uppercase tracking-wider text-left border flex items-center justify-between ${
                    active
                      ? 'bg-signal text-paper border-signal font-bold'
                      : 'border-[#2A2E35] text-on-dark hover:text-paper hover:bg-[#1E232B]'
                  }`}
                >
                  <span className="truncate">
                    {item.icon} {item.short}
                  </span>
                  {item.hasBadge && pendingKycCount > 0 && (
                    <span className="bg-[#B83A14] text-paper text-[9px] font-bold px-1 border border-paper">
                      {pendingKycCount}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="col-span-2 pt-2 border-t border-[#2A2E35] flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted">admin@fixitnow.local</span>
              <button
                type="button"
                onClick={onLogout}
                className="font-mono text-xs font-bold text-signal underline"
              >
                Exit Portal
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ============================================================== */}
      {/* 3. MAIN WORKSPACE / CONTENT AREA                               */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Control Bar with Live Monitor Indicator */}
        <div className="bg-[var(--theme-surface)] border-b-2 border-[var(--theme-border)] px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-signal font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-done rounded-full inline-block animate-pulse" />
              SYSTEM ACTIVE · DISPATCH ENGINE 2.0
            </span>
            <span className="hidden sm:inline font-mono text-xs text-[var(--theme-text-muted)]">
              | 2 KM MATCHING RADIUS · 0% PLATFORM CUT
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-[var(--theme-text-muted)]">
            <span className="bg-[var(--theme-surface-sub)] px-2 py-1 border border-[var(--theme-border)]">
              TAB: <strong className="text-[var(--theme-text-main)] uppercase">{currentTab}</strong>
            </span>
            <span className="hidden md:inline">
              SERVER: <strong className="text-done">HTTP 200 OK</strong>
            </span>
          </div>
        </div>

        {/* View Content */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
