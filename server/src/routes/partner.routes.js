/**
 * FixIt Now - Partner Portal Routes
 * Conforms to SRS FR-P1 to FR-P7, FR-P13 to FR-P15 & docs/PLAN.md Phase 4.
 */

import { Router } from 'express';
import {
  getSubscriptionPlans,
  getPartnerSubscription,
  subscribePlan,
  getPartnerKyc,
  uploadPartnerKyc,
  serveKycDocument,
  getPartnerDashboard,
  reviewPartnerKyc,
  togglePartnerOnline,
  getPartnerRatings,
  getPartnerEarnings,
  getPartnerProfile,
  updatePartnerProfile,
} from '../controllers/partner.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { verifyToken } from '../services/token.service.js';
import { partnerKycUploadFields } from '../middleware/upload.middleware.js';

const router = Router();

const optionalPartnerAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  if (authHeader) {
    try {
      let token = authHeader;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
      if (token) {
        req.user = verifyToken(token);
      }
    } catch {
      // ignore invalid token for ratings
    }
  }
  next();
};

// =============================================================================
// 1. Subscription Plans (Public / Partner)
// =============================================================================
router.get('/plans', getSubscriptionPlans);

// =============================================================================
// 2. Partner Subscription Lifecycle (Authenticated Partner)
// =============================================================================
router.get(
  '/subscription',
  authenticateToken,
  requireRole('partner'),
  getPartnerSubscription
);

router.post(
  '/subscribe',
  authenticateToken,
  requireRole('partner'),
  subscribePlan
);

// =============================================================================
// 3. KYC Verification & Document Upload (SRS FR-P4, FR-P5)
// =============================================================================
router.get(
  '/kyc',
  authenticateToken,
  requireRole('partner'),
  getPartnerKyc
);

router.post(
  '/kyc',
  authenticateToken,
  requireRole('partner'),
  partnerKycUploadFields,
  uploadPartnerKyc
);

// Secure document retrieval (Owner partner and Admin only)
router.get(
  '/kyc/document/:docId',
  authenticateToken,
  serveKycDocument
);

// =============================================================================
// 4. Partner Dashboard Data & Status
// =============================================================================
router.get(
  '/dashboard',
  authenticateToken,
  requireRole('partner'),
  getPartnerDashboard
);

router.put(
  '/online',
  authenticateToken,
  requireRole('partner'),
  togglePartnerOnline
);

router.get(
  '/ratings',
  optionalPartnerAuth,
  getPartnerRatings
);

router.get(
  '/earnings',
  authenticateToken,
  requireRole('partner'),
  getPartnerEarnings
);

// =============================================================================
// 5. Partner Profile Management (SRS FR-P1, FR-P11)
// =============================================================================
router.get(
  '/profile',
  authenticateToken,
  requireRole('partner'),
  getPartnerProfile
);

router.put(
  '/profile',
  authenticateToken,
  requireRole('partner'),
  updatePartnerProfile
);

// =============================================================================
// 6. Admin / Review KYC Decision (SRS FR-A4, FR-P5)
// =============================================================================
router.put(
  '/kyc/:partnerId/decision',
  authenticateToken,
  requireRole('admin'),
  reviewPartnerKyc
);

export default router;
