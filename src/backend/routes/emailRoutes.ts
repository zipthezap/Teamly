import { Router } from 'express';
import {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
} from '../controllers/emailController';
import authMiddleware from '../middleware/auth';

const router = Router();

// Get email preferences
router.get('/preferences', authMiddleware, getEmailPreferences);

// Update email preferences
router.put('/preferences', authMiddleware, updateEmailPreferences);

// Toggle email notifications on/off
router.put('/notifications/toggle', authMiddleware, toggleEmailNotifications);

// Send verification email
router.post('/verify/send', authMiddleware, sendVerificationEmail);

// Verify email with token
router.get('/verify/:token', verifyEmail);

export default router;
