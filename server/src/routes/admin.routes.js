/**
 * FixIt Now - Admin Routes
 * Conforms to SRS FR-A1:
 * - Separate admin login at /api/admin/login.
 * - No admin registration.
 */

import { Router } from 'express';
import { loginAdmin } from '../controllers/auth.controller.js';

const router = Router();

// Dedicated Admin Login (SRS FR-A1)
router.post('/login', loginAdmin);

export default router;
