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
  { id: 'dashboard', label: 'Operations & Charts', icon: '📊', short: 'Overview' },
  { id: 'kyc', label: 'KYC Verification', icon: '🪪', short: 'KYC', hasBadge: true },
  { id: 'plans', label: 'Plans & Pricing', icon: '💳', short: 'Plans' },
  { id: 'services', label: 'Service Categories', icon: '🛠️', short: 'Services' },
  { id: 'customers', label: 'Customers (Read-Only)', icon: '👥', short: 'Customers' },
  { id: 'partners', label: 'Partners (Read-Only)', icon: '👷', short: 'Partners' },
  { id: 'requests', label: 'Service Requests', icon: '📋', short: 'Requests' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '🎟️', short: 'Subscriptions' },
  { id: 'ratings', label: 'Ratings & Reviews', icon: '⭐', short: 'Reviews' },
  { id: 'activity-log', label: 'Activity Audit Log', icon: '📜', short: 'Audit' },
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
