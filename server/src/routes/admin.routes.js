/**
 * FixIt Now - Admin Routes
 * Conforms to SRS FR-A1:
 * - Separate admin login at /api/admin/login.
 * - No admin registration.
 */

import { Router } from 'express';
import { loginAdmin } from '../controllers/auth.controller.js';
import { getAdminKycList } from '../controllers/partner.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Dedicated Admin Login (SRS FR-A1)
router.post('/login', loginAdmin);

// Admin KYC Dossier Queue (SRS FR-A4)
router.get('/kyc', authenticateToken, requireRole('admin'), getAdminKycList);

export default router;
