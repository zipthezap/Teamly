import { Router } from 'express';
import * as communityProxyController from '../controllers/proxies/communityProxyController';
import * as sessionProxyController from '../controllers/proxies/sessionProxyController';
import authMiddleware from '../middleware/auth';
import { apiLimiter, authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { cacheControl, noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Public routes (no authentication required)
router.get('/invite/:token', apiLimiter, asyncHandler(sessionProxyController.getEventByInviteToken));
router.post('/invite/:token/join', apiLimiter, asyncHandler(sessionProxyController.joinEventAsGuest));

// Protected routes (authentication required)
router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', noCache, asyncHandler(sessionProxyController.createEvent));
// Add ETag support with cache control for read endpoints
router.get('/', etagMiddleware({ weak: true }), cacheControl(60, { private: true, staleWhileRevalidate: 30 }), asyncHandler(communityProxyController.getEvents));
router.get('/export', noCache, asyncHandler(sessionProxyController.exportEvents));
// Cache nearby events for 5 minutes since location-based queries are expensive
router.get('/nearby', etagMiddleware({ weak: true }), cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(sessionProxyController.getNearbyEvents));
// Cache statistics for 5 minutes
router.get('/statistics', etagMiddleware({ weak: true }), cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(sessionProxyController.getUserStatistics));
// Cache individual session details for 2 minutes
router.get('/:id', etagMiddleware({ weak: true }), cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(sessionProxyController.getEvent));
router.get('/:id/participants', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(sessionProxyController.getEventParticipantsByStatus));
router.get('/:id/guests', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(sessionProxyController.getGuestParticipants));
router.post('/:id/generate-invite', noCache, asyncHandler(sessionProxyController.generateInviteToken));
router.put('/:id', noCache, asyncHandler(sessionProxyController.updateEvent));
router.delete('/:id', noCache, asyncHandler(sessionProxyController.deleteEvent));
router.post('/:id/join', noCache, asyncHandler(sessionProxyController.joinEvent));
router.post('/:id/join-invite', noCache, asyncHandler(sessionProxyController.joinEventViaInvite));
router.delete('/:id/leave', noCache, asyncHandler(sessionProxyController.leaveEvent));
router.post('/:id/invite', noCache, asyncHandler(sessionProxyController.inviteToEvent));
router.post('/:id/invitations/revoke', noCache, asyncHandler(sessionProxyController.revokeEventInvitation));
router.get('/:id/activity', etagMiddleware({ weak: true }), cacheControl(60, { private: true }), asyncHandler(sessionProxyController.getEventActivityFeed));
router.get('/:id/invitations/analytics', etagMiddleware({ weak: true }), cacheControl(120, { private: true }), asyncHandler(sessionProxyController.getEventInviteAnalytics));
router.post('/:id/invitations/generate-token', noCache, asyncHandler(sessionProxyController.generateEventInviteToken));
router.put('/:id/status', noCache, asyncHandler(sessionProxyController.updateParticipationStatus));
router.put('/:id/session-status', noCache, asyncHandler(sessionProxyController.updateSessionStatus));
router.put('/:id/guests/:guestId', noCache, asyncHandler(sessionProxyController.updateGuestParticipant));
router.put('/:id/guests/:guestId/status', noCache, asyncHandler(sessionProxyController.updateGuestParticipantStatus));
router.delete('/:id/guests/:guestId', noCache, asyncHandler(sessionProxyController.removeGuestParticipant));
router.post('/:id/archive', noCache, asyncHandler(sessionProxyController.archiveEvent));
router.post('/:id/unarchive', noCache, asyncHandler(sessionProxyController.unarchiveEvent));

// Recurring session routes
router.get('/:id/instances', cacheControl(120, { private: true }), asyncHandler(sessionProxyController.getRecurringEventInstances));
router.post('/:id/exceptions', noCache, asyncHandler(sessionProxyController.addRecurringEventException));
router.delete('/:id/exceptions', noCache, asyncHandler(sessionProxyController.removeRecurringEventException));

// Event reminder routes
router.post('/:sessionId/reminders', noCache, asyncHandler(sessionProxyController.createReminder));
router.get('/:sessionId/reminders', cacheControl(120, { private: true }), asyncHandler(sessionProxyController.getEventReminders));

// Event attendance routes
router.post('/:sessionId/attendance', noCache, asyncHandler(sessionProxyController.markAttendance));
router.get('/:sessionId/attendance', cacheControl(60, { private: true }), asyncHandler(sessionProxyController.getEventAttendance));
router.get('/:sessionId/attendance/stats', cacheControl(180, { private: true }), asyncHandler(sessionProxyController.getAttendanceStats));
router.delete('/:sessionId/attendance/:userId', noCache, asyncHandler(sessionProxyController.deleteAttendance));

export default router;
