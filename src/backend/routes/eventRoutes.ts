import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import * as reminderController from '../controllers/reminderController';
import * as attendanceController from '../controllers/attendanceController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes (no authentication required)
router.get('/invite/:token', eventController.getEventByInviteToken);
router.post('/invite/:token/join', eventController.joinEventAsGuest);

// Protected routes (authentication required)
router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/export', eventController.exportEvents);
router.get('/nearby', eventController.getNearbyEvents);
router.get('/statistics', eventController.getUserStatistics);
router.get('/:id', eventController.getEvent);
router.get('/:id/participants', eventController.getEventParticipantsByStatus);
router.get('/:id/activity', eventController.getEventActivityFeed);
router.post('/:id/generate-invite', eventController.generateInviteToken);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.post('/:id/join', eventController.joinEvent);
router.delete('/:id/leave', eventController.leaveEvent);
router.put('/:id/status', eventController.updateParticipationStatus);
router.put('/:id/event-status', eventController.updateEventStatus);
router.post('/:id/archive', eventController.archiveEvent);
router.post('/:id/unarchive', eventController.unarchiveEvent);

// Recurring event routes
router.get('/:id/instances', eventController.getRecurringEventInstances);
router.post('/:id/exceptions', eventController.addRecurringEventException);
router.delete('/:id/exceptions', eventController.removeRecurringEventException);

// Event reminder routes
router.post('/:eventId/reminders', reminderController.createReminder);
router.get('/:eventId/reminders', reminderController.getEventReminders);

// Event attendance routes
router.post('/:eventId/attendance', attendanceController.markAttendance);
router.get('/:eventId/attendance', attendanceController.getEventAttendance);
router.get('/:eventId/attendance/stats', attendanceController.getAttendanceStats);
router.delete('/:eventId/attendance/:userId', attendanceController.deleteAttendance);

export default router;
