import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import * as reminderController from '../controllers/reminderController';
import * as attendanceController from '../controllers/attendanceController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public routes (no authentication required)
router.get('/invite/:token', asyncHandler(eventController.getEventByInviteToken));
router.post('/invite/:token/join', asyncHandler(eventController.joinEventAsGuest));

// Protected routes (authentication required)
router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', asyncHandler(eventController.createEvent));
router.get('/', asyncHandler(eventController.getEvents));
router.get('/export', asyncHandler(eventController.exportEvents));
router.get('/nearby', asyncHandler(eventController.getNearbyEvents));
router.get('/statistics', asyncHandler(eventController.getUserStatistics));
router.get('/:id', asyncHandler(eventController.getEvent));
router.get('/:id/participants', asyncHandler(eventController.getEventParticipantsByStatus));
router.get('/:id/guests', asyncHandler(eventController.getGuestParticipants));
router.get('/:id/activity', asyncHandler(eventController.getEventActivityFeed));
router.post('/:id/generate-invite', asyncHandler(eventController.generateInviteToken));
router.put('/:id', asyncHandler(eventController.updateEvent));
router.delete('/:id', asyncHandler(eventController.deleteEvent));
router.post('/:id/join', asyncHandler(eventController.joinEvent));
router.delete('/:id/leave', asyncHandler(eventController.leaveEvent));
router.put('/:id/status', asyncHandler(eventController.updateParticipationStatus));
router.put('/:id/event-status', asyncHandler(eventController.updateEventStatus));
router.put('/:id/guests/:guestId', asyncHandler(eventController.updateGuestParticipant));
router.put('/:id/guests/:guestId/status', asyncHandler(eventController.updateGuestParticipantStatus));
router.delete('/:id/guests/:guestId', asyncHandler(eventController.removeGuestParticipant));
router.post('/:id/archive', asyncHandler(eventController.archiveEvent));
router.post('/:id/unarchive', asyncHandler(eventController.unarchiveEvent));

// Recurring event routes
router.get('/:id/instances', asyncHandler(eventController.getRecurringEventInstances));
router.post('/:id/exceptions', asyncHandler(eventController.addRecurringEventException));
router.delete('/:id/exceptions', asyncHandler(eventController.removeRecurringEventException));

// Event reminder routes
router.post('/:eventId/reminders', reminderController.createReminder);
router.get('/:eventId/reminders', reminderController.getEventReminders);

// Event attendance routes
router.post('/:eventId/attendance', attendanceController.markAttendance);
router.get('/:eventId/attendance', attendanceController.getEventAttendance);
router.get('/:eventId/attendance/stats', attendanceController.getAttendanceStats);
router.delete('/:eventId/attendance/:userId', attendanceController.deleteAttendance);

export default router;
