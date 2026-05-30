import { Router } from 'express';
import * as adminProxyController from '../controllers/proxies/adminProxyController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// Admin utility: resend in-app notifications for pending invites for a given email
router.post(
  '/invite-resend',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminProxyController.resendInviteNotifications)
);
router.delete(
  '/teamup/:id',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminProxyController.deleteTeamUpRequestAdmin)
);
router.put(
  '/teamup/:id/status',
  authenticatedLimiter,
  authMiddleware,
  asyncHandler(adminProxyController.updateTeamUpStatusAdmin)
);

export default router;
