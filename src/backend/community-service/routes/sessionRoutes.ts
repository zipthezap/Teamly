import { Router } from 'express';

import {
	addRecurringEventException,
	archiveEvent,
	createEvent,
	deleteEvent,
	exportEvents,
	generateEventInviteToken,
	generateInviteToken,
	getEvent,
	getEventByInviteToken,
	getEventInviteAnalytics,
	getEventParticipantsByStatus,
	getEvents,
	getGuestParticipants,
	getRecurringEventInstances,
	inviteToEvent,
	joinEvent,
	joinEventAsGuest,
	leaveEvent,
	removeRecurringEventException,
	removeGuestParticipant,
	revokeEventInvitation,
	unarchiveEvent,
	updateEvent,
	updateGuestParticipant,
	updateGuestParticipantStatus,
	updateParticipationStatus,
	updateSessionStatus,
} from '../../controllers/sessionController';
import {
	getEventActivityFeed,
	getUserStatistics,
} from '../controllers/sessionAnalyticsController';
import { getNearbyEvents } from '../controllers/sessionNearbyReadController';
import { createReminder, getEventReminders } from '../../controllers/reminderController';
import {
	deleteAttendance,
	getAttendanceStats,
	getEventAttendance,
	markAttendance,
} from '../../controllers/attendanceController';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireHeaderAuth } from '../headerAuth';

const router = Router();

router.get('/invite/:token', requireHeaderAuth, asyncHandler(getEventByInviteToken));
router.post('/invite/:token/join', requireHeaderAuth, asyncHandler(joinEventAsGuest));
router.post('/', requireHeaderAuth, asyncHandler(createEvent));
router.get('/', requireHeaderAuth, asyncHandler(getEvents));
router.get('/nearby', requireHeaderAuth, asyncHandler(getNearbyEvents));
router.get('/export', requireHeaderAuth, asyncHandler(exportEvents));
router.get('/:id', requireHeaderAuth, asyncHandler(getEvent));
router.get('/:id/participants', requireHeaderAuth, asyncHandler(getEventParticipantsByStatus));
router.get('/:id/guests', requireHeaderAuth, asyncHandler(getGuestParticipants));
router.put('/:id', requireHeaderAuth, asyncHandler(updateEvent));
router.delete('/:id', requireHeaderAuth, asyncHandler(deleteEvent));
router.post('/:id/join', requireHeaderAuth, asyncHandler(joinEvent));
router.delete('/:id/leave', requireHeaderAuth, asyncHandler(leaveEvent));
router.put('/:id/status', requireHeaderAuth, asyncHandler(updateParticipationStatus));
router.put('/:id/guests/:guestId', requireHeaderAuth, asyncHandler(updateGuestParticipant));
router.put('/:id/guests/:guestId/status', requireHeaderAuth, asyncHandler(updateGuestParticipantStatus));
router.delete('/:id/guests/:guestId', requireHeaderAuth, asyncHandler(removeGuestParticipant));
router.post('/:id/invite', requireHeaderAuth, asyncHandler(inviteToEvent));
router.post('/:id/invitations/revoke', requireHeaderAuth, asyncHandler(revokeEventInvitation));
router.post('/:id/invitations/generate-token', requireHeaderAuth, asyncHandler(generateEventInviteToken));
router.post('/:id/generate-invite', requireHeaderAuth, asyncHandler(generateInviteToken));
router.put('/:id/session-status', requireHeaderAuth, asyncHandler(updateSessionStatus));
router.post('/:id/archive', requireHeaderAuth, asyncHandler(archiveEvent));
router.post('/:id/unarchive', requireHeaderAuth, asyncHandler(unarchiveEvent));
router.get('/statistics', requireHeaderAuth, asyncHandler(getUserStatistics));
router.get('/:id/activity', requireHeaderAuth, asyncHandler(getEventActivityFeed));
router.get('/:id/invitations/analytics', requireHeaderAuth, asyncHandler(getEventInviteAnalytics));
router.get('/:id/instances', requireHeaderAuth, asyncHandler(getRecurringEventInstances));
router.post('/:id/exceptions', requireHeaderAuth, asyncHandler(addRecurringEventException));
router.delete('/:id/exceptions', requireHeaderAuth, asyncHandler(removeRecurringEventException));
router.post('/:sessionId/reminders', requireHeaderAuth, createReminder);
router.get('/:sessionId/reminders', requireHeaderAuth, getEventReminders);
router.post('/:sessionId/attendance', requireHeaderAuth, markAttendance);
router.get('/:sessionId/attendance', requireHeaderAuth, getEventAttendance);
router.get('/:sessionId/attendance/stats', requireHeaderAuth, getAttendanceStats);
router.delete('/:sessionId/attendance/:userId', requireHeaderAuth, deleteAttendance);

export default router;
