import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// Admin utility: resend in-app notifications for pending invites for a given email
router.post(
  '/invite-resend',
  authMiddleware,
  authenticatedLimiter,
  asyncHandler(adminController.resendInviteNotifications)
);
router.delete(
  '/teamup/:id',
  authMiddleware,
  authenticatedLimiter,
  asyncHandler(adminController.deleteTeamUpRequestAdmin)
);
router.put(
  '/teamup/:id/status',
  authMiddleware,
  authenticatedLimiter,
  asyncHandler(adminController.updateTeamUpStatusAdmin)
);

export default router;
