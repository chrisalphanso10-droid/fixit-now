/**
 * FixIt Now - Customer Auth Screen
 * Customer Registration, Login, and Forgot Password with OTP.
 * Conforms to SRS FR-C1, FR-C2, FR-C3, FR-C4 and docs/DESIGN.md.
 */

import { useState } from 'react';
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
  const { loginCustomer: authLoginCustomer, registerCustomer: authRegisterCustomer } = useAuth() || {};
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [showPartnerNotice, setShowPartnerNotice] = useState(false);

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

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('ananya@example.com');
  const [forgotStep, setForgotStep] = useState(1); // 1: send OTP, 2: enter OTP & reset
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState(null);

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
    if (regPassword !== regConfirmPassword) {
      setError('! Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const regData = {
        name: regName,
        email: regEmail,
        phone: regPhone,
        address: regAddress,
        password: regPassword,
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
    setLoading(true);
    setError(null);
    try {
      const res = await sendForgotPasswordOtp(forgotEmail);
      setForgotStep(2);
      setDemoOtpHint(res.demoOtp);
      setSuccessMessage(`OTP sent to ${forgotEmail}.`);
    } catch (err) {
      setError(`! ${err.message || 'Failed to send OTP.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Forgot Password Step 2: Reset Password (SRS FR-C4)
  const handleResetPassword = async (e) => {
    e.preventDefault();
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
    <div className="max-w-md mx-auto my-6">
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

        {/* Role Helper Switcher */}
        <div className="bg-concrete border border-ink p-2.5 flex items-center justify-between text-xs font-mono">
          <span className="text-soft">
            {mode === 'login' ? 'Are you a certified tradesperson?' : 'Want to offer repair services?'}
          </span>
          <button
            type="button"
            onClick={() => setShowPartnerNotice(true)}
            className="font-bold underline text-ink hover:text-signal transition-colors ml-2 shrink-0"
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
              className="w-full py-1.5 border border-dashed border-ink font-mono text-xs text-soft hover:bg-concrete transition-colors"
            >
              ⚡ Fill Demo Credentials (ananya@example.com)
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-[46px] text-sm mt-2"
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
                {demoOtpHint && (
                  <div className="p-2.5 bg-concrete border border-signal font-mono text-xs text-signal font-bold">
                    Demo Code: {demoOtpHint}
                  </div>
                )}

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

      {/* Partner Notice Modal */}
      {showPartnerNotice && (
        <div
          className="fixed inset-0 z-50 bg-ink/75 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPartnerNotice(false);
          }}
        >
          <div
            className="bg-paper border-2 border-ink p-6 sm:p-8 max-w-lg w-full shadow-hard relative my-auto text-ink"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink pb-4 mb-5 font-mono text-xs">
              <span className="uppercase tracking-widest text-signal font-bold">
                PARTNER WORK ORDER DISPATCH
              </span>
              <button
                type="button"
                onClick={() => setShowPartnerNotice(false)}
                className="w-8 h-8 border-2 border-ink bg-concrete font-bold text-ink hover:bg-signal flex items-center justify-center transition-colors"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-2xl text-ink">
                  Partner Portal Access
                </h3>
                <span className="px-2 py-0.5 border border-ink bg-concrete font-mono text-[10px] font-bold">
                  PROMPT 3
                </span>
              </div>

              <p className="text-sm text-soft leading-relaxed">
                FixIt Now operates on a verified, flat-subscription model with <strong>0% commission</strong>.
                Partners keep 100% of customer repair charges settled directly on-site.
              </p>

              <div className="border border-ink bg-concrete p-3 space-y-2 font-mono text-xs">
                <span className="font-bold text-ink block border-b border-ink/30 pb-1">
                  SRS SPECIFICATION HIGHLIGHTS:
                </span>
                <div className="flex items-start gap-1.5">
                  <span className="text-signal font-bold">•</span>
                  <span><strong>1 Trade per Partner:</strong> Select exactly one certified service.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-signal font-bold">•</span>
                  <span><strong>KYC Verification:</strong> Government photo ID &amp; address proof.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-signal font-bold">•</span>
                  <span><strong>Subscription Plans:</strong> ₹49 Daily Pass or ₹999 Monthly Pass.</span>
                </div>
              </div>

              {/* Sample Demo Account Credentials from Section 6 of SRS */}
              <div className="border border-dashed border-ink p-3 bg-paper font-mono text-xs">
                <span className="font-bold block text-ink mb-1">DEMO PARTNER CREDENTIALS (SRS SEC. 6):</span>
                <div className="text-soft">
                  Name: <span className="text-ink font-bold">Rajesh Kumar (Electrician · 4.9 ★)</span>
                </div>
                <div className="text-soft">
                  Email: <span className="text-ink font-bold">rajesh@example.com</span>
                </div>
                <div className="text-soft">
                  Password: <span className="text-ink font-bold">Partner@2026</span>
                </div>
                <div className="mt-2 text-[11px] text-signal font-bold">
                  * Full partner dispatch radar and job accept/decline queue launches in Prompt 3.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartnerNotice(false)}
                  className="btn-primary w-full min-h-[44px] text-xs font-mono font-bold"
                >
                  Understood — Return to Customer Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
