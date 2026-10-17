/**
 * FixIt Now - Authentication Controller
 * Handles Customer, Partner, and Admin Authentication flows.
 * Conforms to docs/SRS.md FR-C1..FR-C4, FR-P1, FR-P6, FR-A1, Section 5 & docs/PLAN.md Phase 3.
 */

import { query } from '../config/db.js';
import {
  validatePassword,
  hashPassword,
  comparePassword,
  generateToken,
} from '../services/token.service.js';
import { geocodeAddress } from '../services/geocoding.service.js';
import { createAndDispatchOtp, verifyOtp } from '../services/otp.service.js';

// RFC-compliant email, phone (10-15 digits), and 6-digit OTP validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{10,15}$/;
const OTP_REGEX = /^\d{6}$/;

// =============================================================================
// 1. CUSTOMER AUTHENTICATION
// =============================================================================

/**
 * Register Customer (SRS FR-C1 & FR-C2)
 */
export async function registerCustomer(req, res, next) {
  try {
    const { name, email, password, phone, address } = req.body;

    // Field presence validation
    if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'Name is required.' });
    if (!email?.trim()) return res.status(400).json({ status: 'error', message: 'Email is required.' });
    if (!password) return res.status(400).json({ status: 'error', message: 'Password is required.' });
    if (!phone?.trim()) return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
    if (!address?.trim()) return res.status(400).json({ status: 'error', message: 'Address is required.' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    // Format & completeness validation (SRS FR-C1)
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
    }

    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (!PHONE_REGEX.test(cleanPhone) || phoneDigits.length < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid phone number with at least 10 digits.',
      });
    }

    if (cleanAddress.length < 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a complete service address (at least 5 characters).',
      });
    }

    // Password policy check
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ status: 'error', message: passCheck.message });
    }

    // Check existing customer
    const existing = await query('SELECT id FROM customers WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'An account with this email already exists. Please log in.',
      });
    }

    // Geocode customer address with caching and fallbacks
    const { latitude, longitude } = await geocodeAddress(cleanAddress);

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Insert new customer
    const insertResult = await query(
      `INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, phone, address, latitude, longitude, created_at`,
      [cleanName, cleanEmail, passwordHash, cleanPhone, cleanAddress, latitude, longitude]
    );

    const customer = insertResult.rows[0];

    // Seed default saved address (SRS FR-C9)
    try {
      await query(
        `INSERT INTO saved_addresses (customer_id, label, address, latitude, longitude, is_default)
         VALUES ($1, 'Home', $2, $3, $4, true)`,
        [customer.id, cleanAddress, latitude, longitude]
      );
    } catch (addrErr) {
      console.warn('[Address Seed Warning]:', addrErr.message);
    }

    // Generate JWT
    const token = generateToken({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: 'customer',
    });

    return res.status(201).json({
      status: 'success',
      message: 'Customer registered successfully.',
      token,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        latitude: customer.latitude,
        longitude: customer.longitude,
        role: 'customer',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login Customer (SRS FR-C3)
 */
export async function loginCustomer(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both email and password.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    const result = await query(
      `SELECT id, name, email, password_hash, phone, address, latitude, longitude
       FROM customers WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. No customer account found with this email.',
      });
    }

    const customer = result.rows[0];
    const passwordMatch = await comparePassword(password, customer.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const token = generateToken({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: 'customer',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        latitude: customer.latitude,
        longitude: customer.longitude,
        role: 'customer',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Forgot Password - Send OTP for Customer (SRS FR-C4)
 */
export async function forgotPasswordCustomer(req, res, next) {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid registered email address.',
      });
    }

    const exists = await query('SELECT id FROM customers WHERE email = $1', [cleanEmail]);
    if (exists.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No registered customer account found with this email.',
      });
    }

    await createAndDispatchOtp(cleanEmail, 'forgot_password');

    return res.status(200).json({
      status: 'success',
      message: 'A 6-digit verification code has been dispatched. Check the server console terminal.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reset Password with OTP for Customer (SRS FR-C4)
 */
export async function resetPasswordCustomer(req, res, next) {
  try {
    const { email, otp } = req.body;
    const newPassword = req.body.newPassword || req.body.new_password;

    if (!email?.trim() || !otp?.trim() || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, OTP, and new password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    if (!OTP_REGEX.test(cleanOtp)) {
      return res.status(400).json({
        status: 'error',
        message: 'Verification OTP must be exactly 6 numeric digits.',
      });
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      return res.status(400).json({ status: 'error', message: passCheck.message });
    }

    const isValid = await verifyOtp(cleanEmail, cleanOtp, 'forgot_password');
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP code. Please request a new one.',
      });
    }

    const newHash = await hashPassword(newPassword);
    await query(
      `UPDATE customers SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2`,
      [newHash, cleanEmail]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You may now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// 2. PARTNER AUTHENTICATION
// =============================================================================

/**
 * Register Partner (SRS FR-P1, FR-C2)
 * Partners must select EXACTLY ONE certified service category.
 */
export async function registerPartner(req, res, next) {
  try {
    const { name, email, password, phone, address, service_id, vehicle } = req.body;

    if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'Name is required.' });
    if (!email?.trim()) return res.status(400).json({ status: 'error', message: 'Email is required.' });
    if (!password) return res.status(400).json({ status: 'error', message: 'Password is required.' });
    if (!phone?.trim()) return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
    if (!address?.trim()) return res.status(400).json({ status: 'error', message: 'Address is required.' });

    // Validate service_id (exact 1 certified service)
    const serviceIdNum = parseInt(service_id, 10);
    if (isNaN(serviceIdNum) || serviceIdNum <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'You must select exactly one certified service trade category (SRS FR-P1).',
      });
    }

    let resolvedServiceId = serviceIdNum;
    let serviceName = '';

    const serviceCheck = await query(
      'SELECT id, name FROM services WHERE id = $1 AND active = true',
      [serviceIdNum]
    );
    if (serviceCheck.rows.length > 0) {
      resolvedServiceId = serviceCheck.rows[0].id;
      serviceName = serviceCheck.rows[0].name;
    } else {
      // Fallback: Check if serviceIdNum is a 1-based index (e.g. 1..5) among active services
      const allActive = await query('SELECT id, name FROM services WHERE active = true ORDER BY id ASC');
      if (allActive.rows.length >= serviceIdNum && serviceIdNum >= 1) {
        resolvedServiceId = allActive.rows[serviceIdNum - 1].id;
        serviceName = allActive.rows[serviceIdNum - 1].name;
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Selected service category is invalid or inactive.',
        });
      }
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    // Format & completeness validation (SRS FR-P1 & FR-C2)
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
    }

    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (!PHONE_REGEX.test(cleanPhone) || phoneDigits.length < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid phone number with at least 10 digits.',
      });
    }

    if (cleanAddress.length < 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a complete operating address (at least 5 characters).',
      });
    }

    // Password policy check
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ status: 'error', message: passCheck.message });
    }

    // Check existing partner
    const existing = await query('SELECT id FROM partners WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'A partner account with this email already exists. Please log in.',
      });
    }

    // Geocode partner initial base address
    const { latitude, longitude } = await geocodeAddress(cleanAddress);

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Insert partner (pending KYC, offline, total_jobs 0)
    const insertResult = await query(
      `INSERT INTO partners (
         name, email, password_hash, phone, address, service_id,
         vehicle, latitude, longitude, kyc_status, online, rating, total_jobs
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'not_submitted', false, 5.00, 0)
       RETURNING id, name, email, phone, address, service_id, vehicle, latitude, longitude, kyc_status, online, rating, total_jobs, created_at`,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        cleanPhone,
        cleanAddress,
        resolvedServiceId,
        vehicle?.trim() || 'Two-Wheeler',
        latitude,
        longitude,
      ]
    );

    const partner = insertResult.rows[0];

    // Generate JWT
    const token = generateToken({
      id: partner.id,
      email: partner.email,
      name: partner.name,
      role: 'partner',
    });

    return res.status(201).json({
      status: 'success',
      message: 'Partner registered successfully. Proceed to plan selection & KYC.',
      token,
      user: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        address: partner.address,
        service_id: partner.service_id,
        service_name: serviceName,
        vehicle: partner.vehicle,
        latitude: partner.latitude,
        longitude: partner.longitude,
        kyc_status: partner.kyc_status,
        online: partner.online,
        rating: parseFloat(partner.rating),
        total_jobs: partner.total_jobs,
        role: 'partner',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login Partner (SRS FR-P6)
 * Supports login via either registered email or phone number
 */
export async function loginPartner(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both partner email/phone and password.',
      });
    }

    const cleanIdentifier = email.trim();
    const isEmail = cleanIdentifier.includes('@');
    if (isEmail && !EMAIL_REGEX.test(cleanIdentifier.toLowerCase())) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid partner email address.',
      });
    }

    const cleanEmail = cleanIdentifier.toLowerCase();
    const digitsOnly = cleanIdentifier.replace(/\D/g, '');

    const result = await query(
      `SELECT p.id, p.name, p.email, p.password_hash, p.phone, p.address,
              p.service_id, s.name AS service_name, p.vehicle, p.latitude, p.longitude,
              p.kyc_status, p.online, p.rating, p.total_jobs
       FROM partners p
       JOIN services s ON p.service_id = s.id
       WHERE p.email = $1 OR (length($2) >= 10 AND (regexp_replace(p.phone, '\\D', '', 'g') = $2 OR regexp_replace(p.phone, '\\D', '', 'g') LIKE '%' || $2))`,
      [cleanEmail, digitsOnly]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. No partner account found with this email or phone number.',
      });
    }

    const partner = result.rows[0];
    const passwordMatch = await comparePassword(password, partner.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const token = generateToken({
      id: partner.id,
      email: partner.email,
      name: partner.name,
      role: 'partner',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Partner login successful.',
      token,
      user: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        address: partner.address,
        service_id: partner.service_id,
        service_name: partner.service_name,
        vehicle: partner.vehicle,
        latitude: partner.latitude,
        longitude: partner.longitude,
        kyc_status: partner.kyc_status,
        online: partner.online,
        rating: parseFloat(partner.rating),
        total_jobs: partner.total_jobs,
        role: 'partner',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Forgot Password - Send OTP for Partner (SRS FR-P6)
 */
export async function forgotPasswordPartner(req, res, next) {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid registered partner email address.',
      });
    }

    const exists = await query('SELECT id FROM partners WHERE email = $1', [cleanEmail]);
    if (exists.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No registered partner account found with this email.',
      });
    }

    await createAndDispatchOtp(cleanEmail, 'forgot_password');

    return res.status(200).json({
      status: 'success',
      message: 'A 6-digit verification code has been dispatched. Check the server console terminal.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reset Password with OTP for Partner (SRS FR-P6)
 */
export async function resetPasswordPartner(req, res, next) {
  try {
    const { email, otp } = req.body;
    const newPassword = req.body.newPassword || req.body.new_password;

    if (!email?.trim() || !otp?.trim() || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, OTP, and new password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    if (!OTP_REGEX.test(cleanOtp)) {
      return res.status(400).json({
        status: 'error',
        message: 'Verification OTP must be exactly 6 numeric digits.',
      });
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      return res.status(400).json({ status: 'error', message: passCheck.message });
    }

    const isValid = await verifyOtp(cleanEmail, cleanOtp, 'forgot_password');
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP code. Please request a new one.',
      });
    }

    const newHash = await hashPassword(newPassword);
    await query(
      `UPDATE partners SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2`,
      [newHash, cleanEmail]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You may now log in as partner with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// 3. ADMIN AUTHENTICATION (SRS FR-A1)
// Separate admin login at /api/admin/login. STRICTLY NO REGISTRATION.
// =============================================================================

/**
 * Admin Login
 */
export async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Administrator email and password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid administrator email address.',
      });
    }

    const result = await query(
      `SELECT id, name, email, password_hash
       FROM admins WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized. Invalid administrator credentials.',
      });
    }

    const admin = result.rows[0];
    const passwordMatch = await comparePassword(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized. Invalid administrator credentials.',
      });
    }

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Administrator authenticated successfully.',
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      },
    });
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// 4. CURRENT SESSION VERIFICATION (GET /api/auth/me)
// =============================================================================

