import { Router } from 'express';
import * as eventController from '../controllers/eventController';
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

export default router;
