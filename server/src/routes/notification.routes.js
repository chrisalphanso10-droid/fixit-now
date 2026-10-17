/**
 * FixIt Now - Notification Routes
 * Conforms to docs/SRS.md FR-C20 and docs/PLAN.md Phase 8.
 */

import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;
