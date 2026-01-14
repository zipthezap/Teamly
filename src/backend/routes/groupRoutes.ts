import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth';
import { distributedAuthenticatedLimiter, distributedUploadLimiter } from '../middleware/distributedRateLimiter';
import { uploadGroupPicture } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';
import { etagMiddleware, privateCache } from '../middleware/etag';

const router = Router();

// Join via invite link - requires authentication to ensure user identity
// Changed from public to authenticated to prevent privilege escalation
router.post('/join/:groupId', authMiddleware, asyncHandler(groupController.joinGroupByInvite));

// Public route to get all public groups (with optional auth to filter out user's groups)
router.get('/public', optionalAuthMiddleware, asyncHandler(groupController.getPublicGroups));

router.use(authMiddleware);
router.use(distributedAuthenticatedLimiter);

router.post('/', asyncHandler(groupController.createGroup));
// Add ETag and cache control for frequently accessed read endpoints
router.get('/', etagMiddleware({ weak: true }), privateCache(60), asyncHandler(groupController.getGroups));
router.get('/nearby', asyncHandler(groupController.getNearbyGroups));
router.get('/:id', etagMiddleware({ weak: true }), privateCache(30), asyncHandler(groupController.getGroup));

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
  distributedUploadLimiter,
  uploadGroupPicture,
  asyncHandler(groupController.uploadGroupPicture)
);
router.delete('/:id/picture', asyncHandler(groupController.deleteGroupPicture));

// Join request routes
router.post('/:id/join-request', asyncHandler(groupController.requestJoinGroup));
router.get('/:id/join-requests', asyncHandler(groupController.getJoinRequests));
router.post('/:id/join-requests/:requestId', asyncHandler(groupController.handleJoinRequest));

export default router;
