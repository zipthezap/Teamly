
import { Router } from 'express';
import * as chat from '../controllers/groupChatController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
// Undo mark late (ensure auth middleware is applied)
router.post('/event/unmark-late', asyncHandler(chat.unmarkLate));

// Group chat
router.post('/message', asyncHandler(chat.createMessage));
router.get('/:groupId/messages', asyncHandler(chat.getMessages));

// Mark late
router.post('/event/late', asyncHandler(chat.markLate));

// Notifications
router.get('/notifications', asyncHandler(chat.getNotifications));
router.post('/notifications/mark-read', asyncHandler(chat.markNotificationsRead));

export default router;
