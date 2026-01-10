import { Router } from 'express';
import * as teamUpController from '../controllers/teamUpController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create a TeamUp request
router.post('/', teamUpController.createTeamUpRequest);

// Get all TeamUp requests (browse with filters)
router.get('/', teamUpController.getTeamUpRequests);

// Get user's own TeamUp requests
router.get('/my-requests', teamUpController.getMyTeamUpRequests);

// Get responses for user's TeamUp requests
router.get('/my-responses', teamUpController.getMyTeamUpResponses);

// Get a specific TeamUp request
router.get('/:id', teamUpController.getTeamUpRequest);

// Update a TeamUp request
router.put('/:id', teamUpController.updateTeamUpRequest);

// Delete a TeamUp request
router.delete('/:id', teamUpController.deleteTeamUpRequest);

// Respond to a TeamUp request
router.post('/:id/respond', teamUpController.respondToTeamUpRequest);

// Accept or decline a response (creator only)
router.post('/:id/responses/:responseId', teamUpController.handleTeamUpResponse);

export default router;
