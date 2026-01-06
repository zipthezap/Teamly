import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public join via invite link (no auth)
router.post('/join', groupController.joinGroupByInvite);

// Public route to get all public groups
router.get('/public', groupController.getPublicGroups);

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroup);
router.put('/:id', groupController.updateGroup);
router.post('/:id/invite', groupController.inviteMember);
router.delete('/:id/members/:memberId', groupController.removeMember);
router.delete('/:id/leave', groupController.leaveGroup);
router.get('/:id/invite-link', groupController.getInviteLink);

// Join request routes
router.post('/:id/join-request', groupController.requestJoinGroup);
router.get('/:id/join-requests', groupController.getJoinRequests);
router.post('/:id/join-requests/:requestId', groupController.handleJoinRequest);

export default router;
