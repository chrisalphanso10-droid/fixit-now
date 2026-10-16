/**
 * FixIt Now - Authentication Service (Customer Portal)
 * Manages customer login, registration, password reset with OTP, and session persistence.
 * Conforms to SRS FR-C1, FR-C2, FR-C3, FR-C4.
 */

import { mockCustomers, mockPartners, mockServices } from '../mockData';

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

/* ========================================================================== */
/* PARTNER AUTHENTICATION & SESSIONS (SRS FR-P1, FR-P2, FR-P6)                */
/* ========================================================================== */

const AUTH_PARTNER_KEY = 'fixit_partner_user';
const PARTNERS_KEY = 'fixit_partners_list';
const PARTNER_PENDING_OTP_KEY = 'fixit_partner_pending_otp';

export function getStoredPartners() {
  try {
    const raw = localStorage.getItem(PARTNERS_KEY);
    return raw ? JSON.parse(raw) : mockPartners;
  } catch {
    return mockPartners;
  }
}

export function saveStoredPartners(list) {
  try {
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getCurrentPartner() {
  try {
    const raw = localStorage.getItem(AUTH_PARTNER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return mockPartners[0]; // Default to Rajesh Kumar (verified master plumber)
}

export function setCurrentPartner(partner) {
  if (!partner) {
    localStorage.removeItem(AUTH_PARTNER_KEY);
    localStorage.removeItem('fixit_current_partner');
  } else {
    localStorage.setItem(AUTH_PARTNER_KEY, JSON.stringify(partner));
    localStorage.setItem('fixit_current_partner', JSON.stringify(partner));
  }
}

export function logoutPartner() {
  localStorage.removeItem(AUTH_PARTNER_KEY);
  localStorage.removeItem('fixit_current_partner');
}

/**
 * Log in partner with email and password (SRS FR-P6)
 */
export async function partnerLogin(email, password) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const partners = getStoredPartners();
  const digits = cleanEmail.replace(/\D/g, '');
  const found = partners.find(
    (p) =>
      p.email.toLowerCase() === cleanEmail ||
      (cleanEmail.includes('rajesh') && p.email.toLowerCase().includes('rajesh')) ||
      (cleanEmail.includes('ramesh') && p.email.toLowerCase().includes('ramesh')) ||
      (cleanEmail.includes('sunil') && p.email.toLowerCase().includes('sunil')) ||
      (cleanEmail.includes('vikram') && p.email.toLowerCase().includes('vikram')) ||
      (cleanEmail.includes('kiran') && p.email.toLowerCase().includes('kiran')) ||
      (cleanEmail.includes('dinesh') && p.email.toLowerCase().includes('dinesh')) ||
      (digits.length >= 5 && p.phone.replace(/\D/g, '').includes(digits))
  );

  if (!found) {
    const passCheck = validatePassword(password);
    if (passCheck.valid) {
      const demoPartner = {
        id: Date.now(),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '+91 98000 12345',
        service_id: 2,
        service_name: 'Plumbing Repairs',
        online: true,
        kyc_status: 'verified',
        subscription_status: 'active',
        rating: 5.0,
        total_jobs: 0,
        badge: 'New Tradesperson Pro',
        vehicle: 'Standard Two-Wheeler',
        avatar_color: '#FF5B14',
      };
      setCurrentPartner(demoPartner);
      return demoPartner;
    }
    throw new Error(
      'No partner account found with this email. Please check your credentials or register.'
    );
  }

  setCurrentPartner(found);
  return found;
}

/**
 * Register partner with name, email, password, phone, address, and exactly one service category
 * Conforms to SRS FR-P1 & FR-C2
 */
export async function partnerRegister({ name, email, password, phone, address, service_id }) {
  await new Promise((resolve) => setTimeout(resolve, 350));
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

  const partners = getStoredPartners();
  const existing = partners.find((p) => p.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error('A partner account with this email already exists. Please log in.');
  }

  const service = mockServices.find((s) => s.id === numServiceId) || mockServices[0];

  const newPartner = {
    id: Date.now(),
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    address: cleanAddress,
    service_id: numServiceId,
    service_name: service.name,
    online: false,
    current_coordinates: { lat: 12.9784, lng: 77.6408 },
    kyc_status: 'pending', // Pending KYC per SRS FR-P5
    subscription_status: 'unsubscribed', // needs plan selection per SRS FR-P2
    rating: 5.0,
    total_jobs: 0,
    badge: `Certified ${service.name} Pro`,
    vehicle: 'Hero Splendor (KA-03-XX-0000)',
    avatar_color: '#FF5B14',
    created_at: new Date().toISOString(),
  };

  const updated = [newPartner, ...partners];
  saveStoredPartners(updated);
  setCurrentPartner(newPartner);

  return newPartner;
}

/**
 * Send Forgot Password OTP for Partner
 */
export async function sendPartnerForgotPasswordOtp(email) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your partner email address.');
  }

  const mockOtp = '619042';
  localStorage.setItem(
    PARTNER_PENDING_OTP_KEY,
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
 * Reset partner password with OTP
 */
export async function resetPartnerPasswordWithOtp(email, otp, newPassword) {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const cleanOtp = otp?.trim();

  const passCheck = validatePassword(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.error);
  }

  if (cleanOtp !== '619042') {
    throw new Error('Invalid or expired OTP. Please use demo code 619042.');
  }

  localStorage.removeItem(PARTNER_PENDING_OTP_KEY);
  return { success: true, message: 'Password updated successfully. You can now log in as Partner.' };
}
