import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import serviceRoutes from './service.routes.js';
import partnerRoutes from './partner.routes.js';
import customerRoutes from './customer.routes.js';
import requestRoutes from './request.routes.js';
import notificationRoutes from './notification.routes.js';
import supportRoutes from './support.routes.js';

const router = Router();

// Mount Health Check Routes
router.use('/health', healthRoutes);

// Mount Authentication & RBAC Routes
router.use('/auth', authRoutes);

// Mount Admin Routes (/api/admin/login)
router.use('/admin', adminRoutes);

// Mount Service Categories
router.use('/services', serviceRoutes);

// Mount Partner Onboarding, Subscriptions & KYC Routes
router.use('/partner', partnerRoutes);
router.use('/partners', partnerRoutes);
router.use('/plans', partnerRoutes);

// Mount Customer Portal Routes (Profile & Saved Addresses)
router.use('/customer', customerRoutes);

// Mount Request Lifecycle & Matching Routes
router.use('/requests', requestRoutes);

// Mount In-App Notifications (SRS FR-C20)
router.use('/notifications', notificationRoutes);

// Mount Support & FAQ Routes (SRS FR-C20)
router.use('/support', supportRoutes);

export default router;


