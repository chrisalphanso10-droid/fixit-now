/**
 * FixIt Now - Admin Routes
 * Conforms to SRS FR-A1 through FR-A7, Section 2.4, Section 5, and Section 6:
 * - Dedicated admin login at /api/admin/login (FR-A1).
 * - Read-only monitoring of customers, partners, requests, subscriptions, ratings, activity logs (FR-A2).
 * - Admin CANNOT edit or delete customer or partner data (enforced on server) (FR-A3, Section 2.4).
 * - Admin KYC review with mandatory rejection reason and audit logging (FR-A4).
 * - Plan price management with BR-2 rule enforcement (FR-A5, BR-2).
 * - Service category management: add, rename, update, deactivate (FR-A6).
 */

import { Router } from 'express';
import { loginAdmin } from '../controllers/auth.controller.js';
import { getAdminKycList } from '../controllers/partner.controller.js';
import {
  getAdminDashboard,
  getAdminAnalytics,
  getAdminCustomers,
  getAdminPartners,
  rejectCustomerPartnerMutation,
  getAdminRequests,
  getAdminSubscriptions,
  getAdminRatings,
  getAdminActivityLog,
  getAdminPlans,
  updatePlanPrice,
  getAdminServices,
  createServiceCategory,
  updateServiceCategory,
  toggleServiceActive,
  adminReviewKycDecision,
} from '../controllers/admin.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// =============================================================================
// 1. Admin Authentication (SRS FR-A1)
// =============================================================================
router.post('/login', loginAdmin);

// =============================================================================
// 2. Protected Admin Operations (authenticateToken + requireRole('admin'))
// =============================================================================
router.use(authenticateToken);
router.use(requireRole('admin'));

// -----------------------------------------------------------------------------
// Dashboard Overview & Analytics (FR-A2, FR-A7)
// -----------------------------------------------------------------------------
router.get('/dashboard', getAdminDashboard);
router.get('/analytics', getAdminAnalytics);

// -----------------------------------------------------------------------------
// KYC Verification Queue & Decision (FR-A4, FR-P5)
// -----------------------------------------------------------------------------
router.get('/kyc', getAdminKycList);
router.put('/kyc/:partnerId/decision', adminReviewKycDecision);

// -----------------------------------------------------------------------------
// Plan Prices Management (FR-A5, BR-2)
// -----------------------------------------------------------------------------
router.get('/plans', getAdminPlans);
router.put('/plans/:id', updatePlanPrice);

// -----------------------------------------------------------------------------
// Service Categories Management (FR-A6)
// -----------------------------------------------------------------------------
router.get('/services', getAdminServices);
router.post('/services', createServiceCategory);
router.put('/services/:id', updateServiceCategory);
router.put('/services/:id/toggle', toggleServiceActive);

// -----------------------------------------------------------------------------
// Strictly Enforced Immutability: Customer & Partner Records (FR-A3, Sec 2.4)
// Admin CANNOT edit, update, or delete customer or partner data on the server.
// -----------------------------------------------------------------------------
router.put('/customers/:id?', rejectCustomerPartnerMutation);
router.patch('/customers/:id?', rejectCustomerPartnerMutation);
router.delete('/customers/:id?', rejectCustomerPartnerMutation);
router.post('/customers', rejectCustomerPartnerMutation);

router.put('/partners/:id?', rejectCustomerPartnerMutation);
router.patch('/partners/:id?', rejectCustomerPartnerMutation);
router.delete('/partners/:id?', rejectCustomerPartnerMutation);
router.post('/partners', rejectCustomerPartnerMutation);

// -----------------------------------------------------------------------------
// Read-Only Lists (FR-A2)
// -----------------------------------------------------------------------------
router.get('/customers', getAdminCustomers);
router.get('/partners', getAdminPartners);
router.get('/requests', getAdminRequests);
router.get('/subscriptions', getAdminSubscriptions);
router.get('/ratings', getAdminRatings);
router.get('/activity-log', getAdminActivityLog);

export default router;