/**
 * Get profile of currently authenticated user based on JWT
 */
export async function getCurrentUser(req, res, next) {
  try {
    const { id, role } = req.user;

    if (role === 'customer') {
      const result = await query(
        `SELECT id, name, email, phone, address, latitude, longitude, created_at
         FROM customers WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Customer account not found.' });
      }
      return res.status(200).json({
        status: 'success',
        user: { ...result.rows[0], role: 'customer' },
      });
    }

    if (role === 'partner') {
      const result = await query(
        `SELECT p.id, p.name, p.email, p.phone, p.address, p.service_id,
                s.name AS service_name, p.vehicle, p.latitude, p.longitude,
                p.kyc_status, p.rejection_reason, p.online, p.rating, p.total_jobs, p.created_at
         FROM partners p
         JOIN services s ON p.service_id = s.id
         WHERE p.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Partner account not found.' });
      }
      const partner = result.rows[0];
      return res.status(200).json({
        status: 'success',
        user: {
          ...partner,
          rating: parseFloat(partner.rating),
          role: 'partner',
        },
      });
    }

    if (role === 'admin') {
      const result = await query(
        `SELECT id, name, email FROM admins WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Admin account not found.' });
      }
      return res.status(200).json({
        status: 'success',
        user: { ...result.rows[0], role: 'admin' },
      });
    }

    return res.status(400).json({ status: 'error', message: 'Unknown user role.' });
  } catch (err) {
    next(err);
  }
}

export default {
  registerCustomer,
  loginCustomer,
  forgotPasswordCustomer,
  resetPasswordCustomer,
  registerPartner,
  loginPartner,
  forgotPasswordPartner,
  resetPasswordPartner,
  loginAdmin,
  getCurrentUser,
};
