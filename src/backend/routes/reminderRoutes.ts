import { Router } from 'express';
import * as reminderController from '../controllers/reminderController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// User's all reminders
router.get('/', asyncHandler(reminderController.getUserReminders));

// Reminder management
router.put('/:reminderId', asyncHandler(reminderController.updateReminder));
router.delete('/:reminderId', asyncHandler(reminderController.deleteReminder));

export default router;
