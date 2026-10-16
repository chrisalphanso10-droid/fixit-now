import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Mount Health Check Routes
router.use('/health', healthRoutes);

export default router;
