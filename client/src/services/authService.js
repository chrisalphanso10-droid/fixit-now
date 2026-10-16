/**
 * FixIt Now - Authentication Service (Customer & Partner Portals)
 * Real REST API client with JWT sessions, password policy validation, and OTP verification.
 * Conforms to SRS FR-C1..FR-C4, FR-P1, FR-P6, Section 5 & docs/PLAN.md Phase 3.
 */

import { post } from './api';

const AUTH_TOKEN_KEY = 'fixit_token';
const AUTH_USER_KEY = 'fixit_user';
const AUTH_ROLE_KEY = 'fixit_role';

// Portal-specific keys preserved for backwards compatibility with existing UI components
const CUSTOMER_USER_KEY = 'fixit_customer_user';
const PARTNER_USER_KEY = 'fixit_partner_user';
const CURRENT_PARTNER_KEY = 'fixit_current_partner';

function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fixit_auth_change'));
  }
}

/**
 * Validates password per SRS FR-C2:
 * At least 6 characters and contains at least one special character.
 * @param {string} password
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
  if (!specialCharRegex.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
  }
  return { valid: true, error: null };
}

/* ========================================================================== */
/* CUSTOMER AUTHENTICATION (SRS FR-C1, FR-C2, FR-C3, FR-C4)                   */
/* ========================================================================== */

/**
 * Log in customer with email and password
 * Calls POST /api/auth/customer/login
 */
export async function customerLogin(email, password) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const res = await post('/api/auth/customer/login', {
    email: cleanEmail,
    password,
  });

  if (res.token && res.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(AUTH_ROLE_KEY, 'customer');
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(res.user));
    notifyAuthChange();
  }

  return res.user;
}

/**
 * Register a new customer
 * Calls POST /api/auth/customer/register
 */
export async function customerRegister({ name, email, password, phone, address }) {
  if (!name?.trim()) throw new Error('Full name is required.');
  if (!email?.trim()) throw new Error('Email address is required.');
  if (!phone?.trim()) throw new Error('Phone number is required.');
  if (!address?.trim()) throw new Error('Service street address is required.');

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  const res = await post('/api/auth/customer/register', {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    phone: phone.trim(),
    address: address.trim(),
  });

  if (res.token && res.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(AUTH_ROLE_KEY, 'customer');
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(res.user));
    notifyAuthChange();
  }

  return res.user;
}

/**
 * Request OTP for customer forgot password (SRS FR-C4)
 * Calls POST /api/auth/customer/forgot-password
 */
export async function sendForgotPasswordOtp(email) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter your registered email address.');

  const res = await post('/api/auth/customer/forgot-password', { email: cleanEmail });

  return {
    success: true,
    message: res.message || `OTP sent to ${cleanEmail}. (Check server console for code)`,
    demoOtp: res.demoOtp,
  };
}

/**
 * Verify OTP and reset customer password
 * Calls POST /api/auth/customer/reset-password
 */
export async function resetPasswordWithOtp(email, otp, newPassword) {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanOtp = otp?.trim();

  const passCheck = validatePassword(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  const res = await post('/api/auth/customer/reset-password', {
    email: cleanEmail,
    otp: cleanOtp,
    newPassword,
  });

  return {
    success: true,
    message: res.message || 'Password updated successfully. You can now log in.',
  };
}

/**
 * Get current customer session
 */
export function getCurrentCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
    const role = localStorage.getItem(AUTH_ROLE_KEY);
    if (raw && role === 'customer') {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Log out customer
 */
export function customerLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(CUSTOMER_USER_KEY);
  notifyAuthChange();
}

/* ========================================================================== */
/* PARTNER AUTHENTICATION (SRS FR-P1, FR-P2, FR-P6)                           */
/* ========================================================================== */

/**
 * Log in partner with email and password (SRS FR-P6)
 * Calls POST /api/auth/partner/login
 */
export async function partnerLogin(email, password) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const res = await post('/api/auth/partner/login', {
    email: cleanEmail,
    password,
  });

  if (res.token && res.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(AUTH_ROLE_KEY, 'partner');
    localStorage.setItem(PARTNER_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(CURRENT_PARTNER_KEY, JSON.stringify(res.user));
    notifyAuthChange();
  }

  return res.user;
}

/**
 * Register partner with name, email, password, phone, address, and exactly one service category
 * Conforms to SRS FR-P1 & FR-C2
 * Calls POST /api/auth/partner/register
 */
export async function partnerRegister({ name, email, password, phone, address, service_id, vehicle }) {
  const cleanName = name?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPhone = phone?.trim();
  const cleanAddress = address?.trim();
  const numServiceId = Number(service_id);

  if (!cleanName || !cleanEmail || !cleanPhone || !cleanAddress) {
    throw new Error('All registration fields are required.');
  }

  if (!numServiceId) {
    throw new Error('You must select exactly one certified trade service category.');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  const res = await post('/api/auth/partner/register', {
    name: cleanName,
    email: cleanEmail,
    password,
    phone: cleanPhone,
    address: cleanAddress,
    service_id: numServiceId,
    vehicle: vehicle?.trim() || 'Standard Two-Wheeler',
  });

  if (res.token && res.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(AUTH_ROLE_KEY, 'partner');
    localStorage.setItem(PARTNER_USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(CURRENT_PARTNER_KEY, JSON.stringify(res.user));
    notifyAuthChange();
  }

  return res.user;
}

/**
 * Send Forgot Password OTP for Partner
 * Calls POST /api/auth/partner/forgot-password
 */
export async function sendPartnerForgotPasswordOtp(email) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your partner email address.');
  }

  const res = await post('/api/auth/partner/forgot-password', { email: cleanEmail });

  return {
    success: true,
    message: res.message || `OTP sent to ${cleanEmail}. (Check server console for code)`,
    demoOtp: res.demoOtp,
    demo_otp: res.demoOtp,
  };
}

/**
 * Reset partner password with OTP
 * Calls POST /api/auth/partner/reset-password
 */
export async function resetPartnerPasswordWithOtp(email, otp, newPassword) {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanOtp = otp?.trim();

  const passCheck = validatePassword(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  const res = await post('/api/auth/partner/reset-password', {
    email: cleanEmail,
    otp: cleanOtp,
    newPassword,
  });

  return {
    success: true,
    message: res.message || 'Password updated successfully. You can now log in as Partner.',
  };
}

/**
 * Get current partner session
 */
export function getCurrentPartner() {
  try {
    const raw = localStorage.getItem(PARTNER_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
    const role = localStorage.getItem(AUTH_ROLE_KEY);
    if (raw && role === 'partner') {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Set current partner session
 */
export function setCurrentPartner(partner) {
  if (!partner) {
    localStorage.removeItem(PARTNER_USER_KEY);
    localStorage.removeItem(CURRENT_PARTNER_KEY);
  } else {
    localStorage.setItem(PARTNER_USER_KEY, JSON.stringify(partner));
    localStorage.setItem(CURRENT_PARTNER_KEY, JSON.stringify(partner));
  }
}

/**
 * Logout partner
 */
export function logoutPartner() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(PARTNER_USER_KEY);
  localStorage.removeItem(CURRENT_PARTNER_KEY);
  notifyAuthChange();
}

export default {
  validatePassword,
  customerLogin,
  customerRegister,
  sendForgotPasswordOtp,
  resetPasswordWithOtp,
  getCurrentCustomer,
  customerLogout,
  partnerLogin,
  partnerRegister,
  sendPartnerForgotPasswordOtp,
  resetPartnerPasswordWithOtp,
  getCurrentPartner,
  setCurrentPartner,
  logoutPartner,
};
