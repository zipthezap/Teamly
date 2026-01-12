import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import * as notificationPref from '../controllers/notificationPreferenceController';

const router = Router();

router.get('/', authMiddleware, notificationPref.getNotificationPreferences);
router.put('/', authMiddleware, notificationPref.updateNotificationPreferences);

export default router;
