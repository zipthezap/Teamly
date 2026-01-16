import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import * as notificationPref from '../controllers/notificationPreferenceController';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/', authMiddleware, etagMiddleware({ weak: true }), notificationPref.getNotificationPreferences);
router.put('/', authMiddleware, noCache, notificationPref.updateNotificationPreferences);

export default router;
