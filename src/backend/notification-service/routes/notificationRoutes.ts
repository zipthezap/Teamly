import { Router } from 'express';

import {
	deleteAllReadNotificationsEndpoint,
	deleteNotificationsEndpoint,
	getNotifications,
	getStats,
	getUnreadCount,
	markAsRead,
	streamNotifications,
} from '../../controllers/notificationController';
import { createGroupNotifications } from '../controllers/groupNotificationController';
import { createSessionNotifications } from '../controllers/sessionNotificationController';
import { createTeamUpNotifications } from '../controllers/teamUpNotificationController';
import { createTournamentNotifications } from '../controllers/tournamentNotificationController';
import { requireHeaderAuth } from '../internalAuth';

const router = Router();

router.get('/', requireHeaderAuth, getNotifications);
router.get('/stream', requireHeaderAuth, streamNotifications);
router.put('/read', requireHeaderAuth, markAsRead);
router.get('/stats', requireHeaderAuth, getStats);
router.get('/unread-count', requireHeaderAuth, getUnreadCount);
router.delete('/', requireHeaderAuth, deleteNotificationsEndpoint);
router.delete('/read', requireHeaderAuth, deleteAllReadNotificationsEndpoint);

router.post('/group', createGroupNotifications);
router.post('/session', createSessionNotifications);
router.post('/teamup', createTeamUpNotifications);
router.post('/tournament', createTournamentNotifications);

export default router;
