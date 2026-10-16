/**
 * FixIt Now - Admin Login View
 * Route: /admin/login
 * Conforms to SRS FR-A1:
 * - Login only, strictly NO registration.
 * - One pre-created administrator account.
 * - Industrial ticket layout with hard shadows, 2px ink borders, DM Mono labels.
 */

import { useState } from 'react';
import { adminLogin } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginView({ onSuccess, onCancel }) {
  const { loginAdmin: authLoginAdmin } = useAuth() || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid administrator email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const session = authLoginAdmin
        ? await authLoginAdmin(cleanEmail, password)
        : await adminLogin(cleanEmail, password);
      onSuccess(session);
    } catch (err) {
      setError(err.message || 'Failed to authenticate administrator account.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@fixitnow.local');
    setPassword('Admin@2026');
    setError(null);
  };

  return (
    <div className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-8 shadow-hard relative">
      {/* Ticket Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-4 mb-6">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-signal border border-[var(--theme-border)] rotate-45 inline-block shrink-0" />
          ADMIN DISPATCH ACCESS · FR-A1
        </span>
        <span className="stamp-badge text-[10px] bg-ink text-paper border-ink self-start sm:self-auto">
          RESTRICTED
        </span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--theme-text-main)] mb-2">
          Admin Portal Login
        </h2>
        <p className="text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Authorized dispatch personnel only. Strictly no registration. Review KYC dossiers,
          manage service categories, adjust plan prices, and monitor live city operations.
        </p>
      </div>

      {/* Demo Credentials Box */}
      <div className="p-3.5 bg-[var(--theme-surface-sub)] border-2 border-dashed border-[var(--theme-border)] mb-6 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <span className="font-bold text-[var(--theme-text-main)] uppercase tracking-wider">
            PRE-CONFIGURED ROOT ACCOUNT:
          </span>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-signal font-bold hover:underline underline-offset-2 self-start sm:self-auto"
          >
            [AUTO-FILL]
          </button>
        </div>
        <div className="space-y-0.5 text-[var(--theme-text-soft)]">
          <div>Email: <strong className="text-[var(--theme-text-main)]">admin@fixitnow.local</strong></div>
          <div>Password: <strong className="text-[var(--theme-text-main)]">Admin@2026</strong></div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-[#FFF0ED] dark:bg-[#3D140C] border-2 border-signal text-signal text-xs font-mono font-bold mb-6 flex items-start gap-2">
          <span className="text-base leading-none">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="admin-email"
            className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1.5"
          >
            Administrator Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@fixitnow.local"
            className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-3 text-sm font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>

        <div>
          <label
            htmlFor="admin-password"
            className="block text-xs font-sans font-bold uppercase tracking-wider text-[var(--theme-text-main)] mb-1.5"
          >
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-3 text-sm font-mono text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full sm:flex-1 min-h-[44px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="font-mono text-xs uppercase tracking-wider">Verifying Session...</span>
            ) : (
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Access Admin Portal →</span>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary w-full sm:w-auto px-5 min-h-[44px] text-xs font-mono font-bold"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* FR-A1 Compliance Notice */}
      <div className="mt-6 pt-4 border-t-2 border-dashed border-[var(--theme-border)] text-center font-mono text-[11px] text-[var(--theme-text-muted)]">
        SRS SECTION 3.4 (FR-A1): Administrative registration is permanently disabled.
      </div>
    </div>
  );
}
