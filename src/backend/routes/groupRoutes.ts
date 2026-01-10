import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter, uploadLimiter } from '../middleware/rateLimiter';
import { uploadGroupPicture } from '../middleware/upload';

const router = Router();

// Public join via invite link (no auth)
router.post('/join', groupController.joinGroupByInvite);

// Public route to get all public groups
router.get('/public', groupController.getPublicGroups);

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/nearby', groupController.getNearbyGroups);
router.get('/:id', groupController.getGroup);

// Delete group (admin only)
router.delete('/:id', groupController.deleteGroup);
router.put('/:id', groupController.updateGroup);
router.post('/:id/invite', groupController.inviteMember);
router.delete('/:id/members/:memberId', groupController.removeMember);
router.put('/:id/members/:memberId/role', groupController.updateMemberRole);
router.delete('/:id/leave', groupController.leaveGroup);
// Transfer admin before leaving
router.post('/:id/transfer-admin', groupController.transferAdmin);
router.get('/:id/invite-link', groupController.getInviteLink);

// Group picture management (admin only)
router.post(
  '/:id/picture',
  uploadLimiter,
  uploadGroupPicture,
  groupController.uploadGroupPicture
);
router.delete('/:id/picture', groupController.deleteGroupPicture);

// Join request routes
router.post('/:id/join-request', groupController.requestJoinGroup);
router.get('/:id/join-requests', groupController.getJoinRequests);
router.post('/:id/join-requests/:requestId', groupController.handleJoinRequest);

export default router;
