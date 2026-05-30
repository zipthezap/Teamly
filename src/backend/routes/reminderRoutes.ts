import { Router } from 'express';
import * as reminderProxyController from '../controllers/proxies/reminderProxyController';
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
router.get('/', etagMiddleware({ weak: true }), reminderProxyController.getUserReminders);

// Reminder management
router.put('/:reminderId', noCache, reminderProxyController.updateReminder);
router.delete('/:reminderId', noCache, reminderProxyController.deleteReminder);

export default router;
