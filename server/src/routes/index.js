import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import serviceRoutes from './service.routes.js';
import partnerRoutes from './partner.routes.js';

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
router.use('/plans', partnerRoutes);

export default router;

