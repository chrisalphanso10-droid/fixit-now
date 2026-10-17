/**
 * FixIt Now - Support Routes
 * Conforms to docs/SRS.md FR-C20 and docs/PLAN.md Phase 8.
 */

import { Router } from 'express';
import {
  submitSupportTicket,
  getSupportFaqs,
} from '../controllers/support.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/faqs', getSupportFaqs);
router.post('/ticket', authenticateToken, submitSupportTicket);

export default router;
