import { Router } from 'express';

import {
	deleteGroupPicture,
	getGroupByInviteToken,
	getGroupForInvite,
	joinGroupByInvite,
	cancelMyJoinRequest,
	createGroup,
	deleteGroup,
	bulkInviteMembers,
	generateGroupInviteToken,
	generateInviteToken,
	getInviteLink,
	getJoinRequests,
	getPublicGroups,
	handleJoinRequest,
	inviteMember,
	joinGroupByInviteToken,
	leaveGroup,
	removeMember,
	removeMemberByUserId,
	respondToInvitation,
	revokeInvitation,
	requestJoinGroup,
	transferAdmin,
	updateGroup,
	updateMemberRole,
	uploadGroupPicture,
} from '../../controllers/groupController';
import { getMyJoinRequests, getUserInvitations } from '../controllers/groupInviteReadController';
import { getGroup } from '../controllers/groupDetailReadController';
import { getGroups } from '../controllers/groupListReadController';
import { getGroupMembers } from '../controllers/groupMemberReadController';
import { getNearbyGroups } from '../controllers/groupNearbyReadController';
import { getInviteAnalytics } from '../controllers/groupAnalyticsController';
import { asyncHandler } from '../../middleware/asyncHandler';
import { uploadGroupPicture as uploadGroupPictureMiddleware } from '../../middleware/upload';
import { optionalHeaderAuth, requireHeaderAuth } from '../headerAuth';

const router = Router();

router.get('/public', optionalHeaderAuth, asyncHandler(getPublicGroups));
router.get('/join/:token', optionalHeaderAuth, asyncHandler(getGroupByInviteToken));
router.get('/invite/:groupId', optionalHeaderAuth, asyncHandler(getGroupForInvite));
router.post('/join/:groupId', requireHeaderAuth, asyncHandler(joinGroupByInvite));
router.get('/', requireHeaderAuth, asyncHandler(getGroups));
router.get('/nearby', requireHeaderAuth, asyncHandler(getNearbyGroups));
router.post('/', requireHeaderAuth, asyncHandler(createGroup));
router.put('/:id', requireHeaderAuth, asyncHandler(updateGroup));
router.delete('/:id', requireHeaderAuth, asyncHandler(deleteGroup));
router.post('/:id/invite', requireHeaderAuth, asyncHandler(inviteMember));
router.post('/:id/invitations/bulk', requireHeaderAuth, asyncHandler(bulkInviteMembers));
router.post('/:id/invitations/revoke', requireHeaderAuth, asyncHandler(revokeInvitation));
router.get('/:id/invitations/analytics', requireHeaderAuth, asyncHandler(getInviteAnalytics));
router.post('/:id/invitations/generate-token', requireHeaderAuth, asyncHandler(generateInviteToken));
router.get('/:id/invite-link', requireHeaderAuth, asyncHandler(getInviteLink));
router.post('/:id/invite-token', requireHeaderAuth, asyncHandler(generateGroupInviteToken));
router.post('/join-by-token/:token', requireHeaderAuth, asyncHandler(joinGroupByInviteToken));
router.post('/:id/join-request', requireHeaderAuth, asyncHandler(requestJoinGroup));
router.get('/:id/join-requests', requireHeaderAuth, asyncHandler(getJoinRequests));
router.get('/:id/members', requireHeaderAuth, asyncHandler(getGroupMembers));
router.post('/:id/picture', requireHeaderAuth, uploadGroupPictureMiddleware, asyncHandler(uploadGroupPicture));
router.delete('/:id/picture', requireHeaderAuth, asyncHandler(deleteGroupPicture));
router.post('/:id/join-requests/:requestId', requireHeaderAuth, asyncHandler(handleJoinRequest));
router.delete('/:id/join-requests/:requestId', requireHeaderAuth, asyncHandler(cancelMyJoinRequest));
router.delete('/:id/members/:memberId', requireHeaderAuth, asyncHandler(removeMember));
router.delete('/:id/members/user/:userId', requireHeaderAuth, asyncHandler(removeMemberByUserId));
router.put('/:id/members/:memberId/role', requireHeaderAuth, asyncHandler(updateMemberRole));
router.delete('/:id/leave', requireHeaderAuth, asyncHandler(leaveGroup));
router.post('/:id/transfer-admin', requireHeaderAuth, asyncHandler(transferAdmin));
router.post('/:id/invitations/:requestId/respond', requireHeaderAuth, asyncHandler(respondToInvitation));
router.get('/invitations/pending', requireHeaderAuth, asyncHandler(getUserInvitations));
router.get('/my-join-requests', requireHeaderAuth, asyncHandler(getMyJoinRequests));
router.get('/:id', requireHeaderAuth, asyncHandler(getGroup));

export default router;
