import { Router } from 'express';

import { createGroupNotifications } from '../controllers/groupNotificationController';
import { createSessionNotifications } from '../controllers/sessionNotificationController';
import { createTeamUpNotifications } from '../controllers/teamUpNotificationController';
import { createTournamentNotifications } from '../controllers/tournamentNotificationController';

const router = Router();

router.post('/group', createGroupNotifications);
router.post('/session', createSessionNotifications);
router.post('/teamup', createTeamUpNotifications);
router.post('/tournament', createTournamentNotifications);

export default router;
