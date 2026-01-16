
import { Router } from 'express';
import * as chat from '../controllers/groupChatController';
import authMiddleware from '../middleware/auth';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

router.use(authMiddleware);

// Undo mark late (ensure auth middleware is applied)
router.post('/event/unmark-late', noCache, chat.unmarkLate);

// Group chat
router.post('/message', noCache, chat.createMessage);
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/:groupId/messages', etagMiddleware({ weak: true }), chat.getMessages);

// Mark late
router.post('/event/late', noCache, chat.markLate);

// Notifications
router.get('/notifications', etagMiddleware({ weak: true }), chat.getNotifications);
router.post('/notifications/mark-read', noCache, chat.markNotificationsRead);

export default router;
