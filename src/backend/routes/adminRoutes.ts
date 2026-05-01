import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Admin utility: resend in-app notifications for pending invites for a given email
router.post('/invite-resend', authMiddleware, asyncHandler(adminController.resendInviteNotifications));

export default router;
