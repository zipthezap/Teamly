import { Router } from 'express';
import * as reminderController from '../controllers/reminderController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// User's all reminders
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/', etagMiddleware({ weak: true }), reminderController.getUserReminders);

// Reminder management
router.put('/:reminderId', noCache, reminderController.updateReminder);
router.delete('/:reminderId', noCache, reminderController.deleteReminder);

export default router;
