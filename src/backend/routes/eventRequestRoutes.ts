import { Router } from 'express';
import * as eventRequestController from '../controllers/eventRequestController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create event request (members can create, admins approve)
router.post('/', noCache, asyncHandler(eventRequestController.createEventRequest));

// Get event requests for a group
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/group/:groupId', etagMiddleware({ weak: true }), asyncHandler(eventRequestController.getEventRequests));

// Get a specific event request
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(eventRequestController.getEventRequest));

// Get voting statistics for an event request
router.get('/:id/statistics', etagMiddleware({ weak: true }), asyncHandler(eventRequestController.getEventRequestStatistics));

// Vote on an event request
router.post('/:id/vote', noCache, asyncHandler(eventRequestController.voteOnEventRequest));

// Finalize event request (admin only)
router.post('/:id/finalize', noCache, asyncHandler(eventRequestController.finalizeEventRequest));

// Cancel event request (admin only)
router.post('/:id/cancel', noCache, asyncHandler(eventRequestController.cancelEventRequest));

export default router;
