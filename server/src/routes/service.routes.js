/**
 * FixIt Now - Services Routes
 * Conforms to docs/SRS.md Section 3.1 & Section 6.
 */

import { Router } from 'express';
import { getActiveServices } from '../controllers/service.controller.js';

const router = Router();

// Publicly accessible active services list
router.get('/', getActiveServices);

export default router;
