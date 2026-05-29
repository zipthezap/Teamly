import { Router } from 'express';
import * as communityProxyController from '../controllers/proxies/communityProxyController';
import * as groupProxyController from '../controllers/proxies/groupProxyController';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth';
import { distributedAuthenticatedLimiter, distributedUploadLimiter, distributedApiLimiter } from '../middleware/distributedRateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Public route to get group info by invite token (no auth required for preview)
router.get('/join/:token', distributedApiLimiter, asyncHandler(groupProxyController.getGroupByInviteToken));

// Get group info for invite preview (public groups only, optional auth)
router.get('/invite/:groupId', optionalAuthMiddleware, distributedApiLimiter, asyncHandler(groupProxyController.getGroupForInvite));

// Join via invite link - requires authentication to ensure user identity
// Changed from public to authenticated to prevent privilege escalation
// SECURITY: Added rate limiting to prevent abuse
router.post('/join/:groupId', authMiddleware, distributedAuthenticatedLimiter, asyncHandler(groupProxyController.joinGroupByInvite));

// Public route to get all public groups (with optional auth to filter out user's groups)
// SECURITY: Added rate limiting to prevent abuse of public discovery endpoint
router.get('/public', optionalAuthMiddleware, distributedApiLimiter, asyncHandler(communityProxyController.getPublicGroups));

router.use(authMiddleware);
router.use(distributedAuthenticatedLimiter);

// Get user's pending invitations (must come before /:id routes)
router.get('/invitations/pending', asyncHandler(groupProxyController.getUserInvitations));
router.get('/my-join-requests', asyncHandler(groupProxyController.getMyJoinRequests));

router.post('/', asyncHandler(groupProxyController.createGroup));
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data; server-side cache (Redis/in-memory) remains active
router.get('/', etagMiddleware({ weak: true }), asyncHandler(groupProxyController.getGroups));
router.get('/nearby', asyncHandler(groupProxyController.getNearbyGroups));
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(groupProxyController.getGroup));


// Get all members for a group
router.get('/:id/members', asyncHandler(groupProxyController.getGroupMembers));
// Delete group (admin only)
router.delete('/:id', asyncHandler(groupProxyController.deleteGroup));
router.put('/:id', asyncHandler(groupProxyController.updateGroup));
router.post('/:id/invite', asyncHandler(groupProxyController.inviteMember));
router.post('/:id/invitations/bulk', asyncHandler(groupProxyController.bulkInviteMembers));
router.post('/:id/invitations/revoke', asyncHandler(groupProxyController.revokeInvitation));
router.get('/:id/invitations/analytics', asyncHandler(groupProxyController.getInviteAnalytics));
router.post('/:id/invitations/generate-token', asyncHandler(groupProxyController.generateInviteToken));
router.delete('/:id/members/:memberId', asyncHandler(groupProxyController.removeMember));
// Remove member by userId (admin only)
router.delete('/:id/members/user/:userId', asyncHandler(groupProxyController.removeMemberByUserId));
router.put('/:id/members/:memberId/role', asyncHandler(groupProxyController.updateMemberRole));
router.delete('/:id/leave', asyncHandler(groupProxyController.leaveGroup));
// Transfer admin before leaving
router.post('/:id/transfer-admin', asyncHandler(groupProxyController.transferAdmin));
router.get('/:id/invite-link', asyncHandler(groupProxyController.getInviteLink));

// Generate or regenerate group invite token (admin/moderator only)
router.post('/:id/invite-token', asyncHandler(groupProxyController.generateGroupInviteToken));

// Join group via invite token (authenticated)
router.post('/join-by-token/:token', asyncHandler(groupProxyController.joinGroupByInviteToken));

// Group picture management (admin only)
router.post(
  '/:id/picture',
  distributedUploadLimiter,
  asyncHandler(groupProxyController.uploadGroupPicture)
);
router.delete('/:id/picture', asyncHandler(groupProxyController.deleteGroupPicture));

// Join request routes
router.post('/:id/join-request', asyncHandler(groupProxyController.requestJoinGroup));
router.get('/:id/join-requests', asyncHandler(groupProxyController.getJoinRequests));
router.post('/:id/join-requests/:requestId', asyncHandler(groupProxyController.handleJoinRequest));
router.delete('/:id/join-requests/:requestId', asyncHandler(groupProxyController.cancelMyJoinRequest));
// Allow invited users to respond to their invitations
router.post('/:id/invitations/:requestId/respond', asyncHandler(groupProxyController.respondToInvitation));

export default router;
