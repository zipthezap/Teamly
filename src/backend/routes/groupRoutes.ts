import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth';
import { authenticatedLimiter, uploadLimiter } from '../middleware/rateLimiter';
import { uploadGroupPicture } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public join via invite link (no auth)
router.post('/join', asyncHandler(groupController.joinGroupByInvite));

// Public route to get all public groups (with optional auth to filter out user's groups)
router.get('/public', optionalAuthMiddleware, asyncHandler(groupController.getPublicGroups));

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', asyncHandler(groupController.createGroup));
router.get('/', asyncHandler(groupController.getGroups));
router.get('/nearby', asyncHandler(groupController.getNearbyGroups));
router.get('/:id', asyncHandler(groupController.getGroup));

// Delete group (admin only)
router.delete('/:id', asyncHandler(groupController.deleteGroup));
router.put('/:id', asyncHandler(groupController.updateGroup));
router.post('/:id/invite', asyncHandler(groupController.inviteMember));
router.delete('/:id/members/:memberId', asyncHandler(groupController.removeMember));
router.put('/:id/members/:memberId/role', asyncHandler(groupController.updateMemberRole));
router.delete('/:id/leave', asyncHandler(groupController.leaveGroup));
// Transfer admin before leaving
router.post('/:id/transfer-admin', asyncHandler(groupController.transferAdmin));
router.get('/:id/invite-link', asyncHandler(groupController.getInviteLink));

// Group picture management (admin only)
router.post(
  '/:id/picture',
  uploadLimiter,
  uploadGroupPicture,
  asyncHandler(groupController.uploadGroupPicture)
);
router.delete('/:id/picture', asyncHandler(groupController.deleteGroupPicture));

// Join request routes
router.post('/:id/join-request', asyncHandler(groupController.requestJoinGroup));
router.get('/:id/join-requests', asyncHandler(groupController.getJoinRequests));
router.post('/:id/join-requests/:requestId', asyncHandler(groupController.handleJoinRequest));

export default router;
