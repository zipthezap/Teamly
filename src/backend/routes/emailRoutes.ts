import { Router } from 'express';
import {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
} from '../controllers/emailController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Get email preferences
router.get('/preferences', authMiddleware, asyncHandler(getEmailPreferences));

// Update email preferences
router.put('/preferences', authMiddleware, asyncHandler(updateEmailPreferences));

// Toggle email notifications on/off
router.put('/notifications/toggle', authMiddleware, asyncHandler(toggleEmailNotifications));

// Send verification email
router.post('/verify/send', authMiddleware, asyncHandler(sendVerificationEmail));

// Verify email with token
router.get('/verify/:token', asyncHandler(verifyEmail));

export default router;
