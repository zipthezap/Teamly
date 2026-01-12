import { Router } from 'express';
import * as teamUpController from '../controllers/teamUpController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTeamUpCreatorOrGroupAdmin } from '../middleware/authorization';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create a TeamUp request
router.post('/', asyncHandler(teamUpController.createTeamUpRequest));

// Get all TeamUp requests (browse with filters)
router.get('/', asyncHandler(teamUpController.getTeamUpRequests));

// Get nearby TeamUp requests
router.get('/nearby', asyncHandler(teamUpController.getNearbyTeamUpRequests));

// Get user's own TeamUp requests
router.get('/my-requests', asyncHandler(teamUpController.getMyTeamUpRequests));

// Get responses for user's TeamUp requests
router.get('/my-responses', asyncHandler(teamUpController.getMyTeamUpResponses));

// Get a specific TeamUp request
router.get('/:id', asyncHandler(teamUpController.getTeamUpRequest));

// Update a TeamUp request (creator or community admin)
router.put('/:id', requireTeamUpCreatorOrGroupAdmin, asyncHandler(teamUpController.updateTeamUpRequest));

// Delete a TeamUp request (creator or community admin)
router.delete('/:id', requireTeamUpCreatorOrGroupAdmin, asyncHandler(teamUpController.deleteTeamUpRequest));

// Respond to a TeamUp request
router.post('/:id/respond', asyncHandler(teamUpController.respondToTeamUpRequest));

// Accept or decline a response (creator only)
router.post('/:id/responses/:responseId', asyncHandler(teamUpController.handleTeamUpResponse));

// Get comments for a TeamUp request
router.get('/:id/comments', asyncHandler(teamUpController.getTeamUpComments));

// Add a comment to a TeamUp request
router.post('/:id/comments', asyncHandler(teamUpController.addTeamUpComment));

// Delete a comment (author or community admin)
router.delete('/:id/comments/:commentId', asyncHandler(teamUpController.deleteTeamUpComment));

export default router;
