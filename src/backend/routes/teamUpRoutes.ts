import { Router } from 'express';
import * as teamUpController from '../controllers/teamUpController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTeamUpPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create a TeamUp request (authenticated users can create)
router.post('/', asyncHandler(teamUpController.createTeamUpRequest));

// Get all TeamUp requests (browse with filters) - public to authenticated users
router.get('/', asyncHandler(teamUpController.getTeamUpRequests));

// Get nearby TeamUp requests - public to authenticated users
router.get('/nearby', asyncHandler(teamUpController.getNearbyTeamUpRequests));

// Get user's own TeamUp requests
router.get('/my-requests', asyncHandler(teamUpController.getMyTeamUpRequests));

// Get responses for user's TeamUp requests
router.get('/my-responses', asyncHandler(teamUpController.getMyTeamUpResponses));

// Get a specific TeamUp request - public to authenticated users
router.get('/:id', asyncHandler(teamUpController.getTeamUpRequest));

// Update a TeamUp request (creator only)
router.put(
  '/:id',
  requireTeamUpPermission(Permission.TEAMUP_UPDATE),
  asyncHandler(teamUpController.updateTeamUpRequest)
);

// Delete a TeamUp request (creator only)
router.delete(
  '/:id',
  requireTeamUpPermission(Permission.TEAMUP_DELETE),
  asyncHandler(teamUpController.deleteTeamUpRequest)
);

// Respond to a TeamUp request (authenticated users can respond)
router.post('/:id/respond', asyncHandler(teamUpController.respondToTeamUpRequest));

// Accept or decline a response (creator only)
router.post(
  '/:id/responses/:responseId',
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpController.handleTeamUpResponse)
);

// Get comments for a TeamUp request - public to authenticated users
router.get('/:id/comments', asyncHandler(teamUpController.getTeamUpComments));

// Add a comment to a TeamUp request (authenticated users can comment)
router.post('/:id/comments', asyncHandler(teamUpController.addTeamUpComment));

// Delete a comment (author only)
router.delete('/:id/comments/:commentId', asyncHandler(teamUpController.deleteTeamUpComment));

export default router;
