const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth');
const { authenticatedLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.post('/:id/join', eventController.joinEvent);
router.delete('/:id/leave', eventController.leaveEvent);
router.put('/:id/status', eventController.updateParticipationStatus);

// Recurring event routes
router.get('/:id/instances', eventController.getRecurringEventInstances);
router.post('/:id/exceptions', eventController.addRecurringEventException);
router.delete('/:id/exceptions', eventController.removeRecurringEventException);

module.exports = router;
