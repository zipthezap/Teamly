import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import * as reminderController from '../controllers/reminderController';
import * as attendanceController from '../controllers/attendanceController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { cacheControl, noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Public routes (no authentication required)
router.get('/invite/:token', asyncHandler(eventController.getEventByInviteToken));
router.post('/invite/:token/join', asyncHandler(eventController.joinEventAsGuest));

// Protected routes (authentication required)
router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', noCache, asyncHandler(eventController.createEvent));
// Add ETag support with cache control for read endpoints
router.get('/', etagMiddleware({ weak: true }), cacheControl(60, { private: true, staleWhileRevalidate: 30 }), asyncHandler(eventController.getEvents));
router.get('/export', noCache, asyncHandler(eventController.exportEvents));
// Cache nearby events for 5 minutes since location-based queries are expensive
router.get('/nearby', etagMiddleware({ weak: true }), cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(eventController.getNearbyEvents));
// Cache statistics for 5 minutes
router.get('/statistics', etagMiddleware({ weak: true }), cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(eventController.getUserStatistics));
// Cache individual event details for 2 minutes
router.get('/:id', etagMiddleware({ weak: true }), cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(eventController.getEvent));
router.get('/:id/participants', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(eventController.getEventParticipantsByStatus));
router.get('/:id/guests', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(eventController.getGuestParticipants));
router.get('/:id/activity', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(eventController.getEventActivityFeed));
router.post('/:id/generate-invite', noCache, asyncHandler(eventController.generateInviteToken));
router.put('/:id', noCache, asyncHandler(eventController.updateEvent));
router.delete('/:id', noCache, asyncHandler(eventController.deleteEvent));
router.post('/:id/join', noCache, asyncHandler(eventController.joinEvent));
router.delete('/:id/leave', noCache, asyncHandler(eventController.leaveEvent));
router.put('/:id/status', noCache, asyncHandler(eventController.updateParticipationStatus));
router.put('/:id/event-status', noCache, asyncHandler(eventController.updateEventStatus));
router.put('/:id/guests/:guestId', noCache, asyncHandler(eventController.updateGuestParticipant));
router.put('/:id/guests/:guestId/status', noCache, asyncHandler(eventController.updateGuestParticipantStatus));
router.delete('/:id/guests/:guestId', noCache, asyncHandler(eventController.removeGuestParticipant));
router.post('/:id/archive', noCache, asyncHandler(eventController.archiveEvent));
router.post('/:id/unarchive', noCache, asyncHandler(eventController.unarchiveEvent));

// Recurring event routes
router.get('/:id/instances', cacheControl(120, { private: true }), asyncHandler(eventController.getRecurringEventInstances));
router.post('/:id/exceptions', noCache, asyncHandler(eventController.addRecurringEventException));
router.delete('/:id/exceptions', noCache, asyncHandler(eventController.removeRecurringEventException));

// Event reminder routes
router.post('/:eventId/reminders', noCache, reminderController.createReminder);
router.get('/:eventId/reminders', cacheControl(120, { private: true }), reminderController.getEventReminders);

// Event attendance routes
router.post('/:eventId/attendance', noCache, attendanceController.markAttendance);
router.get('/:eventId/attendance', cacheControl(60, { private: true }), attendanceController.getEventAttendance);
router.get('/:eventId/attendance/stats', cacheControl(180, { private: true }), attendanceController.getAttendanceStats);
router.delete('/:eventId/attendance/:userId', noCache, attendanceController.deleteAttendance);

export default router;
