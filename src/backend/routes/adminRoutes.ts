import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// Admin utility: resend in-app notifications for pending invites for a given email
router.post(
  '/invite-resend',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminController.resendInviteNotifications)
);
router.delete(
  '/teamup/:id',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminController.deleteTeamUpRequestAdmin)
);
router.put(
  '/teamup/:id/status',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminController.updateTeamUpStatusAdmin)
);

export default router;
