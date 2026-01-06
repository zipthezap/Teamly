
import { Router } from 'express';
import * as chat from '../controllers/groupChatController';
import authMiddleware from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
// Undo mark late (ensure auth middleware is applied)
router.post('/event/unmark-late', chat.unmarkLate);

// Group chat
router.post('/message', chat.createMessage);
router.get('/:groupId/messages', chat.getMessages);

// Mark late
router.post('/event/late', chat.markLate);

// Notifications
router.get('/notifications', chat.getNotifications);
router.post('/notifications/mark-read', chat.markNotificationsRead);

export default router;
