import { Router } from 'express';
import * as reminderController from '../controllers/reminderController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// User's all reminders
router.get('/', reminderController.getUserReminders);

// Reminder management
router.put('/:reminderId', reminderController.updateReminder);
router.delete('/:reminderId', reminderController.deleteReminder);

export default router;
