const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.post('/:id/join', eventController.joinEvent);
router.delete('/:id/leave', eventController.leaveEvent);
router.put('/:id/status', eventController.updateParticipationStatus);

module.exports = router;
