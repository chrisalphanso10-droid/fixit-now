/**
 * FixIt Now - Customer Routes
 * Conforms to docs/SRS.md Section 3.2 (FR-C8, FR-C9).
 */

import { Router } from 'express';
import {
  getCustomerProfile,
  updateCustomerProfile,
  getSavedAddresses,
  addSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
} from '../controllers/customer.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Enforce customer authentication on all customer endpoints
router.use(authenticateToken);
router.use(requireRole('customer'));

// Profile endpoints (SRS FR-C8)
router.get('/profile', getCustomerProfile);
router.put('/profile', updateCustomerProfile);

// Saved addresses endpoints (SRS FR-C9)
router.get('/addresses', getSavedAddresses);
router.post('/addresses', addSavedAddress);
router.put('/addresses/:id', updateSavedAddress);
router.delete('/addresses/:id', deleteSavedAddress);

export default router;
