import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import * as notificationPref from '../controllers/notificationPreferenceController';

const router = Router();

router.get('/', authMiddleware, asyncHandler(notificationPref.getNotificationPreferences));
router.put('/', authMiddleware, asyncHandler(notificationPref.updateNotificationPreferences));

export default router;
