/**
 * FixIt Now - Request Routes
 * Conforms to docs/SRS.md FR-C6, FR-C7, FR-C10, FR-C19, FR-P9 and docs/PLAN.md Phase 6.
 */

import { Router } from 'express';
import {
  createRequest,
  getRequestById,
  getRequestHistory,
  cancelRequest,
  respondToRequest,
  updateRequestStatus,
  verifyRequestOtp,
  rateRequest,
} from '../controllers/request.controller.js';
import { processPayment, getPaymentReceipt } from '../controllers/payment.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { requestPhotoUpload } from '../middleware/upload.middleware.js';

const router = Router();

// 1. Create a new service request (Customer only, optional photo upload via Multer)
router.post(
  '/',
  authenticateToken,
  requireRole('customer'),
  requestPhotoUpload,
  createRequest
);

// 2. Get request history (Customer or Partner)
router.get(
  '/',
  authenticateToken,
  getRequestHistory
);

router.get(
  '/history',
  authenticateToken,
  getRequestHistory
);

// 3. Get specific request by ID (Customer, Partner, or Admin)
router.get(
  '/:id',
  authenticateToken,
  getRequestById
);

// 4. Cancel a request (Customer or Admin)
router.post(
  '/:id/cancel',
  authenticateToken,
  cancelRequest
);

// 5. Partner accept or decline an offered request
router.post(
  '/:id/respond',
  authenticateToken,
  requireRole('partner'),
  respondToRequest
);

// 6. Partner advance work order status (on_the_way, arrived, completed, paid)
router.put(
  '/:id/status',
  authenticateToken,
  requireRole('partner'),
  updateRequestStatus
);

// 7. Partner verify service OTP from customer (starts service / in_progress)
router.post(
  '/:id/verify-otp',
  authenticateToken,
  requireRole('partner'),
  verifyRequestOtp
);

// 8. Customer rate completed service request (SRS FR-C17)
router.post(
  '/:id/rate',
  authenticateToken,
  requireRole('customer'),
  rateRequest
);

// 9. Process simulated payment after service (SRS FR-C18: proceed, waiting, successful)
router.post(
  '/:id/pay',
  authenticateToken,
  processPayment
);

// 10. Get digital work order receipt (SRS FR-C18)
router.get(
  '/:id/receipt',
  authenticateToken,
  getPaymentReceipt
);

export default router;
