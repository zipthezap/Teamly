import { Router } from 'express';
import {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
} from '../controllers/emailController';
import authMiddleware from '../middleware/auth';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Get email preferences
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/preferences', authMiddleware, etagMiddleware({ weak: true }), getEmailPreferences);

// Update email preferences
router.put('/preferences', authMiddleware, noCache, updateEmailPreferences);

// Toggle email notifications on/off
router.put('/notifications/toggle', authMiddleware, noCache, toggleEmailNotifications);

// Send verification email
router.post('/verify/send', authMiddleware, noCache, sendVerificationEmail);

// Verify email with token
router.get('/verify/:token', noCache, verifyEmail);

export default router;
