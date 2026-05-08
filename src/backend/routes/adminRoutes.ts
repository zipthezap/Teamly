import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Admin utility: resend in-app notifications for pending invites for a given email
router.post('/invite-resend', authMiddleware, asyncHandler(adminController.resendInviteNotifications));
router.delete('/teamup/:id', authMiddleware, asyncHandler(adminController.deleteTeamUpRequestAdmin));
router.put('/teamup/:id/status', authMiddleware, asyncHandler(adminController.updateTeamUpStatusAdmin));

export default router;
