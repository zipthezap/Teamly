const express = require('express');
const router = express.Router();
const eventRequestController = require('../controllers/eventRequestController');
const authMiddleware = require('../middleware/auth');
const { authenticatedLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create event request (admin only)
router.post('/', eventRequestController.createEventRequest);

// Get event requests for a group
router.get('/group/:groupId', eventRequestController.getEventRequests);

// Get a specific event request
router.get('/:id', eventRequestController.getEventRequest);

// Vote on an event request
router.post('/:id/vote', eventRequestController.voteOnEventRequest);

// Finalize event request (admin only)
router.post('/:id/finalize', eventRequestController.finalizeEventRequest);

// Cancel event request (admin only)
router.post('/:id/cancel', eventRequestController.cancelEventRequest);

module.exports = router;
