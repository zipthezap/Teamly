import { Router } from 'express';
import * as sessionRequestProxyController from '../controllers/proxies/sessionRequestProxyController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create session request (members can create, admins approve)
router.post('/', noCache, asyncHandler(sessionRequestProxyController.createEventRequest));

// Get session requests for a group
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/group/:groupId', etagMiddleware({ weak: true }), asyncHandler(sessionRequestProxyController.getEventRequests));

// Get a specific session request
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(sessionRequestProxyController.getEventRequest));

// Get voting statistics for an session request
router.get('/:id/statistics', etagMiddleware({ weak: true }), asyncHandler(sessionRequestProxyController.getEventRequestStatistics));

// Vote on an session request
router.post('/:id/vote', noCache, asyncHandler(sessionRequestProxyController.voteOnEventRequest));

// Finalize session request (admin only)
router.post('/:id/finalize', noCache, asyncHandler(sessionRequestProxyController.finalizeEventRequest));

// Cancel session request (admin only)
router.post('/:id/cancel', noCache, asyncHandler(sessionRequestProxyController.cancelEventRequest));

export default router;
