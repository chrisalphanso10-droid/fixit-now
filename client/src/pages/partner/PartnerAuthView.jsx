/**
 * FixIt Now - Partner Auth Screen
 * Partner Registration (with single certified trade category selection),
 * Partner Login (with quick demo scenario logins), and Forgot Password with OTP.
 * Conforms to SRS FR-P1, FR-P2, FR-C2, FR-C4 and docs/DESIGN.md.
 */

import { useState, useEffect } from 'react';
import {
  partnerLogin,
  partnerRegister,
  sendPartnerForgotPasswordOtp,
  resetPartnerPasswordWithOtp,
} from '../../services/authService';
import { getServices } from '../../services/serviceService';
import { useAuth } from '../../context/AuthContext';

export default function PartnerAuthView({
  initialMode = 'login', // 'login' | 'register' | 'forgot'
  onSuccess,
  onNavigateToCustomerAuth,
  onCancel,
}) {
  const { loginPartner: authLoginPartner, registerPartner: authRegisterPartner } = useAuth() || {};
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'

  // Login form state
  const [loginEmail, setLoginEmail] = useState('rajesh@example.com');
  const [loginPassword, setLoginPassword] = useState('Partner@2026');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regVehicle, setRegVehicle] = useState('Hero Splendor / Motorcycle');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  // SRS FR-P1: Partners choose EXACTLY ONE certified service category
  const [servicesList, setServicesList] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getServices().then((svcs) => {
      if (isMounted && Array.isArray(svcs) && svcs.length > 0) {
        setServicesList(svcs);
        setSelectedServiceId((prev) => prev || svcs[0].id);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('rajesh@example.com');
  const [forgotStep, setForgotStep] = useState(1); // 1: send OTP, 2: enter OTP & reset
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Quick 1-click demo logins using real seeded partner accounts
  const handleDemoLogin = async (scenarioType) => {
    setLoading(true);
    setError(null);
    try {
      let email = 'rajesh@example.com';
      let password = 'Partner@2026';
      if (scenarioType === 'pending_kyc') {
        email = 'sunil.carpenter@fixitnow.local';
      } else if (scenarioType === 'rejected_kyc') {
        email = 'vikram.appliance@fixitnow.local';
      } else if (scenarioType === 'warning_plan') {
        email = 'ramesh.electric@fixitnow.local';
      } else if (scenarioType === 'expired_plan') {
        email = 'dinesh.mason@fixitnow.local';
      } else if (scenarioType === 'new_partner') {
        email = 'naveen.lock@fixitnow.local';
      }
      const partner = authLoginPartner
        ? await authLoginPartner(email, password)
        : await partnerLogin(email, password);
      if (onSuccess) onSuccess(partner);
    } catch (err) {
      setError(`! ${err.message || 'Demo login failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanId = loginEmail.trim();
    if (!cleanId) {
      setError('! Please enter your registered partner email or phone number.');
      return;
    }
    if (cleanId.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId)) {
      setError('! Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const partner = authLoginPartner
        ? await authLoginPartner(loginEmail, loginPassword)
        : await partnerLogin(loginEmail, loginPassword);
      if (onSuccess) onSuccess(partner);
    } catch (err) {
      setError(`! ${err.message || 'Login failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Registration (SRS FR-P1 & FR-C2)
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
      setError('! Please enter a complete operating address (at least 5 characters).');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('! Password and Confirm Password do not match.');
      return;
    }

    if (!selectedServiceId) {
      setError('! You must select exactly one certified service trade category (SRS FR-P1).');
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
        vehicle: regVehicle?.trim() || 'Two-Wheeler',
        service_id: Number(selectedServiceId),
        password: regPassword,
      };
      const newPartner = authRegisterPartner
        ? await authRegisterPartner(regData)
        : await partnerRegister(regData);

      setSuccessMessage('Registration successful! Proceeding to subscription plan selection...');
      setTimeout(() => {
        if (onSuccess) onSuccess(newPartner, 'plan-selection');
      }, 700);
    } catch (err) {
      setError(`! ${err.message || 'Registration failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send Forgot Password OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setError('! Please enter a valid partner email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await sendPartnerForgotPasswordOtp(forgotEmail);
      setForgotStep(2);
      setSuccessMessage(res.message);
    } catch (err) {
      setError(`! ${err.message || 'Failed to send OTP.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password with OTP
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
      const res = await resetPartnerPasswordWithOtp(forgotEmail, forgotOtp, newPassword);
      setSuccessMessage(`${res.message} Please log in with your new password.`);
      setTimeout(() => {
        setMode('login');
        setForgotStep(1);
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setLoginEmail(forgotEmail);
        setLoginPassword(newPassword);
        setSuccessMessage(null);
      }, 1200);
    } catch (err) {
      setError(`! ${err.message || 'Password reset failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-8 shadow-hard text-[var(--theme-text-main)] transition-colors duration-150"
      style={{ borderRadius: 0 }}
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--theme-border)] pb-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-signal inline-block" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
            PARTNER WORK ORDER DISPATCH
          </span>
        </div>
        <span className="border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-soft)] px-2 py-0.5 font-mono text-[11px] font-bold self-start sm:self-auto">
          0% COMMISSION
        </span>
      </div>

      {/* Mode Switch Tabs (Min 44px height) */}
      <div className="grid grid-cols-2 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] p-1 gap-1 mb-6">
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
              : 'text-[var(--theme-text-soft)] hover:text-[var(--theme-text-main)]'
          }`}
        >
          Partner Login
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
              : 'text-[var(--theme-text-soft)] hover:text-[var(--theme-text-main)]'
          }`}
        >
          Partner Register
        </button>
      </div>

      {/* Alert / Error Box */}
      {error && (
        <div
          role="alert"
          className="border-2 border-signal bg-paper text-ink p-3 mb-5 font-mono text-xs font-bold shadow-hard-sm"
        >
          {error}
        </div>
      )}

      {/* Success Notification Box */}
      {successMessage && (
        <div
          role="status"
          className="border-2 border-done bg-paper text-ink p-3 mb-5 font-mono text-xs font-bold shadow-hard-sm"
        >
          ✓ {successMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. LOGIN MODE                                                  */}
      {/* ============================================================== */}
      {mode === 'login' && (
        <div className="space-y-6">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="partner-login-email"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Partner Phone or Email <span className="text-signal">*</span>
              </label>
              <input
                id="partner-login-email"
                type="text"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g., rajesh@example.com or 9876543210"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="partner-login-password"
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                >
                  Password <span className="text-signal">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotEmail(loginEmail);
                    setError(null);
                  }}
                  className="font-mono text-xs text-signal hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                id="partner-login-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-[48px] text-sm uppercase tracking-wider font-bold shadow-hard"
            >
              {loading ? 'AUTHENTICATING PARTNER...' : 'ENTER PARTNER RADAR →'}
            </button>
          </form>

          {/* Quick Demo Scenario Switcher (SRS Section 6 Data) */}
          <div className="border-2 border-dashed border-[var(--theme-border)] p-4 bg-[var(--theme-bg)]">
            <span className="font-mono text-[11px] font-bold text-[var(--theme-text-soft)] uppercase tracking-wider block mb-2">
              QUICK TEST SCENARIOS (SAMPLE DATA SEC. 6):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleDemoLogin('verified')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Rajesh Kumar</span>
                  <span className="text-[10px] text-done">● Verified</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  Plumber · Active Plan (108d)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('pending_kyc')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Sunil Mistry</span>
                  <span className="text-[10px] text-signal">● KYC Pending</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  Carpenter · Needs Approval
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('rejected_kyc')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Vikram Joshi</span>
                  <span className="text-[10px] text-signal font-bold">● KYC Rejected</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  Appliance · Blurred ID Doc
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('warning_plan')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Kiran Patel</span>
                  <span className="text-[10px] text-signal">● Warning (2d)</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  AC Tech · Expiry Alert
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('expired_plan')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Dinesh Nair</span>
                  <span className="text-[10px] text-[var(--theme-text-soft)]">● Plan Expired</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  Mason · Lockout Screen
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('new_partner')}
                className="p-2 border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-signal hover:text-ink text-left font-bold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span>Mohan Sharma</span>
                  <span className="text-[10px] text-[var(--theme-text-soft)]">● Fresh Register</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-soft)]">
                  Electrician · Unsubscribed
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. REGISTRATION MODE (SRS FR-P1 & FR-C2)                       */}
      {/* ============================================================== */}
      {mode === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="partner-reg-name"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Full Name <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g., Mohan Sharma"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>

            <div>
              <label
                htmlFor="partner-reg-phone"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Mobile Number <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-phone"
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+91 98111 22334"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="partner-reg-email"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Email Address <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="mohan@example.com"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>

            <div>
              <label
                htmlFor="partner-reg-vehicle"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Vehicle / Transport Mode <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-vehicle"
                type="text"
                required
                value={regVehicle}
                onChange={(e) => setRegVehicle(e.target.value)}
                placeholder="e.g., Honda Activa / Motorcycle"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="partner-reg-address"
              className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
            >
              Base Operating Address in City <span className="text-signal">*</span>
            </label>
            <textarea
              id="partner-reg-address"
              rows={2}
              required
              value={regAddress}
              onChange={(e) => setRegAddress(e.target.value)}
              placeholder="e.g., 22, HAL Airport Road, Kodihalli, Bengaluru"
              className="w-full p-2.5 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
            />
          </div>

          {/* ============================================================== */}
          {/* SRS FR-P1: EXACTLY ONE CERTIFIED TRADE SELECTION                */}
          {/* ============================================================== */}
          <div className="border-2 border-[var(--theme-border)] p-3 sm:p-4 bg-[var(--theme-bg)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
                Select Your Certified Trade <span className="text-signal">*</span>
              </span>
              <span className="font-mono text-[10px] bg-ink text-paper px-2 py-0.5 font-bold self-start sm:self-auto">
                SRS FR-P1: EXACTLY 1 TRADE
              </span>
            </div>
            <p className="font-mono text-[11px] text-[var(--theme-text-soft)] mb-3 leading-relaxed">
              FixIt Now partners specialize in exactly one certified category to ensure premium trade quality.
              You will submit trade license/qualifications in KYC for this category.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {servicesList.map((service) => {
                const isSelected = selectedServiceId === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`p-3 border-2 text-left transition-all min-h-[58px] flex flex-col justify-between ${
                      isSelected
                        ? 'border-signal bg-paper text-ink shadow-hard-sm'
                        : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-main)] hover:border-signal'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-display font-bold text-xs">{service.name}</span>
                      <span
                        className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${
                          isSelected ? 'border-signal bg-signal' : 'border-[var(--theme-border)]'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 bg-ink" />}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--theme-text-soft)]">
                      {isSelected ? 'SELECTED TRADE' : 'SELECT'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="partner-reg-password"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Password <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-password"
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Min 8 chars, 1 num, 1 sym"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
              <span className="font-mono text-[10px] text-[var(--theme-text-muted)] block mt-1">
                Must include upper, lower, number, special char (FR-C2).
              </span>
            </div>

            <div>
              <label
                htmlFor="partner-reg-confirm-password"
                className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
              >
                Confirm Password <span className="text-signal">*</span>
              </label>
              <input
                id="partner-reg-confirm-password"
                type="password"
                required
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full min-h-[48px] text-sm uppercase tracking-wider font-bold shadow-hard"
          >
            {loading ? 'REGISTERING PARTNER...' : 'COMPLETE REGISTRATION & SELECT PLAN →'}
          </button>
        </form>
      )}

      {/* ============================================================== */}
      {/* 3. FORGOT PASSWORD MODE (SRS FR-C4)                            */}
      {/* ============================================================== */}
      {mode === 'forgot' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2 mb-2">
            <h3 className="font-display font-bold text-lg">Partner Password Recovery</h3>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className="font-mono text-xs text-signal underline"
            >
              ← Back to Login
            </button>
          </div>

          {forgotStep === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <p className="font-mono text-xs text-[var(--theme-text-soft)] leading-relaxed">
                Enter your registered partner email to receive a 6-digit recovery code.
              </p>
              <div>
                <label
                  htmlFor="partner-forgot-email"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  Partner Email
                </label>
                <input
                  id="partner-forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="rajesh@example.com"
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full min-h-[44px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
              >
                {loading ? 'SENDING OTP...' : 'SEND 6-DIGIT RECOVERY OTP →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="border border-[var(--theme-border)] bg-paper p-3 font-mono text-xs text-ink">
                <span className="font-bold text-signal block mb-1">[CONSOLE DISPATCH]:</span>
                The 6-digit recovery OTP has been logged to your <strong>server console terminal</strong>. Check your backend terminal window and enter the code below.
              </div>

              <div>
                <label
                  htmlFor="partner-forgot-otp"
                  className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                >
                  Enter 6-Digit Code <span className="text-signal">*</span>
                </label>
                <input
                  id="partner-forgot-otp"
                  type="text"
                  required
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  placeholder="619042"
                  className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-lg tracking-widest text-center focus:outline-none focus:border-signal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="partner-new-pw"
                    className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                  >
                    New Password
                  </label>
                  <input
                    id="partner-new-pw"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
                  />
                </div>
                <div>
                  <label
                    htmlFor="partner-confirm-new-pw"
                    className="block font-mono text-xs font-bold uppercase tracking-wider mb-1"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="partner-confirm-new-pw"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter"
                    className="w-full min-h-[44px] px-3 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-sm focus:outline-none focus:border-signal"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full min-h-[44px] font-mono text-xs font-bold uppercase tracking-wider shadow-hard"
              >
                {loading ? 'RESETTING PASSWORD...' : 'SAVE NEW PASSWORD & PROCEED →'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Footer Switcher to Customer Auth / Exit */}
      <div className="mt-6 pt-4 border-t border-[var(--theme-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[var(--theme-text-soft)]">
        <div>
          <span>Are you a customer needing a repair? </span>
          <button
            type="button"
            onClick={onNavigateToCustomerAuth}
            className="text-signal underline hover:text-[var(--theme-text-main)] font-bold"
          >
            Customer Login / Signup
          </button>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="underline hover:text-signal"
          >
            ← Return to Homepage
          </button>
        )}
      </div>
    </div>
  );
}
