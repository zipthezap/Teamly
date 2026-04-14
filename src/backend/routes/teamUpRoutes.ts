import { Router } from 'express';
import * as teamUpController from '../controllers/teamUpController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTeamUpPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';
import { cacheControl, noCache } from '../middleware/cacheControl';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create a TeamUp request (authenticated users can create)
router.post('/', noCache, asyncHandler(teamUpController.createTeamUpRequest));

// Get all TeamUp requests (browse with filters) - cache for 60 seconds
router.get('/', cacheControl(60, { private: true, staleWhileRevalidate: 30 }), asyncHandler(teamUpController.getTeamUpRequests));

// Get nearby TeamUp requests - cache for 5 minutes (location queries are expensive)
router.get('/nearby', cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(teamUpController.getNearbyTeamUpRequests));

// Get user's own TeamUp requests - cache for 2 minutes
router.get('/my-requests', cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(teamUpController.getMyTeamUpRequests));

// Get applications I submitted (responder view: responses I submitted to others' requests)
router.get('/my-applications', cacheControl(60, { private: true }), asyncHandler(teamUpController.getMyTeamUpApplications));

// Get responses for user's TeamUp requests - cache for 1 minute
router.get('/my-responses', cacheControl(60, { private: true }), asyncHandler(teamUpController.getMyTeamUpResponses));

// Get a specific TeamUp request - cache for 2 minutes
router.get('/:id', cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(teamUpController.getTeamUpRequest));

// Update a TeamUp request (creator only)
router.put(
  '/:id',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_UPDATE),
  asyncHandler(teamUpController.updateTeamUpRequest)
);

// Delete a TeamUp request (creator only)
router.delete(
  '/:id',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_DELETE),
  asyncHandler(teamUpController.deleteTeamUpRequest)
);

// Respond to a TeamUp request (authenticated users can respond)
router.post('/:id/respond', noCache, asyncHandler(teamUpController.respondToTeamUpRequest));

// Accept or decline a response (creator only)
router.post(
  '/:id/responses/:responseId',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpController.handleTeamUpResponse)
);

// Get comments for a TeamUp request - cache for 1 minute
router.get('/:id/comments', cacheControl(60, { private: true }), asyncHandler(teamUpController.getTeamUpComments));

// Add a comment to a TeamUp request (authenticated users can comment)
router.post('/:id/comments', noCache, asyncHandler(teamUpController.addTeamUpComment));

// Delete a comment (author only)
router.delete('/:id/comments/:commentId', noCache, asyncHandler(teamUpController.deleteTeamUpComment));

export default router;
