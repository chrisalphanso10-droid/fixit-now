/**
 * FixIt Now - Authentication Routes
 * Handles customer and partner registration, login, forgot password OTP, and session verification.
 */

import { Router } from 'express';
import {
  registerCustomer,
  loginCustomer,
  forgotPasswordCustomer,
  resetPasswordCustomer,
  registerPartner,
  loginPartner,
  forgotPasswordPartner,
  resetPasswordPartner,
  getCurrentUser,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// =============================================================================
// Customer Auth Endpoints
// =============================================================================
router.post('/customer/register', registerCustomer);
router.post('/customer/login', loginCustomer);
router.post('/customer/forgot-password', forgotPasswordCustomer);
router.post('/customer/reset-password', resetPasswordCustomer);

// =============================================================================
// Partner Auth Endpoints
// =============================================================================
router.post('/partner/register', registerPartner);
router.post('/partner/login', loginPartner);
router.post('/partner/forgot-password', forgotPasswordPartner);
router.post('/partner/reset-password', resetPasswordPartner);

// =============================================================================
// Session Verification (All Roles)
// =============================================================================
router.get('/me', authenticateToken, getCurrentUser);

export default router;
