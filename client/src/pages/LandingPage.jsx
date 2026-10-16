import { useState, useEffect } from 'react';
import { getServices, getLandingFaqs } from '../services/serviceService';

export default function LandingPage({ theme, setTheme }) {
  const [services, setServices] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // { role: 'customer' | 'partner', action: 'login' | 'signup' }

  useEffect(() => {
    getServices().then((data) => {
      setServices(data);
      if (data.length > 0) setSelectedService(data[0]);
    });
    getLandingFaqs().then((data) => setFaqs(data));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-main)] flex flex-col font-sans selection:bg-signal selection:text-ink">
      {/* ============================================================== */}
      {/* 1. HEADER                                                      */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 border-b-2 border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 sm:px-8 transition-colors duration-150">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Logo: Orange rotated square + FixIt Now */}
          <a href="#" className="flex items-center gap-3 group text-decoration-none">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <div className="w-6 h-6 bg-signal border-2 border-[var(--theme-border)] rotate-45 transform group-hover:rotate-90 transition-transform duration-200" />
            </div>
            <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-none text-[var(--theme-text-main)]">
              FixIt <span className="text-signal">Now</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-mono text-sm uppercase tracking-wider font-medium">
            <a
              href="#services"
              className="text-[var(--theme-text-main)] hover:text-signal transition-colors underline-offset-4 hover:underline"
            >
              Services
            </a>
            <a
              href="#how-it-works"
              className="text-[var(--theme-text-main)] hover:text-signal transition-colors underline-offset-4 hover:underline"
            >
              How it works
            </a>
            <a
              href="#why-fixit"
              className="text-[var(--theme-text-main)] hover:text-signal transition-colors underline-offset-4 hover:underline"
            >
              Why FixIt Now
            </a>
            <a
              href="#help"
              className="text-[var(--theme-text-main)] hover:text-signal transition-colors underline-offset-4 hover:underline"
            >
              Help
            </a>
          </nav>

          {/* Right Header Actions: Theme Switcher, Login, Dark Sign up */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Theme Toggle */}
            <div className="flex items-center border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] mr-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-2 py-1 font-mono text-xs font-bold ${
                  theme === 'light' ? 'bg-signal text-ink' : 'text-[var(--theme-text-soft)]'
                }`}
                title="Light Theme"
              >
                L
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-2 py-1 font-mono text-xs font-bold border-l-2 border-[var(--theme-border)] ${
                  theme === 'dark' ? 'bg-signal text-ink' : 'text-[var(--theme-text-soft)]'
                }`}
                title="Dark Theme"
              >
                D
              </button>
              <button
                type="button"
                onClick={() => setTheme('contrast')}
                className={`px-2 py-1 font-mono text-xs font-bold border-l-2 border-[var(--theme-border)] ${
                  theme === 'contrast' ? 'bg-signal text-ink' : 'text-[var(--theme-text-soft)]'
                }`}
                title="High Contrast"
              >
                C
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAuthModal({ role: 'customer', action: 'login' })}
              className="font-mono text-sm font-bold uppercase tracking-wider text-[var(--theme-text-main)] px-3 py-2 hover:text-signal transition-colors"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthModal({ role: 'customer', action: 'signup' })}
              className="btn-dark min-h-[44px]"
            >
              Sign up
            </button>
          </div>

          {/* Mobile Menu Hamburger (min 44px touch target) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-11 h-11 border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] flex flex-col items-center justify-center gap-1.5"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span
              className={`w-6 h-0.5 bg-[var(--theme-text-main)] transition-transform ${
                mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-[var(--theme-text-main)] transition-opacity ${
                mobileMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-[var(--theme-text-main)] transition-transform ${
                mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-2 border-[var(--theme-border)] mt-3 pt-4 pb-2 space-y-3 font-mono text-sm uppercase">
            <a
              href="#services"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[var(--theme-text-main)] font-bold hover:text-signal"
            >
              Services
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[var(--theme-text-main)] font-bold hover:text-signal"
            >
              How it works
            </a>
            <a
              href="#why-fixit"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[var(--theme-text-main)] font-bold hover:text-signal"
            >
              Why FixIt Now
            </a>
            <a
              href="#help"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[var(--theme-text-main)] font-bold hover:text-signal"
            >
              Help
            </a>
            <div className="pt-3 border-t-2 border-[var(--theme-border)] flex flex-col gap-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-[var(--theme-text-muted)]">THEME</span>
                <div className="flex border-2 border-[var(--theme-border)]">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`px-3 py-1 text-xs font-bold ${
                      theme === 'light' ? 'bg-signal text-ink' : ''
                    }`}
                  >
                    LIGHT
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`px-3 py-1 text-xs font-bold border-l-2 border-[var(--theme-border)] ${
                      theme === 'dark' ? 'bg-signal text-ink' : ''
                    }`}
                  >
                    DARK
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('contrast')}
                    className={`px-3 py-1 text-xs font-bold border-l-2 border-[var(--theme-border)] ${
                      theme === 'contrast' ? 'bg-signal text-ink' : ''
                    }`}
                  >
                    CONTRAST
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModal({ role: 'customer', action: 'login' });
                }}
                className="btn-secondary w-full min-h-[44px]"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModal({ role: 'customer', action: 'signup' });
                }}
                className="btn-primary w-full min-h-[44px]"
              >
                Sign up
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 2. HERO SECTION                                                */}
      {/* ============================================================== */}
      <section className="px-4 py-12 sm:px-8 sm:py-20 max-w-[1440px] mx-auto w-full">
        {/* Hero Title & Subline */}
        <div className="max-w-4xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 bg-signal border border-ink" />
            <span className="font-mono text-xs sm:text-sm uppercase tracking-widest text-soft font-bold">
              ON-DEMAND HOME-SERVICES MARKETPLACE
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight leading-[0.95] text-[var(--theme-text-main)] mb-6">
            One job. Two sides of the <span className="text-signal">counter.</span>
          </h1>

          <p className="text-lg sm:text-2xl text-[var(--theme-text-soft)] font-sans max-w-2xl leading-snug">
            Customers get the nearest verified fixer. Partners get steady local work. Pick your
            side.
          </p>
        </div>

        {/* Dual Work-Order Tickets Side by Side (Stacked on Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* ------------------------------------------------------------ */}
          {/* Customer Copy Ticket (Paper, Tilted -1deg on Desktop)        */}
          {/* ------------------------------------------------------------ */}
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-8 flex flex-col justify-between shadow-hard transition-transform duration-200 md:-rotate-1 hover:rotate-0"
            style={{ borderRadius: 0 }}
          >
            <div>
              {/* Header Row in DM Mono */}
              <div className="flex items-center justify-between border-b-2 border-ink pb-4 mb-6">
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-ink flex items-center gap-2">
                  <span className="w-3 h-3 bg-paper border-2 border-ink inline-block" />
                  CUSTOMER COPY
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest bg-concrete px-2 py-0.5 border border-ink text-ink">
                  No. 0427
                </span>
              </div>

              {/* Big Title */}
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-ink mb-6">
                I need a fix
              </h2>

              {/* Dashed Tear Line */}
              <div className="tear-line my-6" role="separator" />

              {/* Three Tick Lines with 22px green done circle & white check */}
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-soft font-medium">
                    Describe the problem in a minute
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-soft font-medium">
                    Nearest verified partner, within 2 km
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-soft font-medium">
                    Follow them live, step by step
                  </span>
                </li>
              </ul>
            </div>

            {/* Ticket Bottom Actions */}
            <div className="pt-6 border-t-2 border-dashed border-ink flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'customer', action: 'signup' })}
                className="btn-primary w-full sm:w-auto min-h-[44px]"
              >
                Join as customer
              </button>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'customer', action: 'login' })}
                className="font-sans font-bold underline text-ink text-sm hover:text-signal transition-colors py-2"
              >
                Customer login
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Partner Copy Ticket (Ink Background, Orange Shadow, Tilted 1deg) */}
          {/* ------------------------------------------------------------ */}
          <div
            className="bg-ink text-paper border-2 border-ink p-6 sm:p-8 flex flex-col justify-between shadow-hard-signal transition-transform duration-200 md:rotate-1 hover:rotate-0"
            style={{ borderRadius: 0 }}
          >
            <div>
              {/* Header Row in DM Mono */}
              <div className="flex items-center justify-between border-b-2 border-[#3A3F47] pb-4 mb-6">
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-paper flex items-center gap-2">
                  <span className="w-3 h-3 bg-signal border border-paper inline-block" />
                  PARTNER COPY
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest bg-ink px-2 py-0.5 border border-signal text-signal">
                  No. 0427
                </span>
              </div>

              {/* Big Title */}
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-paper mb-6">
                I fix things
              </h2>

              {/* Dashed Tear Line Dark */}
              <div className="tear-line-dark my-6" role="separator" />

              {/* Three Tick Lines with 22px green done circle & white check */}
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-on-dark font-medium">
                    Pick your one trade and a plan
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-on-dark font-medium">
                    Get KYC-verified, then go online
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] rounded-full bg-done flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-paper" aria-hidden="true">
                      <polygon points="14,3 6,11 2,7 0,9 6,15 16,5" />
                    </svg>
                  </span>
                  <span className="text-base sm:text-lg text-on-dark font-medium">
                    Accept jobs and keep what you earn
                  </span>
                </li>
              </ul>
            </div>

            {/* Ticket Bottom Actions */}
            <div className="pt-6 border-t-2 border-dashed border-[#3A3F47] flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'partner', action: 'signup' })}
                className="btn-primary w-full sm:w-auto min-h-[44px]"
              >
                Join as partner
              </button>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'partner', action: 'login' })}
                className="font-sans font-bold underline text-on-dark text-sm hover:text-signal transition-colors py-2"
              >
                Partner login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. TAPE-MEASURE RULER STRIP                                    */}
      {/* ============================================================== */}
      <div className="ruler-strip" role="presentation" aria-hidden="true" />

      {/* ============================================================== */}
      {/* 4. EVERY TRADE ON ONE BOARD (Service Chips from Service layer) */}
      {/* ============================================================== */}
      <section id="services" className="px-4 py-16 sm:px-8 sm:py-24 max-w-[1440px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-6 mb-10">
          <div>
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-signal block mb-2">
              DISPATCH CATEGORIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-[var(--theme-text-main)]">
              Every trade on one board
            </h2>
          </div>
          <p className="text-sm sm:text-base font-mono text-[var(--theme-text-soft)] max-w-md">
            Each partner offers exactly one certified trade. Direct neighbourhood matching within a
            2 km radius.
          </p>
        </div>

        {/* Chips Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service) => {
            const isSelected = selectedService?.id === service.id;
            return (
              <button
                type="button"
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`service-chip min-h-[110px] ${isSelected ? 'active' : ''}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <span className="font-display font-extrabold text-xl leading-snug">
                    {service.name}
                  </span>
                  <span className="w-3 h-3 border border-current shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between w-full font-mono text-xs mt-3 pt-2 border-t border-current/30">
                  <span className="uppercase">DISPATCH</span>
                  <span className="font-bold uppercase">WITHIN 2 KM</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Trade Preview Banner */}
        {selectedService && (
          <div className="mt-8 p-6 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase bg-signal text-ink font-bold px-2 py-0.5">
                  SELECTED DISCIPLINE
                </span>
                <span className="font-mono text-xs text-[var(--theme-text-muted)] uppercase">
                  TRADE CODE: {selectedService.slug}
                </span>
              </div>
              <h3 className="text-2xl font-display font-extrabold text-[var(--theme-text-main)]">
                {selectedService.name}
              </h3>
              <p className="text-sm sm:text-base text-[var(--theme-text-soft)] max-w-2xl">
                {selectedService.description}
              </p>
            </div>
            <div className="shrink-0 flex items-center">
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'customer', action: 'signup' })}
                className="btn-primary min-h-[44px]"
              >
                Book {selectedService.name}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 5. HOW IT WORKS, FROM BOTH SIDES                               */}
      {/* ============================================================== */}
      <section
        id="how-it-works"
        className="px-4 py-16 sm:px-8 sm:py-24 bg-[var(--theme-surface-sub)] border-t-2 border-[var(--theme-border)] w-full"
      >
        <div className="max-w-[1440px] mx-auto">
          <div className="border-b-2 border-[var(--theme-border)] pb-6 mb-12">
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-signal block mb-2">
              STEP-BY-STEP BLUEPRINT
            </span>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-[var(--theme-text-main)]">
              How it works, from both sides
            </h2>
            <p className="text-sm sm:text-base text-[var(--theme-text-soft)] mt-2">
              Two parallel lanes. One continuous ticket connecting requester and neighbourhood
              professional.
            </p>
          </div>

          {/* Two Parallel Lanes (Stacked on Mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Lane 1: Customer Lane */}
            <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard">
              <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-8">
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-signal flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-signal inline-block" />
                  CUSTOMER LANE
                </span>
                <span className="font-mono text-xs text-[var(--theme-text-muted)] uppercase">
                  REQUEST TO COMPLETION
                </span>
              </div>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">01</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Post your immediate request
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Pick your trade, describe the fault, and confirm your street address. Requests
                      are immediate only — no weeks of waiting.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">02</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Nearest partner matched (2 km)
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Our dispatch scans online, KYC-verified fixers within a 2 km radius and offers
                      the job to the closest professional first.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">03</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Follow them live on your ticket
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Watch the partner travel toward you with an ETA countdown. Each step stamps in
                      green in real-time as it occurs.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 4 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">04</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Verify OTP &amp; confirm completion
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Share the service OTP before work starts. Settle directly with the partner upon
                      repair, and your ticket confirms completion in real time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lane 2: Partner Lane */}
            <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-6 sm:p-8 shadow-hard">
              <div className="flex items-center justify-between border-b-2 border-[var(--theme-border)] pb-4 mb-8">
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-signal flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-ink inline-block border border-signal" />
                  PARTNER LANE
                </span>
                <span className="font-mono text-xs text-[var(--theme-text-muted)] uppercase">
                  VERIFY TO EARN
                </span>
              </div>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">01</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Pick your trade &amp; subscription
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Register with one certified category. Choose a quarterly, half-yearly or
                      yearly plan with 0% platform commissions.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">02</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Complete KYC verification
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Upload your identity documents (PDF) and passport photo. Admin verifies your
                      credentials before job dispatch unlocks.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">03</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Go online for local dispatch
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Flip the toggle to online when ready. Receive incoming request tickets within
                      2 km with a clear accept countdown.
                    </p>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-[var(--theme-border)]" />

                {/* Step 4 */}
                <div className="flex items-start gap-4">
                  <span className="outline-numeral text-5xl sm:text-6xl shrink-0">04</span>
                  <div className="pt-1">
                    <h3 className="font-display font-extrabold text-xl text-[var(--theme-text-main)] mb-1">
                      Execute service &amp; keep earnings
                    </h3>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      Advance status buttons on your phone, complete the fix, and receive payment
                      confirmation. Every rupee earned is yours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. DARK SECTION: WHY FIXIT NOW                                 */}
      {/* ============================================================== */}
      <section
        id="why-fixit"
        className="bg-ink text-paper border-y-2 border-ink py-16 sm:py-24 px-4 sm:px-8 w-full"
      >
        <div className="max-w-[1440px] mx-auto">
          <div className="border-b-2 border-[#3A3F47] pb-6 mb-12">
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-signal block mb-2">
              TRADE ADVANTAGE
            </span>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-paper">
              Why FixIt Now
            </h2>
          </div>

          {/* Two Columns: For customers & For partners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
            {/* Column 1: For customers */}
            <div className="space-y-8">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-signal inline-block" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-paper">
                  FOR CUSTOMERS
                </h3>
              </div>

              <div className="space-y-6">
                <div className="border-l-2 border-signal pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Nearby</h4>
                  <p className="text-on-dark text-base mt-1">
                    Matched within 2 km so a fixer is at your door in minutes, not hours.
                  </p>
                </div>

                <div className="border-l-2 border-[#3A3F47] pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Verified</h4>
                  <p className="text-on-dark text-base mt-1">
                    Every tradesperson is ID-checked and verified before they receive a single job.
                  </p>
                </div>

                <div className="border-l-2 border-[#3A3F47] pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Visible</h4>
                  <p className="text-on-dark text-base mt-1">
                    Follow every step on a live work-order ticket from dispatch to payment.
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: For partners */}
            <div className="space-y-8">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-paper inline-block" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-paper">
                  FOR PARTNERS
                </h3>
              </div>

              <div className="space-y-6">
                <div className="border-l-2 border-signal pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Local</h4>
                  <p className="text-on-dark text-base mt-1">
                    All jobs are in your own neighbourhood. No long cross-town travel.
                  </p>
                </div>

                <div className="border-l-2 border-[#3A3F47] pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Flat</h4>
                  <p className="text-on-dark text-base mt-1">
                    Pay a simple subscription. Zero commission taken from your repair earnings.
                  </p>
                </div>

                <div className="border-l-2 border-[#3A3F47] pl-4">
                  <h4 className="font-display font-extrabold text-2xl text-paper">Flexible</h4>
                  <p className="text-on-dark text-base mt-1">
                    Work on your own terms. Flip online when you want jobs, offline when you are
                    done.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. ABOUT US                                                    */}
      {/* ============================================================== */}
      <section id="about" className="px-4 py-16 sm:px-8 sm:py-24 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5">
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-signal block mb-2">
              OUR WORK ETHIC
            </span>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-[var(--theme-text-main)]">
              About us
            </h2>
          </div>
          <div className="md:col-span-7 space-y-4 text-base sm:text-lg text-[var(--theme-text-soft)] leading-relaxed">
            <p>
              FixIt Now was started because getting a dripping tap or a sparking switchboard
              repaired shouldn&apos;t feel like booking a flight. In every neighbourhood, there are
              skilled tradespeople who know their work, and homeowners who need repairs done right
              away.
            </p>
            <p>
              Traditional marketplaces take a heavy cut from the fixer and hide who is actually
              showing up. We run on a tradesperson&apos;s work-order concept: direct local repairs,
              verified local identity, live step-by-step accountability, and zero commissions on
              jobs.
            </p>
            <div className="p-4 bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] shadow-hard-sm font-mono text-xs sm:text-sm text-[var(--theme-text-main)]">
              &quot;One job has two copies: one for you, one for the fixer. Same job number, same
              honesty.&quot;
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 8. HELP & FAQ (Native <details> with 2px borders)              */}
      {/* ============================================================== */}
      <section
        id="help"
        className="px-4 py-16 sm:px-8 sm:py-24 bg-[var(--theme-surface-sub)] border-t-2 border-[var(--theme-border)] w-full"
      >
        <div className="max-w-[1024px] mx-auto">
          <div className="border-b-2 border-[var(--theme-border)] pb-6 mb-8">
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-signal block mb-2">
              NEIGHBOURHOOD KNOWLEDGE BASE
            </span>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-[var(--theme-text-main)]">
              Help &amp; Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-[var(--theme-text-soft)] mt-2">
              Plain answers to common questions for both customers and service professionals.
            </p>
          </div>

          {/* Native <details> Accordions */}
          <div className="space-y-0">
            {faqs.map((faq) => (
              <details key={faq.id} className="faq-item group">
                <summary className="text-lg sm:text-xl text-[var(--theme-text-main)] group-hover:text-signal transition-colors">
                  <span>{faq.question}</span>
                  <span className="font-mono text-base font-bold text-signal ml-4 shrink-0 group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="pb-6 pt-1 text-sm sm:text-base text-[var(--theme-text-soft)] leading-relaxed pl-1 pr-6">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 9. DARK FOOTER                                                 */}
      {/* ============================================================== */}
      <footer className="bg-ink text-paper border-t-2 border-ink py-12 px-4 sm:px-8 w-full">
        <div className="max-w-[1440px] mx-auto flex flex-col justify-between gap-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-signal border border-paper rotate-45" />
                <span className="font-display font-extrabold text-2xl text-paper">
                  FixIt <span className="text-signal">Now</span>
                </span>
              </div>
              <p className="font-mono text-xs text-on-dark leading-relaxed">
                Neighbourhood on-demand repairs. Connects verified local tradespeople with home
                service requests within 2 km.
              </p>
              <div className="pt-2">
                <span className="stamp-badge border-paper text-paper bg-ink text-xs">
                  0% JOB COMMISSION
                </span>
              </div>
            </div>

            {/* Customer Column */}
            <div className="font-mono text-xs space-y-2">
              <span className="text-signal font-bold block uppercase tracking-wider mb-2">
                FOR CUSTOMERS
              </span>
              <a
                href="#services"
                className="block text-on-dark hover:text-paper transition-colors py-1"
              >
                Browse Services
              </a>
              <a
                href="#how-it-works"
                className="block text-on-dark hover:text-paper transition-colors py-1"
              >
                How Matching Works
              </a>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'customer', action: 'signup' })}
                className="block text-on-dark hover:text-paper transition-colors py-1 text-left"
              >
                Create Customer Account
              </button>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'customer', action: 'login' })}
                className="block text-on-dark hover:text-paper transition-colors py-1 text-left"
              >
                Customer Portal Login
              </button>
            </div>

            {/* Partner Column */}
            <div className="font-mono text-xs space-y-2">
              <span className="text-signal font-bold block uppercase tracking-wider mb-2">
                FOR PARTNERS
              </span>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'partner', action: 'signup' })}
                className="block text-on-dark hover:text-paper transition-colors py-1 text-left"
              >
                Register as Partner
              </button>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'partner', action: 'login' })}
                className="block text-on-dark hover:text-paper transition-colors py-1 text-left"
              >
                Partner Dashboard Login
              </button>
              <a
                href="#why-fixit"
                className="block text-on-dark hover:text-paper transition-colors py-1"
              >
                Subscription Pricing (0% Cut)
              </a>
              <a
                href="#help"
                className="block text-on-dark hover:text-paper transition-colors py-1"
              >
                KYC Verification Rules
              </a>
            </div>

            {/* System / Specs Column */}
            <div className="font-mono text-xs space-y-2">
              <span className="text-signal font-bold block uppercase tracking-wider mb-2">
                ADMIN &amp; SPECS
              </span>
              <a
                href="/api/health"
                target="_blank"
                rel="noreferrer"
                className="block text-on-dark hover:text-paper transition-colors py-1"
              >
                Server Health Diagnostic (GET)
              </a>
              <button
                type="button"
                onClick={() => setAuthModal({ role: 'admin', action: 'login' })}
                className="block text-on-dark hover:text-paper transition-colors py-1 text-left"
              >
                Admin Login (/admin/login)
              </button>
              <span className="block text-muted pt-2">SRS V1.0 · 2 KM MATCHING RADIUS</span>
              <span className="block text-muted">SIMULATED PAYMENTS &amp; GPS</span>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t-2 border-[#3A3F47] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-on-dark">
            <div>
              &copy; {new Date().getFullYear()} FixIt Now. All rights reserved. Tradesperson Work
              Order System.
            </div>
            <div className="flex gap-4">
              <a href="#help" className="hover:text-paper underline">
                Help &amp; FAQ
              </a>
              <span className="text-muted">·</span>
              <span className="text-muted">Phase 2 Landing Page</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* AUTHENTICATION / ACCESS MODAL                                 */}
      {/* ============================================================== */}
      {authModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-md w-full shadow-hard relative"
            style={{ borderRadius: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink pb-4 mb-6">
              <span className="font-mono text-xs uppercase tracking-widest text-signal font-bold">
                {authModal.role.toUpperCase()} PORTAL DISPATCH
              </span>
              <button
                type="button"
                onClick={() => setAuthModal(null)}
                className="w-8 h-8 border-2 border-ink bg-concrete font-mono font-bold text-ink hover:bg-signal hover:text-ink flex items-center justify-center"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <h3 className="font-display font-extrabold text-2xl text-ink">
                {authModal.action === 'signup'
                  ? `Join as ${authModal.role === 'customer' ? 'Customer' : 'Partner'}`
                  : `${authModal.role.toUpperCase()} Login`}
              </h3>
              <p className="text-sm text-soft leading-relaxed">
                {authModal.role === 'customer'
                  ? 'Request immediate home fixes within 2 km, follow verified partners live, and confirm work with a service OTP.'
                  : authModal.role === 'partner'
                    ? 'Offer exactly one certified trade category, submit KYC documents, and keep 100% of your repair earnings.'
                    : 'Platform administration at /admin/login. Monitor requests, inspect KYC, and update plan prices.'}
              </p>

              <div className="p-3 bg-concrete border border-ink font-mono text-xs text-soft">
                <span className="font-bold text-ink block mb-1">PHASE 2 WORK ORDER STATE:</span>
                Authentication routing &amp; session tokens are scheduled for Phase 3 (Prompt 6).
                Sample accounts will be verified.
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModal(null)}
                  className="btn-primary w-full min-h-[44px]"
                >
                  Understood — Return to Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
