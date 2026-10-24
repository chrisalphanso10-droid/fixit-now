/**
 * FixIt Now - Customer Auth Screen
 * Customer Registration, Login, and Forgot Password with OTP.
 * Conforms to SRS FR-C1, FR-C2, FR-C3, FR-C4 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  customerLogin,
  customerRegister,
  sendForgotPasswordOtp,
  resetPasswordWithOtp,
} from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

export default function CustomerAuthView({
  initialMode = 'login', // 'login' | 'register' | 'forgot'
  onSuccess,
  onCancel,
}) {
  const {
    user,
    role,
    isAuthenticated,
    logout: authLogout,
    loginCustomer: authLoginCustomer,
    registerCustomer: authRegisterCustomer,
  } = useAuth() || {};
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Login state
  const [loginEmail, setLoginEmail] = useState('ananya@example.com');
  const [loginPassword, setLoginPassword] = useState('FixIt@2026');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('ananya@example.com');
  const [forgotStep, setForgotStep] = useState(1); // 1: send OTP, 2: enter OTP & reset
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Quick autofill demo credentials
  const handleAutofillDemo = () => {
    setLoginEmail('ananya@example.com');
    setLoginPassword('FixIt@2026');
    setError(null);
  };

  // Submit Login (SRS FR-C3)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setError('! Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = authLoginCustomer
        ? await authLoginCustomer(loginEmail, loginPassword)
        : await customerLogin(loginEmail, loginPassword);
      if (onSuccess) onSuccess(user);
    } catch (err) {
      setError(`! ${err.message || 'Login failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Registration (SRS FR-C1 & FR-C2)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regAddress.trim() || !regPassword) {
      setError('! All registration fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setError('! Please enter a valid email address.');
      return;
    }
    const cleanPhoneDigits = regPhone.trim().replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10) {
      setError('! Please enter a valid phone number (at least 10 digits).');
      return;
    }
    if (regAddress.trim().length < 5) {
      setError('! Please enter a complete service address (at least 5 characters).');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('! Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('! You must read and agree to the Terms and Conditions to register.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const regData = {
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        address: regAddress.trim(),
        password: regPassword,
        terms_accepted: termsAccepted,
      };
      const user = authRegisterCustomer
        ? await authRegisterCustomer(regData)
        : await customerRegister(regData);
      if (onSuccess) onSuccess(user);
    } catch (err) {
      setError(`! ${err.message || 'Registration failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Forgot Password Step 1: Send OTP (SRS FR-C4)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setError('! Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendForgotPasswordOtp(forgotEmail);
      setForgotStep(2);
      setSuccessMessage(`Verification OTP generated for ${forgotEmail}. Please check your server terminal console.`);
    } catch (err) {
      setError(`! ${err.message || 'Failed to send OTP.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Forgot Password Step 2: Reset Password (SRS FR-C4)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(forgotOtp.trim())) {
      setError('! Verification code must be exactly 6 numeric digits.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('! Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordWithOtp(forgotEmail, forgotOtp, newPassword);
      setSuccessMessage('Password reset successfully! Please log in.');
      setMode('login');
      setLoginEmail(forgotEmail);
      setLoginPassword(newPassword);
      setForgotStep(1);
    } catch (err) {
      setError(`! ${err.message || 'Failed to reset password.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 px-4 sm:px-0">
      <div className="bg-paper border-2 border-ink p-6 sm:p-8 shadow-hard text-ink space-y-6">
        {/* Ticket Header */}
        <div className="flex items-center justify-between border-b-2 border-ink pb-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-paper border-2 border-ink inline-block" />
            <span className="font-bold uppercase tracking-wider">
              {mode === 'login'
                ? 'CUSTOMER LOGIN'
                : mode === 'register'
                ? 'CUSTOMER REGISTRATION'
                : 'FORGOT PASSWORD (OTP)'}
            </span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-bold hover:text-signal"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Mode Switch Tabs (Min 44px touch target) */}
        <div className="grid grid-cols-2 border-2 border-ink bg-concrete p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`min-h-[44px] font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              mode === 'login'
                ? 'bg-ink text-paper shadow-hard-sm'
                : 'text-soft hover:text-ink hover:bg-paper'
            }`}
          >
            Sign In (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`min-h-[44px] font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              mode === 'register'
                ? 'bg-ink text-paper shadow-hard-sm'
                : 'text-soft hover:text-ink hover:bg-paper'
            }`}
          >
            Register (New Account)
          </button>
        </div>

        {/* Active Session Info if already logged in */}
        {isAuthenticated && user && (
          <div className="p-3 bg-concrete border-2 border-ink font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="truncate mr-2">
                Active Session: <strong>{user.name}</strong> ({role})
              </span>
              <button
                type="button"
                onClick={() => {
                  if (authLogout) authLogout();
                  else localStorage.clear();
                  setError(null);
                  setSuccessMessage('Logged out. You can now sign in.');
                }}
                className="text-signal underline font-bold uppercase shrink-0"
              >
                [Switch / Log Out]
              </button>
            </div>
            <div className="text-[11px] text-soft">
              Want to use your active session?{' '}
              <a
                href={
                  role === 'customer'
                    ? '#/customer/dashboard'
                    : role === 'partner'
                    ? '#/partner/dashboard'
                    : '#/admin/dashboard'
                }
                className="text-ink font-bold underline hover:text-signal"
              >
                Continue to Dashboard →
              </a>
            </div>
          </div>
        )}

        {/* Role Helper Switcher */}
        <div className="bg-concrete border border-ink p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <span className="text-soft">
            {mode === 'login' ? 'Are you a certified tradesperson?' : 'Want to offer repair services?'}
          </span>
          <button
            type="button"
            onClick={() => {
              window.location.hash = mode === 'login' ? '/partner/login' : '/partner/register';
            }}
            className="font-bold underline text-ink hover:text-signal transition-colors shrink-0 text-left sm:text-right"
          >
            {mode === 'login' ? 'Partner Login →' : 'Partner Sign up →'}
          </button>
        </div>

        {/* Global Alerts */}
        {error && (
          <div className="p-3 bg-ink text-paper border-2 border-signal shadow-hard-signal font-mono text-xs font-bold">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-concrete border-2 border-done text-done font-mono text-xs font-bold">
            ✓ {successMessage}
          </div>
        )}

        {/* ============================================================ */}
        {/* 1. LOGIN FORM (SRS FR-C3)                                    */}
        {/* ============================================================ */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-login-email" className="block font-sans font-bold text-sm">
                Email Address
              </label>
              <input
                id="auth-login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-login-pass" className="block font-sans font-bold text-sm">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setMode('forgot');
                  }}
                  className="font-mono text-xs underline text-soft hover:text-signal"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="auth-login-pass"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-[46px] text-sm mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In as Customer →'}
            </button>

            {/* Demo Quick-Fill Button */}
            <button
              type="button"
              onClick={handleAutofillDemo}
              className="w-full py-2 px-2 border border-dashed border-ink font-mono text-xs text-soft hover:bg-concrete transition-colors truncate"
              title="Fill demo customer credentials"
            >
              [DEMO] Fill: ananya@example.com
            </button>

            <div className="pt-4 border-t-2 border-dashed border-ink text-center font-mono text-xs">
              <span className="text-soft">Need an account? </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('register');
                }}
                className="font-bold underline text-ink hover:text-signal uppercase"
              >
                Register Here
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* 2. REGISTRATION FORM (SRS FR-C1 & FR-C2)                      */}
        {/* ============================================================ */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="block font-sans font-bold text-sm">
                Full Name <span className="text-signal">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ananya Sharma"
                required
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block font-sans font-bold text-sm">
                Email Address <span className="text-signal">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="ananya@example.com"
                required
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-phone" className="block font-sans font-bold text-sm">
                Phone Number <span className="text-signal">*</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-addr" className="block font-sans font-bold text-sm">
                Service Street Address <span className="text-signal">*</span>
              </label>
              <textarea
                id="reg-addr"
                rows={2}
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                placeholder="42, 3rd Cross, Indiranagar, Bengaluru"
                required
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-pass" className="block font-sans font-bold text-sm">
                Password <span className="text-signal">*</span>
              </label>
              <input
                id="reg-pass"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Min 6 chars + 1 special symbol"
                required
                className="w-full text-sm"
              />
              <span className="font-mono text-[10px] text-soft block">
                Rule (FR-C2): At least 6 characters &amp; 1 special symbol (!@#$%^&amp;*).
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="block font-sans font-bold text-sm">
                Confirm Password <span className="text-signal">*</span>
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                required
                className="w-full text-sm"
              />
            </div>

            {/* Required Terms and Conditions Checkbox (ITEM 2) */}
            <div className="pt-2">
              <label
                htmlFor="customer-terms-checkbox"
                className="flex items-start gap-2.5 cursor-pointer text-xs font-mono leading-relaxed select-none"
              >
                <input
                  id="customer-terms-checkbox"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded-none border-2 border-ink text-signal focus:ring-0 cursor-pointer"
                />
                <span>
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="font-bold underline text-ink hover:text-signal"
                  >
                    Terms and Conditions
                  </button>
                  <span className="text-signal ml-0.5">*</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="btn-primary w-full min-h-[46px] text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Complete Customer Registration →'}
            </button>

            <div className="pt-4 border-t-2 border-dashed border-ink text-center font-mono text-xs">
              <span className="text-soft">Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
                className="font-bold underline text-ink hover:text-signal uppercase"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* 3. FORGOT PASSWORD WITH OTP (SRS FR-C4)                       */}
        {/* ============================================================ */}
        {mode === 'forgot' && (
          <div>
            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-soft font-mono">
                  Enter your registered email address. We will generate a one-time verification
                  password (OTP).
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="block font-sans font-bold text-sm">
                    Account Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full min-h-[46px] text-sm"
                >
                  {loading ? 'Sending OTP...' : 'Send Verification OTP →'}
                </button>

                <div className="pt-2 text-center font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="underline text-soft hover:text-signal"
                  >
                    ← Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 bg-concrete border-2 border-[var(--theme-border)] font-mono text-xs text-[var(--theme-text-main)] space-y-1">
                  <div className="text-signal font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>[CONSOLE DISPATCH]</span>
                  </div>
                  <div className="text-xs text-[var(--theme-text-soft)]">
                    The 6-digit OTP code has been logged to your <strong>server console terminal</strong>. Check your backend terminal window and enter the code below.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="otp-input" className="block font-sans font-bold text-sm">
                    6-Digit OTP Code
                  </label>
                  <input
                    id="otp-input"
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="427001"
                    required
                    className="w-full font-mono text-center tracking-widest text-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-pass" className="block font-sans font-bold text-sm">
                    New Password (Min 6 chars + 1 special char)
                  </label>
                  <input
                    id="new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-new-pass" className="block font-sans font-bold text-sm">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-pass"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className="w-full text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full min-h-[46px] text-sm"
                >
                  {loading ? 'Updating Password...' : 'Verify OTP & Reset Password →'}
                </button>

                <div className="pt-2 text-center font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="underline text-soft hover:text-signal"
                  >
                    ← Re-send OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Customer Terms and Conditions Modal (ITEM 2) */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper border-2 border-ink max-w-lg w-full p-6 shadow-hard text-ink font-mono relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <h3 className="font-display font-extrabold text-base tracking-wider uppercase">
                Customer Terms and Conditions
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-2 py-0.5 border border-ink bg-concrete font-bold text-xs hover:bg-signal hover:text-ink"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans leading-relaxed text-ink/90">
              <p className="font-mono text-[11px] text-soft uppercase tracking-wider">
                Version 1.0 · Customer Agreement
              </p>
              <ol className="list-decimal pl-5 space-y-3 font-medium">
                <li>
                  I confirm that the details I provide are genuine and that I am registering only to get a real problem fixed.
                </li>
                <li>
                  I have no bad or harmful intentions toward any partner, their property or anyone else.
                </li>
                <li>
                  I will treat partners respectfully and give accurate information about the problem and the address.
                </li>
                <li>
                  I understand that FixIt Now is a platform that connects customers with independent partners. FixIt Now is not responsible for the conduct of any customer or partner, or for any loss, damage or dispute that arises between them. By accepting these terms, I accept responsibility for my own actions and agree that any issue is between me and the partner involved.
                </li>
              </ol>
            </div>

            <div className="mt-6 pt-4 border-t border-ink/20 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
                className="w-full min-h-[40px] border-2 border-ink bg-signal text-ink font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm hover:opacity-95"
              >
                ✓ I Agree to Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
