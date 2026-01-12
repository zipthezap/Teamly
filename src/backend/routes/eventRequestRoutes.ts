import { Router } from 'express';
import * as eventRequestController from '../controllers/eventRequestController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create event request (members can create, admins approve)
router.post('/', asyncHandler(eventRequestController.createEventRequest));

// Get event requests for a group
router.get('/group/:groupId', asyncHandler(eventRequestController.getEventRequests));

// Get a specific event request
router.get('/:id', asyncHandler(eventRequestController.getEventRequest));

// Get voting statistics for an event request
router.get('/:id/statistics', asyncHandler(eventRequestController.getEventRequestStatistics));

// Vote on an event request
router.post('/:id/vote', asyncHandler(eventRequestController.voteOnEventRequest));

// Finalize event request (admin only)
router.post('/:id/finalize', asyncHandler(eventRequestController.finalizeEventRequest));

// Cancel event request (admin only)
router.post('/:id/cancel', asyncHandler(eventRequestController.cancelEventRequest));

export default router;
