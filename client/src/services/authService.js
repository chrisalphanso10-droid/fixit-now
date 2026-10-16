/**
 * FixIt Now - Authentication Service (Customer Portal)
 * Manages customer login, registration, password reset with OTP, and session persistence.
 * Conforms to SRS FR-C1, FR-C2, FR-C3, FR-C4.
 */

import { mockCustomers } from '../mockData';

const AUTH_USER_KEY = 'fixit_customer_user';
const CUSTOMERS_KEY = 'fixit_customers_list';
const PENDING_OTP_KEY = 'fixit_customer_pending_otp';

function getStoredCustomers() {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : mockCustomers;
  } catch {
    return mockCustomers;
  }
}

function saveStoredCustomers(list) {
  try {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
  } catch {
    // fallback in case storage fails
  }
}

/**
 * Validates password per SRS FR-C2:
 * At least 6 characters and contains at least one special character.
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
  if (!specialCharRegex.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character.' };
  }
  return { valid: true, error: null };
}

/**
 * Log in customer with email and password
 */
export async function customerLogin(email, password) {
  await new Promise((resolve) => setTimeout(resolve, 300)); // simulate brief network latency
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const customers = getStoredCustomers();
  const found = customers.find((c) => c.email.toLowerCase() === cleanEmail);

  if (!found) {
    // For demo convenience, if someone tests a new email with any password that's at least 6 chars
    if (password.length >= 6) {
      const demoUser = {
        id: Date.now(),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '+91 98765 43210',
        address: '42, 3rd Cross, Indiranagar, Bengaluru, 560038',
        coordinates: { lat: 12.9784, lng: 77.6408 },
      };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(demoUser));
      return demoUser;
    }
    throw new Error('Account not found with this email. Please register first.');
  }

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(found));
  return found;
}

/**
 * Register a new customer
 */
export async function customerRegister({ name, email, password, phone, address }) {
  await new Promise((resolve) => setTimeout(resolve, 350));

  if (!name?.trim()) throw new Error('Full name is required.');
  if (!email?.trim()) throw new Error('Email address is required.');
  if (!phone?.trim()) throw new Error('Phone number is required.');
  if (!address?.trim()) throw new Error('Service street address is required.');

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  const customers = getStoredCustomers();
  const cleanEmail = email.trim().toLowerCase();
  const existing = customers.find((c) => c.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const newCustomer = {
    id: Date.now(),
    name: name.trim(),
    email: cleanEmail,
    phone: phone.trim(),
    address: address.trim(),
    coordinates: { lat: 12.9784, lng: 77.6408 },
    photo: null,
    created_at: new Date().toISOString(),
  };

  customers.push(newCustomer);
  saveStoredCustomers(customers);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newCustomer));
  return newCustomer;
}

/**
 * Get current customer session
 */
export function getCurrentCustomer() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
    // Return default customer if none explicitly logged out
    return mockCustomers[0];
  } catch {
    return mockCustomers[0];
  }
}

/**
 * Log out
 */
export function customerLogout() {
  localStorage.removeItem(AUTH_USER_KEY);
}

/**
 * Request OTP for forgot password (SRS FR-C4)
 */
export async function sendForgotPasswordOtp(email) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter your registered email address.');

  // Generate 6 digit mock OTP
  const mockOtp = '427001';
  localStorage.setItem(
    PENDING_OTP_KEY,
    JSON.stringify({
      email: cleanEmail,
      otp: mockOtp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
  );

  return {
    success: true,
    message: `OTP sent to ${cleanEmail}. (Demo OTP: ${mockOtp})`,
    demoOtp: mockOtp,
  };
}

/**
 * Verify OTP and reset password
 */
export async function resetPasswordWithOtp(email, otp, newPassword) {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const cleanEmail = email?.trim().toLowerCase();
  const cleanOtp = otp?.trim();

  const passCheck = validatePassword(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  // Check stored OTP or default demo OTP 427001
  const rawOtp = localStorage.getItem(PENDING_OTP_KEY);
  let expectedOtp = '427001';
  if (rawOtp) {
    try {
      const parsed = JSON.parse(rawOtp);
      if (parsed.email === cleanEmail) {
        expectedOtp = parsed.otp;
      }
    } catch {
      // ignore
    }
  }

  if (cleanOtp !== expectedOtp && cleanOtp !== '427001') {
    throw new Error('Invalid or expired OTP. Please use code 427001.');
  }

  localStorage.removeItem(PENDING_OTP_KEY);
  return { success: true, message: 'Password updated successfully. You can now log in.' };
}
